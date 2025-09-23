#!/usr/bin/env npx tsx

/**
 * 测试批次管理功能恢复
 * 验证简化后的批次管理系统是否正常工作
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

async function testBatchRecovery(): Promise<void> {
  console.log('🧪 开始测试批次管理功能恢复...\n');

  const results: TestResult[] = [];

  try {
    // 1. 测试数据库模型
    console.log('1. 测试数据库模型...');

    // 检查 InboundRecord 模型是否包含批次字段
    const inboundFields =
      await prisma.$queryRaw`PRAGMA table_info(inbound_records)`;
    const hasBatchNumber =
      Array.isArray(inboundFields) &&
      inboundFields.some((field: any) => field.name === 'batch_number');

    results.push({
      name: 'InboundRecord模型包含batchNumber字段',
      success: hasBatchNumber,
      message: hasBatchNumber
        ? '✅ batchNumber字段存在'
        : '❌ batchNumber字段缺失',
    });

    // 检查 Inventory 模型是否包含批次字段
    const inventoryFields =
      await prisma.$queryRaw`PRAGMA table_info(inventory)`;
    const inventoryHasBatchNumber =
      Array.isArray(inventoryFields) &&
      inventoryFields.some((field: any) => field.name === 'batch_number');

    results.push({
      name: 'Inventory模型包含batchNumber字段',
      success: inventoryHasBatchNumber,
      message: inventoryHasBatchNumber
        ? '✅ batchNumber字段存在'
        : '❌ batchNumber字段缺失',
    });

    // 2. 测试创建测试产品
    console.log('2. 创建测试产品...');

    const testProduct = await prisma.product.create({
      data: {
        code: 'TEST-BATCH-001',
        name: '批次测试产品',
        unit: 'pieces',
        piecesPerUnit: 1,
        specification: '测试规格',
        status: 'active',
      },
    });

    results.push({
      name: '创建测试产品',
      success: !!testProduct,
      message: testProduct ? '✅ 测试产品创建成功' : '❌ 测试产品创建失败',
      details: testProduct ? `产品ID: ${testProduct.id}` : undefined,
    });

    // 3. 测试创建测试用户
    console.log('3. 创建测试用户...');

    const testUser = await prisma.user.create({
      data: {
        name: '批次测试用户',
        username: 'batch-test-user',
        email: 'batch-test@example.com',
        passwordHash: 'test-hash',
        role: 'admin',
      },
    });

    results.push({
      name: '创建测试用户',
      success: !!testUser,
      message: testUser ? '✅ 测试用户创建成功' : '❌ 测试用户创建失败',
      details: testUser ? `用户ID: ${testUser.id}` : undefined,
    });

    // 4. 测试创建带批次号的入库记录
    console.log('4. 测试创建带批次号的入库记录...');

    const inboundRecord = await prisma.inboundRecord.create({
      data: {
        recordNumber: 'IN-BATCH-TEST-001',
        productId: testProduct.id,
        batchNumber: 'BATCH-2025-001',
        quantity: 100,
        reason: 'purchase',
        remarks: '批次管理测试入库',
        userId: testUser.id,
      },
    });

    results.push({
      name: '创建带批次号的入库记录',
      success: !!inboundRecord,
      message: inboundRecord ? '✅ 入库记录创建成功' : '❌ 入库记录创建失败',
      details: inboundRecord
        ? `批次号: ${inboundRecord.batchNumber}`
        : undefined,
    });

    // 5. 测试创建对应的库存记录
    console.log('5. 测试创建对应的库存记录...');

    const inventoryRecord = await prisma.inventory.create({
      data: {
        productId: testProduct.id,
        batchNumber: 'BATCH-2025-001',
        quantity: 100,
        reservedQuantity: 0,
      },
    });

    results.push({
      name: '创建带批次号的库存记录',
      success: !!inventoryRecord,
      message: inventoryRecord ? '✅ 库存记录创建成功' : '❌ 库存记录创建失败',
      details: inventoryRecord
        ? `批次号: ${inventoryRecord.batchNumber}`
        : undefined,
    });

    // 6. 测试查询批次相关数据
    console.log('6. 测试查询批次相关数据...');

    const batchInventory = await prisma.inventory.findMany({
      where: {
        batchNumber: 'BATCH-2025-001',
      },
      include: {
        product: true,
      },
    });

    results.push({
      name: '查询批次库存数据',
      success: batchInventory.length > 0,
      message:
        batchInventory.length > 0
          ? '✅ 批次库存查询成功'
          : '❌ 批次库存查询失败',
      details:
        batchInventory.length > 0
          ? `找到 ${batchInventory.length} 条记录`
          : undefined,
    });

    // 7. 清理测试数据
    console.log('7. 清理测试数据...');

    await prisma.inventory.deleteMany({
      where: { productId: testProduct.id },
    });

    await prisma.inboundRecord.deleteMany({
      where: { productId: testProduct.id },
    });

    await prisma.product.delete({
      where: { id: testProduct.id },
    });

    await prisma.user.delete({
      where: { id: testUser.id },
    });

    results.push({
      name: '清理测试数据',
      success: true,
      message: '✅ 测试数据清理完成',
    });
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    results.push({
      name: '测试执行',
      success: false,
      message: `❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  } finally {
    await prisma.$disconnect();
  }

  // 输出测试结果
  console.log('\n📊 测试结果汇总:');
  console.log('='.repeat(50));

  let successCount = 0;
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}: ${result.message}`);
    if (result.details) {
      console.log(`   详情: ${result.details}`);
    }
    if (result.success) successCount++;
  });

  console.log('='.repeat(50));
  console.log(`✅ 成功: ${successCount}/${results.length}`);
  console.log(`❌ 失败: ${results.length - successCount}/${results.length}`);

  if (successCount === results.length) {
    console.log('\n🎉 所有测试通过！批次管理功能恢复成功！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查相关配置。');
  }
}

// 运行测试
if (require.main === module) {
  testBatchRecovery().catch(console.error);
}
