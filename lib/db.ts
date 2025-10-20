import { PrismaClient, type Prisma } from '@prisma/client';

import { env } from './env';

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
  // 优化：降低阈值到100ms，增加详细日志，开发环境也启用
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    const duration = after - before;

    // 记录超过100ms的查询（优化前：1000ms）
    if (duration > 100) {
      void logDatabaseWarn(
        `[Prisma] 慢查询: ${params.model}.${params.action} 用时 ${duration}ms`,
        {
          model: params.model,
          action: params.action,
          duration,
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
