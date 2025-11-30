/**
 * 清理卡住的幂等性记录
 * 删除已过期但仍处于processing状态的记录
 */

import { prisma } from '../lib/db';

async function cleanupStuckRecords() {
  console.log('开始清理卡住的幂等性记录...');

  // 查找卡住的记录
  const stuckRecords = await prisma.inventoryOperation.findMany({
    where: {
      status: 'processing',
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`找到 ${stuckRecords.length} 条卡住的记录`);

  if (stuckRecords.length > 0) {
    console.log('记录详情:');
    stuckRecords.forEach(record => {
      console.log(`  - ID: ${record.id}`);
      console.log(`    幂等性键: ${record.idempotencyKey}`);
      console.log(`    操作类型: ${record.operationType}`);
      console.log(`    创建时间: ${record.createdAt}`);
      console.log(`    过期时间: ${record.expiresAt}`);
      console.log('');
    });

    // 删除这些记录
    const result = await prisma.inventoryOperation.deleteMany({
      where: {
        status: 'processing',
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    console.log(`✅ 已删除 ${result.count} 条卡住的记录`);
  } else {
    console.log('✅ 没有发现卡住的记录');
  }

  await prisma.$disconnect();
}

cleanupStuckRecords()
  .catch(error => {
    console.error('❌ 清理失败:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('清理完成');
  });
