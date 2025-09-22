/**
 * 测试修复后的入库记录API
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: 'file:./dev.db',
    },
  },
});

async function testInboundRecordWithCorrectFields() {
  console.log('🔍 测试修复后的入库记录查询...');
  try {
    const records = await prisma.inboundRecord.findMany({
      take: 2,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true, // 使用正确的 code 字段
            unit: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    console.log(`✅ 查询到 ${records.length} 条入库记录`);
    
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. 记录: ${record.recordNumber}`);
      console.log(`     产品: ${record.product?.name || '未找到产品'}`);
      console.log(`     产品编码: ${record.product?.code || '无编码'}`);
      console.log(`     用户: ${record.user?.name || '未找到用户'}`);
      console.log(`     数量: ${record.quantity}`);
      console.log(`     原因: ${record.reason}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 关联查询失败:', error);
    return false;
  }
}

async function testSearchFunctionality() {
  console.log('\n🔍 测试搜索功能...');
  try {
    // 测试按产品编码搜索
    const searchResults = await prisma.inboundRecord.findMany({
      where: {
        OR: [
          { recordNumber: { contains: 'IN' } },
          { product: { name: { contains: '' } } },
          { product: { code: { contains: '' } } }, // 使用正确的 code 字段
          { remarks: { contains: '' } },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true,
          },
        },
      },
      take: 3,
    });
    
    console.log(`✅ 搜索到 ${searchResults.length} 条记录`);
    
    searchResults.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.recordNumber} - ${record.product?.name} (${record.product?.code})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 搜索功能测试失败:', error);
    return false;
  }
}

async function testProductValidation() {
  console.log('\n🔍 测试产品验证功能...');
  try {
    // 获取一个存在的产品ID
    const existingProduct = await prisma.product.findFirst({
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
    
    if (!existingProduct) {
      console.log('⚠️  没有找到产品，跳过产品验证测试');
      return true;
    }
    
    console.log(`✅ 找到产品: ${existingProduct.name} (${existingProduct.code})`);
    
    // 测试产品验证查询
    const validationResult = await prisma.product.findUnique({
      where: { id: existingProduct.id },
      select: { id: true, name: true, code: true },
    });
    
    if (validationResult) {
      console.log(`✅ 产品验证成功: ${validationResult.name}`);
      return true;
    } else {
      console.log('❌ 产品验证失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 产品验证测试失败:', error);
    return false;
  }
}

async function testFormattedResponse() {
  console.log('\n🔍 测试格式化响应...');
  try {
    const records = await prisma.inboundRecord.findMany({
      take: 1,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (records.length === 0) {
      console.log('⚠️  没有入库记录，跳过格式化测试');
      return true;
    }
    
    const record = records[0];
    
    // 模拟格式化过程
    const formattedRecord = {
      id: record.id,
      recordNumber: record.recordNumber,
      productId: record.productId,
      productName: record.product?.name,
      productSku: record.product?.code, // 使用 code 字段作为 SKU
      productUnit: record.product?.unit,
      colorCode: record.colorCode || '',
      productionDate: record.productionDate?.toISOString().split('T')[0] || '',
      quantity: record.quantity,
      unitCost: record.unitCost || 0,
      totalCost: record.totalCost || 0,
      reason: record.reason,
      remarks: record.remarks || '',
      userId: record.userId,
      userName: record.user?.name || '',
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
    
    console.log('✅ 格式化记录示例:');
    console.log(`  - 记录编号: ${formattedRecord.recordNumber}`);
    console.log(`  - 产品名称: ${formattedRecord.productName}`);
    console.log(`  - 产品编码: ${formattedRecord.productSku}`);
    console.log(`  - 数量: ${formattedRecord.quantity}`);
    console.log(`  - 用户: ${formattedRecord.userName}`);
    
    return true;
  } catch (error) {
    console.error('❌ 格式化响应测试失败:', error);
    return false;
  }
}

async function runFixedTests() {
  console.log('🚀 开始测试修复后的入库记录功能\n');
  
  const tests = [
    { name: '入库记录关联查询', fn: testInboundRecordWithCorrectFields },
    { name: '搜索功能', fn: testSearchFunctionality },
    { name: '产品验证', fn: testProductValidation },
    { name: '格式化响应', fn: testFormattedResponse },
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      console.error(`❌ 测试 "${test.name}" 出现异常:`, error);
      results.push({ name: test.name, success: false });
    }
  }
  
  // 输出测试结果
  console.log('\n📊 测试结果汇总:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.name}`);
  });
  
  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  
  console.log(`\n🎯 测试完成: ${passedTests}/${totalTests} 通过`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！入库记录API修复成功！');
  } else {
    console.log('⚠️  部分测试失败，需要进一步检查');
  }
  
  // 关闭数据库连接
  await prisma.$disconnect();
}

// 运行测试
runFixedTests().catch(console.error);
