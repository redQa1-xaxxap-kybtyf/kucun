/**
 * 队列集成测试脚本
 * 验证入库队列架构是否正常工作
 */

import { generateBatchNumberOutsideTransaction } from '@/lib/api/batch-number-generator';
import { executeMinimalInboundTransaction } from '@/lib/api/minimal-inbound-transaction';
import { prisma } from '@/lib/db';
import {
  addInboundPostProcessingJob,
  getInboundQueueStats,
} from '@/lib/queue/inbound-queue';

async function testQueueIntegration() {
  console.log('🧪 开始队列集成测试...\n');

  try {
    // 步骤1: 获取测试产品
    console.log('📦 步骤1: 查找测试产品...');
    const product = await prisma.product.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    });

    if (!product) {
      throw new Error('未找到可用的测试产品');
    }
    console.log(`✅ 找到测试产品: ${product.name} (${product.code})\n`);

    // 步骤2: 批次号生成测试
    console.log('🔢 步骤2: 测试批次号生成...');
    const batchNumber = await generateBatchNumberOutsideTransaction(product.id);
    console.log(`✅ 批次号生成成功: ${batchNumber}\n`);

    // 步骤3: 最小化事务测试
    console.log('⚡ 步骤3: 测试最小化入库事务...');
    const startTime = Date.now();

    const testUser = await prisma.user.findFirst();
    if (!testUser) {
      throw new Error('未找到测试用户');
    }

    const inboundRecord = await executeMinimalInboundTransaction({
      productId: product.id,
      quantity: 10,
      unitCost: 10.5, // 测试单位成本
      reason: 'test',
      remarks: '队列集成测试',
      batchNumber,
      userId: testUser.id,
    });

    const transactionTime = Date.now() - startTime;
    console.log(`✅ 入库事务完成,耗时: ${transactionTime}ms`);
    console.log(`   记录ID: ${inboundRecord.id}`);
    console.log(`   记录编号: ${inboundRecord.recordNumber}\n`);

    // 验证事务耗时
    if (transactionTime > 2000) {
      console.warn(
        `⚠️  警告: 事务耗时 ${transactionTime}ms 超过预期(< 2000ms)`
      );
    }

    // 步骤4: 队列任务测试
    console.log('📮 步骤4: 测试队列任务添加...');
    const job = await addInboundPostProcessingJob({
      recordId: inboundRecord.id,
      productId: product.id,
      batchNumber,
      piecesPerUnit: 10,
      weight: 25.5,
    });
    console.log(`✅ 队列任务添加成功: Job ID = ${job.id}\n`);

    // 步骤5: 队列统计
    console.log('📊 步骤5: 查看队列统计...');
    const stats = await getInboundQueueStats();
    console.log('队列统计:');
    console.log(`  等待中: ${stats.waiting}`);
    console.log(`  处理中: ${stats.active}`);
    console.log(`  已完成: ${stats.completed}`);
    console.log(`  失败: ${stats.failed}`);
    console.log(`  延迟: ${stats.delayed}`);
    console.log(`  总计: ${stats.total}\n`);

    // 步骤6: 验证数据
    console.log('🔍 步骤6: 验证数据库记录...');
    const verifyRecord = await prisma.inboundRecord.findUnique({
      where: { id: inboundRecord.id },
      include: { product: true },
    });

    const verifyInventory = await prisma.inventory.findFirst({
      where: {
        productId: product.id,
        batchNumber,
      },
    });

    if (!verifyRecord) {
      throw new Error('入库记录未找到');
    }
    if (!verifyInventory) {
      throw new Error('库存记录未找到');
    }

    console.log(`✅ 入库记录验证通过: ${verifyRecord.quantity} 件`);
    console.log(
      `✅ 库存记录验证通过: 当前库存 ${verifyInventory.quantity} 件\n`
    );

    // 成功总结
    console.log('='.repeat(60));
    console.log('🎉 集成测试全部通过!\n');
    console.log('性能指标:');
    console.log(
      `  ✅ 事务耗时: ${transactionTime}ms ${transactionTime < 1000 ? '(优秀)' : transactionTime < 2000 ? '(良好)' : '(需优化)'}`
    );
    console.log(
      `  ✅ 队列健康度: ${stats.failed === 0 ? '健康' : '有失败任务'}`
    );
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testQueueIntegration()
  .then(() => {
    console.log('\n✅ 测试完成,进程退出');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
