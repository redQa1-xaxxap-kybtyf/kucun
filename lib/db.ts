import { PrismaClient, type Prisma } from '@prisma/client';

import { env } from './env';
import { SYSTEM_MODE_SETTING_KEY } from './types/system-mode';

type LogContext = {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  [key: string]: string | number | boolean | null | undefined;
};

let loggerModule: typeof import('@/lib/logger') | null = null;
async function getLogger() {
  if (!loggerModule) {
    loggerModule = await import('@/lib/logger');
  }
  return loggerModule.logger;
}

async function logDatabaseInfo(message: string, context?: LogContext) {
  try {
    const logger = await getLogger();
    logger.info('database', message, context);
  } catch {
    // ignore logging failures to avoid impacting primary flow
  }
}

async function logDatabaseWarn(message: string, context?: LogContext) {
  try {
    const logger = await getLogger();
    logger.warn('database', message, context);
  } catch {
    // ignore
  }
}

async function logDatabaseError(
  message: string,
  error?: unknown,
  context?: LogContext
) {
  try {
    const logger = await getLogger();
    logger.error('database', message, error, context);
  } catch {
    // ignore
  }
}

const isJestEnvironment =
  typeof process !== 'undefined' && !!process.env.JEST_WORKER_ID;

// 全局 Prisma 客户端实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const MIN_SLOW_QUERY_THRESHOLD_MS = 50;
const defaultSlowQueryThresholdMs = env.NODE_ENV === 'production' ? 1000 : 500;
const slowQueryThresholdMs = Math.max(
  MIN_SLOW_QUERY_THRESHOLD_MS,
  env.PRISMA_SLOW_QUERY_THRESHOLD_MS ?? defaultSlowQueryThresholdMs
);

const SYSTEM_MODE_CACHE_TTL_MS = 5_000;
let cachedSystemMode: 'trial' | 'production' | null = null;
let cachedSystemModeAt = 0;
const DEFAULT_SYSTEM_MODE: 'trial' | 'production' =
  env.NODE_ENV === 'development' ? 'trial' : 'production';

// 防止在客户端环境中初始化 Prisma
function createPrismaClient() {
  // 客户端环境检测
  if (typeof window !== 'undefined' && !isJestEnvironment) {
    throw new Error(
      'PrismaClient is not available in browser environment. Please use API routes to access database.'
    );
  }

  return new PrismaClient({
    log:
      env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    // 性能监控（可选）
    errorFormat: 'minimal',
  });
}

// 创建 Prisma 客户端实例（仅在服务端）
export const prisma =
  typeof window !== 'undefined' && !isJestEnvironment
    ? (null as unknown as PrismaClient) // 客户端返回 null
    : (globalForPrisma.prisma ?? createPrismaClient());

