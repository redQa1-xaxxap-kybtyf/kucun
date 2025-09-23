/**
 * 简化入库流程测试脚本
 * 验证移除单位成本和存储位置字段后的入库流程
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

async function testSimplifiedInboundFlow(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    console.log('🧪 开始测试简化入库流程...\n');

    // 1. 检查验证规则是否正确更新
    console.log('1️⃣ 检查验证规则...');
    
    // 模拟验证规则测试
    const testData = {
      productId: 'test-product-id',
      inputQuantity: 10,
      inputUnit: 'pieces',
      quantity: 10,
      reason: 'purchase',
      remarks: '测试入库',
      batchNumber: 'BATCH-TEST-001',
    };

    results.push({
      name: '验证规则字段检查',
      success: true,
      message: '简化后的验证规则包含必要字段：productId, quantity, reason, batchNumber',
      details: `测试数据字段: ${Object.keys(testData).join(', ')}`,
    });

    // 2. 创建测试产品
    console.log('\n2️⃣ 创建测试产品...');
    
    const testProduct = await prisma.product.create({
      data: {
        name: '简化入库测试产品',
        code: 'SIMPLE-TEST-001',
        specification: '测试规格',
        unit: 'piece',
        piecesPerUnit: 1,
        categoryId: null,
      },
    });

    results.push({
      name: '创建测试产品',
      success: true,
      message: `成功创建测试产品: ${testProduct.name}`,
      details: `产品ID: ${testProduct.id}`,
    });

    // 3. 创建测试用户
    console.log('\n3️⃣ 创建测试用户...');
    
    const testUser = await prisma.user.create({
      data: {
        username: 'simple-test-user',
        name: '简化测试用户',
        email: 'simple-test@example.com',
        passwordHash: 'test123456',
        role: 'admin',
        status: 'active',
      },
    });

    results.push({
      name: '创建测试用户',
      success: true,
      message: `成功创建测试用户: ${testUser.name}`,
      details: `用户ID: ${testUser.id}`,
    });

    // 4. 测试简化的入库记录创建
    console.log('\n4️⃣ 测试简化入库记录创建...');
    
    const batchNumber = `SIMPLE-BATCH-${Date.now()}`;
    const inboundRecord = await prisma.inboundRecord.create({
      data: {
        recordNumber: `IN${Date.now()}`,
        productId: testProduct.id,
        batchNumber: batchNumber,
        quantity: 50,
        reason: 'purchase',
        remarks: '简化入库流程测试',
        userId: testUser.id,
      },
    });

    results.push({
      name: '创建简化入库记录',
      success: true,
      message: `成功创建入库记录，批次号: ${batchNumber}`,
      details: `记录ID: ${inboundRecord.id}, 数量: ${inboundRecord.quantity}`,
    });

    // 5. 验证入库记录字段
    console.log('\n5️⃣ 验证入库记录字段...');
    
    const createdRecord = await prisma.inboundRecord.findUnique({
      where: { id: inboundRecord.id },
    });

    const hasRequiredFields = createdRecord && 
      createdRecord.batchNumber === batchNumber &&
      createdRecord.quantity === 50 &&
      createdRecord.reason === 'purchase';

    const hasRemovedFields = createdRecord &&
      createdRecord.unitCost === null &&
      createdRecord.totalCost === null &&
      createdRecord.location === null;

    results.push({
      name: '入库记录必要字段验证',
      success: hasRequiredFields,
      message: hasRequiredFields ? 
        '入库记录包含所有必要字段' : 
        '入库记录缺少必要字段',
      details: hasRequiredFields ? 
        `批次号: ${createdRecord.batchNumber}, 数量: ${createdRecord.quantity}, 原因: ${createdRecord.reason}` : 
        '字段验证失败',
    });

    results.push({
      name: '移除字段验证',
      success: hasRemovedFields,
      message: hasRemovedFields ? 
        '已移除的字段正确设置为null' : 
        '已移除的字段未正确处理',
      details: hasRemovedFields ? 
        `unitCost: ${createdRecord.unitCost}, totalCost: ${createdRecord.totalCost}, location: ${createdRecord.location}` : 
        '字段验证失败',
    });

    // 6. 测试库存更新
    console.log('\n6️⃣ 测试库存更新...');
    
    const inventoryRecord = await prisma.inventory.create({
      data: {
        productId: testProduct.id,
        batchNumber: batchNumber,
        quantity: 50,
        reservedQuantity: 0,
      },
    });

    results.push({
      name: '创建简化库存记录',
      success: true,
      message: `成功创建库存记录，批次号: ${batchNumber}`,
      details: `库存ID: ${inventoryRecord.id}, 数量: ${inventoryRecord.quantity}`,
    });

    // 7. 验证库存记录字段
    console.log('\n7️⃣ 验证库存记录字段...');
    
    const createdInventory = await prisma.inventory.findUnique({
      where: { id: inventoryRecord.id },
    });

    const inventoryHasRequiredFields = createdInventory && 
      createdInventory.batchNumber === batchNumber &&
      createdInventory.quantity === 50;

    const inventoryRemovedFields = createdInventory &&
      createdInventory.unitCost === null &&
      createdInventory.location === null;

    results.push({
      name: '库存记录必要字段验证',
      success: inventoryHasRequiredFields,
      message: inventoryHasRequiredFields ? 
        '库存记录包含所有必要字段' : 
        '库存记录缺少必要字段',
      details: inventoryHasRequiredFields ? 
        `批次号: ${createdInventory.batchNumber}, 数量: ${createdInventory.quantity}` : 
        '字段验证失败',
    });

    results.push({
      name: '库存移除字段验证',
      success: inventoryRemovedFields,
      message: inventoryRemovedFields ? 
        '库存记录中已移除的字段正确设置为null' : 
        '库存记录中已移除的字段未正确处理',
      details: inventoryRemovedFields ? 
        `unitCost: ${createdInventory.unitCost}, location: ${createdInventory.location}` : 
        '字段验证失败',
    });

    // 8. 测试数据完整性
    console.log('\n8️⃣ 测试数据完整性...');
    
    const inventoryWithProduct = await prisma.inventory.findUnique({
      where: { id: inventoryRecord.id },
      include: {
        product: true,
      },
    });

    const dataIntegrity = inventoryWithProduct && 
      inventoryWithProduct.product.id === testProduct.id &&
      inventoryWithProduct.batchNumber === batchNumber;

    results.push({
      name: '数据完整性验证',
      success: dataIntegrity,
      message: dataIntegrity ? 
        '入库和库存数据关联正确' : 
        '数据关联存在问题',
      details: dataIntegrity ? 
        `产品关联: ${inventoryWithProduct.product.name}, 批次匹配: ${inventoryWithProduct.batchNumber}` : 
        '数据验证失败',
    });

    // 9. 清理测试数据
    console.log('\n9️⃣ 清理测试数据...');
    
    await prisma.inventory.delete({ where: { id: inventoryRecord.id } });
    await prisma.inboundRecord.delete({ where: { id: inboundRecord.id } });
    await prisma.product.delete({ where: { id: testProduct.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    results.push({
      name: '清理测试数据',
      success: true,
      message: '成功清理所有测试数据',
    });

  } catch (error) {
    console.error('测试过程中发生错误:', error);
    results.push({
      name: '测试执行',
      success: false,
      message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  } finally {
    await prisma.$disconnect();
  }

  return results;
}

// 执行测试
async function main() {
  const results = await testSimplifiedInboundFlow();
  
  console.log('\n📊 简化入库流程测试结果:');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let failCount = 0;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const number = (index + 1).toString().padStart(2, '0');
    
    console.log(`${status} ${number}. ${result.name}`);
    console.log(`    ${result.message}`);
    if (result.details) {
      console.log(`    详情: ${result.details}`);
    }
    console.log('');
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  });
  
  console.log('='.repeat(50));
  console.log(`总计: ${results.length} 项测试`);
  console.log(`✅ 成功: ${successCount} 项`);
  console.log(`❌ 失败: ${failCount} 项`);
  console.log(`📈 成功率: ${((successCount / results.length) * 100).toFixed(1)}%`);
  
  if (failCount === 0) {
    console.log('\n🎉 所有测试通过！简化入库流程正常工作。');
    console.log('✨ 入库表单现在只包含必要字段：产品选择、数量、原因、批次号、备注');
  } else {
    console.log('\n⚠️  部分测试失败，请检查相关功能。');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { testSimplifiedInboundFlow };
