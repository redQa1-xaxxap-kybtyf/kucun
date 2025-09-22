/**
 * 测试入库记录API功能
 * 检查数据库连接、模型定义和API响应
 */

import { prisma } from '../lib/db';
import { parseInboundQueryParams } from '../lib/api/inbound-handlers';

async function testDatabaseConnection() {
  console.log('🔍 测试数据库连接...');
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    
    // 测试基本查询
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ 数据库查询测试通过:', result);
    
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

async function testInboundRecordModel() {
  console.log('\n🔍 测试入库记录模型...');
  try {
    // 检查表是否存在
    const tableExists = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='inbound_records'
    `;
    console.log('📋 入库记录表检查:', tableExists);
    
    // 获取表结构
    const tableInfo = await prisma.$queryRaw`PRAGMA table_info(inbound_records)`;
    console.log('📊 入库记录表结构:', tableInfo);
    
    // 统计记录数量
    const count = await prisma.inboundRecord.count();
    console.log('📈 入库记录总数:', count);
    
    // 获取最近的几条记录
    const recentRecords = await prisma.inboundRecord.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
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
    
    console.log('📝 最近的入库记录:');
    recentRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.recordNumber} - ${record.product?.name || '未知产品'} (数量: ${record.quantity})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 入库记录模型测试失败:', error);
    return false;
  }
}

async function testQueryParamsParsing() {
  console.log('\n🔍 测试查询参数解析...');
  try {
    // 创建测试查询参数
    const searchParams = new URLSearchParams({
      page: '1',
      limit: '20',
      search: 'test',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    
    const parsedParams = parseInboundQueryParams(searchParams);
    console.log('✅ 查询参数解析成功:', parsedParams);
    
    // 测试空参数
    const emptyParams = new URLSearchParams();
    const parsedEmptyParams = parseInboundQueryParams(emptyParams);
    console.log('✅ 空参数解析成功:', parsedEmptyParams);
    
    return true;
  } catch (error) {
    console.error('❌ 查询参数解析失败:', error);
    return false;
  }
}

async function testInboundRecordQuery() {
  console.log('\n🔍 测试入库记录查询...');
  try {
    // 测试基本查询
    const records = await prisma.inboundRecord.findMany({
      take: 5,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
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
    
    if (records.length > 0) {
      const firstRecord = records[0];
      console.log('📋 第一条记录详情:');
      console.log(`  - ID: ${firstRecord.id}`);
      console.log(`  - 记录编号: ${firstRecord.recordNumber}`);
      console.log(`  - 产品: ${firstRecord.product?.name || '未知'}`);
      console.log(`  - 数量: ${firstRecord.quantity}`);
      console.log(`  - 原因: ${firstRecord.reason}`);
      console.log(`  - 创建时间: ${firstRecord.createdAt}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ 入库记录查询失败:', error);
    return false;
  }
}

async function testAPIEndpoint() {
  console.log('\n🔍 测试API端点...');
  try {
    const baseUrl = 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/inventory/inbound?page=1&limit=5`);
    
    if (!response.ok) {
      console.error(`❌ API请求失败: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('错误详情:', errorText);
      return false;
    }
    
    const data = await response.json();
    console.log('✅ API响应成功:', {
      success: data.success,
      dataCount: data.data?.length || 0,
      pagination: data.pagination,
    });
    
    return true;
  } catch (error) {
    console.error('❌ API端点测试失败:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始入库记录API测试\n');
  
  const tests = [
    { name: '数据库连接', fn: testDatabaseConnection },
    { name: '入库记录模型', fn: testInboundRecordModel },
    { name: '查询参数解析', fn: testQueryParamsParsing },
    { name: '入库记录查询', fn: testInboundRecordQuery },
    { name: 'API端点', fn: testAPIEndpoint },
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
    console.log('🎉 所有测试通过！');
  } else {
    console.log('⚠️  部分测试失败，请检查上述错误信息');
  }
  
  // 关闭数据库连接
  await prisma.$disconnect();
}

// 运行测试
runTests().catch(console.error);