// 在开发环境中保存实例到全局变量，避免热重载时重复创建
if (typeof window === 'undefined' && env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 慢查询监控（仅在服务端环境）
if (typeof window === 'undefined' && prisma) {
  // 系统模式下的默认数据标签写入（trial=test, production=prod）
  prisma.$use(async (params, next) => {
    // 仅拦截包含 dataTag 字段的核心业务表写入，避免影响系统表与其他模型
    const taggedModels = new Set([
      'SalesOrder',
      'ReturnOrder',
      'PaymentRecord',
      'RefundRecord',
      'PurchaseOrder',
      'FactoryShipmentOrder',
      'PayableRecord',
      'PaymentOutRecord',
      'ExpenseRecord',
    ]);

    const shouldTag =
      params.model &&
      taggedModels.has(params.model) &&
      (params.action === 'create' ||
        params.action === 'createMany' ||
        params.action === 'upsert');

    if (!shouldTag) {
      return next(params);
    }

    // 避免在读取 system_settings 时递归触发
    if (params.model === 'SystemSetting') {
      return next(params);
    }

    const now = Date.now();
    if (
      !cachedSystemMode ||
      now - cachedSystemModeAt > SYSTEM_MODE_CACHE_TTL_MS
    ) {
      try {
        const setting = await prisma.systemSetting.findUnique({
          where: { key: SYSTEM_MODE_SETTING_KEY },
          select: { value: true },
        });
        cachedSystemMode =
          setting?.value === 'trial' || setting?.value === 'production'
            ? (setting.value as 'trial' | 'production')
            : DEFAULT_SYSTEM_MODE;
        cachedSystemModeAt = now;
      } catch {
        cachedSystemMode = DEFAULT_SYSTEM_MODE;
        cachedSystemModeAt = now;
      }
    }

    const desiredTag = cachedSystemMode === 'trial' ? 'test' : 'prod';

    const ensureTag = (data: Record<string, unknown>) => {
      if (
        data.dataTag === undefined ||
        data.dataTag === null ||
        data.dataTag === ''
      ) {
        data.dataTag = desiredTag;
      }
    };

    if (params.action === 'create') {
      if (params.args?.data && typeof params.args.data === 'object') {
        ensureTag(params.args.data as Record<string, unknown>);
      }
    }

    if (params.action === 'createMany') {
      const data = params.args?.data;
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item && typeof item === 'object') {
            ensureTag(item as Record<string, unknown>);
          }
        });
      } else if (data && typeof data === 'object') {
        ensureTag(data as Record<string, unknown>);
      }
    }

    if (params.action === 'upsert') {
      if (params.args?.create && typeof params.args.create === 'object') {
        ensureTag(params.args.create as Record<string, unknown>);
      }
    }

    return next(params);
  });

  // 通过环境变量/默认值控制慢查询阈值，避免噪声同时保留可观测性
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    const duration = after - before;

    // 记录超过阈值的查询（默认开发500ms / 生产1000ms，可配置）
    if (duration > slowQueryThresholdMs) {
      void logDatabaseWarn(
        `[Prisma] 慢查询: ${params.model}.${params.action} 用时 ${duration}ms (阈值: ${slowQueryThresholdMs}ms)`,
        {
          model: params.model,
          action: params.action,
          duration,
          threshold: slowQueryThresholdMs,
        }
      );
    }

    return result;
  });
}

// 数据库连接测试函数
export async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    await logDatabaseInfo('数据库连接成功');
    return true;
  } catch (error) {
    await logDatabaseError('数据库连接失败', error);
    return false;
  }
}

// 优雅关闭数据库连接
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    await logDatabaseInfo('数据库连接已关闭');
  } catch (error) {
    await logDatabaseError('关闭数据库连接时出错', error);
  }
}

// 数据库健康检查
export async function healthCheck() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as health`;
    return { status: 'healthy', result };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 事务辅助函数
type TransactionCallback<T> = (
  tx: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >
) => Promise<T>;

type TransactionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
};

export async function withTransaction<T>(
  fn: TransactionCallback<T>,
  options?: TransactionOptions
): Promise<T> {
  return await prisma.$transaction(fn, options);
}

// 数据库统计信息
export async function getDatabaseStats() {
  try {
    const [
      userCount,
      customerCount,
      productCount,
      salesOrderCount,
      inventoryCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.salesOrder.count(),
      prisma.inventory.count(),
    ]);

    return {
      users: userCount,
      customers: customerCount,
      products: productCount,
      salesOrders: salesOrderCount,
      inventory: inventoryCount,
    };
  } catch (error) {
    await logDatabaseError('获取数据库统计信息失败', error);
    return null;
  }
}

// 清理过期数据（可选）
export async function cleanupExpiredData() {
  try {
    // 这里可以添加清理逻辑，比如删除过期的草稿订单等
    await logDatabaseInfo('数据清理完成');
  } catch (error) {
    await logDatabaseError('数据清理失败', error);
  }
}

// 导出类型
export * from '@prisma/client';
export type { PrismaClient } from '@prisma/client';
