'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.prisma = void 0;
exports.testDatabaseConnection = testDatabaseConnection;
exports.disconnectDatabase = disconnectDatabase;
exports.healthCheck = healthCheck;
exports.withTransaction = withTransaction;
exports.getDatabaseStats = getDatabaseStats;
exports.cleanupExpiredData = cleanupExpiredData;
const client_1 = require('@prisma/client');
const env_1 = require('./env');
let loggerModule = null;
async function getLogger() {
  if (!loggerModule) {
    loggerModule = await Promise.resolve().then(() =>
      __importStar(require('@/lib/logger'))
    );
  }
  return loggerModule.logger;
}
async function logDatabaseInfo(message, context) {
  try {
    const logger = await getLogger();
    logger.info('database', message, context);
  } catch {
    // ignore logging failures to avoid impacting primary flow
  }
}
async function logDatabaseWarn(message, context) {
  try {
    const logger = await getLogger();
    logger.warn('database', message, context);
  } catch {
    // ignore
  }
}
async function logDatabaseError(message, error, context) {
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
const globalForPrisma = globalThis;
const MIN_SLOW_QUERY_THRESHOLD_MS = 50;
const defaultSlowQueryThresholdMs =
  env_1.env.NODE_ENV === 'production' ? 1000 : 500;
const slowQueryThresholdMs = Math.max(
  MIN_SLOW_QUERY_THRESHOLD_MS,
  env_1.env.PRISMA_SLOW_QUERY_THRESHOLD_MS ?? defaultSlowQueryThresholdMs
);
// 防止在客户端环境中初始化 Prisma
function createPrismaClient() {
  // 客户端环境检测
  if (typeof window !== 'undefined' && !isJestEnvironment) {
    throw new Error(
      'PrismaClient is not available in browser environment. Please use API routes to access database.'
    );
  }
  return new client_1.PrismaClient({
    log:
      env_1.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: env_1.env.DATABASE_URL,
      },
    },
    // 性能监控（可选）
    errorFormat: 'minimal',
  });
}
// 创建 Prisma 客户端实例（仅在服务端）
exports.prisma =
  typeof window !== 'undefined' && !isJestEnvironment
    ? null // 客户端返回 null
    : (globalForPrisma.prisma ?? createPrismaClient());
// 在开发环境中保存实例到全局变量，避免热重载时重复创建
if (typeof window === 'undefined' && env_1.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = exports.prisma;
}
// 慢查询监控（仅在服务端环境）
if (typeof window === 'undefined' && exports.prisma) {
  // 通过环境变量/默认值控制慢查询阈值，避免噪声同时保留可观测性
  exports.prisma.$use(async (params, next) => {
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
async function testDatabaseConnection() {
  try {
    await exports.prisma.$connect();
    await logDatabaseInfo('数据库连接成功');
    return true;
  } catch (error) {
    await logDatabaseError('数据库连接失败', error);
    return false;
  }
}
// 优雅关闭数据库连接
async function disconnectDatabase() {
  try {
    await exports.prisma.$disconnect();
    await logDatabaseInfo('数据库连接已关闭');
  } catch (error) {
    await logDatabaseError('关闭数据库连接时出错', error);
  }
}
// 数据库健康检查
async function healthCheck() {
  try {
    const result = await exports.prisma.$queryRaw`SELECT 1 as health`;
    return { status: 'healthy', result };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
async function withTransaction(fn, options) {
  return await exports.prisma.$transaction(fn, options);
}
// 数据库统计信息
async function getDatabaseStats() {
  try {
    const [
      userCount,
      customerCount,
      productCount,
      salesOrderCount,
      inventoryCount,
    ] = await Promise.all([
      exports.prisma.user.count(),
      exports.prisma.customer.count(),
      exports.prisma.product.count(),
      exports.prisma.salesOrder.count(),
      exports.prisma.inventory.count(),
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
async function cleanupExpiredData() {
  try {
    // 这里可以添加清理逻辑，比如删除过期的草稿订单等
    await logDatabaseInfo('数据清理完成');
  } catch (error) {
    await logDatabaseError('数据清理失败', error);
  }
}
// 导出类型
__exportStar(require('@prisma/client'), exports);
