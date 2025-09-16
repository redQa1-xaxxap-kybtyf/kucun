import { PrismaClient } from '@prisma/client';

import { env } from './env';

// 全局 Prisma 客户端实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 创建 Prisma 客户端实例
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

// 在开发环境中保存实例到全局变量，避免热重载时重复创建
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 数据库连接测试函数
export async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

// 优雅关闭数据库连接
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接时出错:', error);
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
export async function withTransaction<T>(
  fn: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >
  ) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(fn);
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
    console.error('获取数据库统计信息失败:', error);
    return null;
  }
}

// 清理过期数据（可选）
export async function cleanupExpiredData() {
  try {
    // 这里可以添加清理逻辑，比如删除过期的草稿订单等
    console.log('数据清理完成');
  } catch (error) {
    console.error('数据清理失败:', error);
  }
}

// 导出类型
export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';
