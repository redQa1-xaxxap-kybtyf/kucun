/**
 * 强制清理所有 processing 状态的幂等性记录
 */

import { prisma } from '../lib/db';

async function forceCleanup() {
  console.log('查找所有 processing 状态的记录...\n');

  const processingRecords = await prisma.inventoryOperation.findMany({
    where: {
      status: 'processing',
    },
    select: {
      id: true,
      idempotencyKey: true,
      operationType: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  console.log(`找到 ${processingRecords.length} 条 processing 记录\n`);

  if (processingRecords.length > 0) {
    processingRecords.forEach((record, index) => {
      const now = new Date();
      const age = (now.getTime() - record.createdAt.getTime()) / 1000;
      const isExpired = record.expiresAt < now;

      console.log(`${index + 1}. 记录详情:`);
      console.log(`   幂等性键: ${record.idempotencyKey}`);
      console.log(`   操作类型: ${record.operationType}`);
      console.log(`   创建时间: ${record.createdAt.toISOString()}`);
      console.log(`   年龄: ${age.toFixed(1)} 秒`);
      console.log(`   过期时间: ${record.expiresAt.toISOString()}`);
      console.log(`   是否已过期: ${isExpired ? '是' : '否'}\n`);
    });

    console.log('正在删除所有 processing 记录...');

    const result = await prisma.inventoryOperation.deleteMany({
      where: {
        status: 'processing',
      },
    });

    console.log(`✅ 已删除 ${result.count} 条记录\n`);
  } else {
    console.log('✅ 没有发现 processing 记录');
  }

  await prisma.$disconnect();
}

forceCleanup()
  .catch(error => {
    console.error('❌ 清理失败:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('完成');
  });
