/**
 * 简化的入库记录测试脚本
 * 直接测试数据库连接和查询
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  datasources: {
    db: {
      url: 'file:./dev.db',
    },
  },
});

async function testBasicConnection() {
  console.log('🔍 测试基本数据库连接...');
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ 基本查询测试通过:', result);
    
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

async function checkTables() {
  console.log('\n🔍 检查数据库表...');
  try {
    // 检查所有表
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
    console.log('📋 数据库表列表:', tables);
    
    // 检查入库记录表
    const inboundTableExists = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='inbound_records'
    `;
    console.log('📊 入库记录表存在:', inboundTableExists);
    
    if (Array.isArray(inboundTableExists) && inboundTableExists.length > 0) {
      // 获取表结构
      const tableInfo = await prisma.$queryRaw`PRAGMA table_info(inbound_records)`;
      console.log('📋 入库记录表结构:', tableInfo);
    }
    
    return true;
  } catch (error) {
    console.error('❌ 检查表失败:', error);
    return false;
  }
}

async function testInboundRecordCount() {
  console.log('\n🔍 测试入库记录数量...');
  try {
    const count = await prisma.inboundRecord.count();
    console.log('📈 入库记录总数:', count);
    
    if (count > 0) {
      // 获取一些示例记录
      const records = await prisma.inboundRecord.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
      });
      
      console.log('📝 最近的入库记录:');
      records.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.recordNumber} - 数量: ${record.quantity} - 原因: ${record.reason}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ 测试入库记录失败:', error);
    return false;
  }
}

async function testInboundRecordWithRelations() {
  console.log('\n🔍 测试入库记录关联查询...');
  try {
    const records = await prisma.inboundRecord.findMany({
      take: 2,
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
    
    console.log(`✅ 查询到 ${records.length} 条带关联的入库记录`);
    
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. 记录: ${record.recordNumber}`);
      console.log(`     产品: ${record.product?.name || '未找到产品'}`);
      console.log(`     用户: ${record.user?.name || '未找到用户'}`);
      console.log(`     数量: ${record.quantity}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 关联查询失败:', error);
    return false;
  }
}

async function testProductTable() {
  console.log('\n🔍 检查产品表...');
  try {
    const productCount = await prisma.product.count();
    console.log('📊 产品总数:', productCount);
    
    if (productCount > 0) {
      const products = await prisma.product.findMany({
        take: 3,
        select: {
          id: true,
          name: true,
          sku: true,
        },
      });
      
      console.log('📝 产品示例:');
      products.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.name} (${product.sku})`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ 检查产品表失败:', error);
    return false;
  }
}

async function testUserTable() {
  console.log('\n🔍 检查用户表...');
  try {
    const userCount = await prisma.user.count();
    console.log('📊 用户总数:', userCount);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        take: 3,
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
      
      console.log('📝 用户示例:');
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (${user.email})`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ 检查用户表失败:', error);
    return false;
  }
}

async function runSimpleTests() {
  console.log('🚀 开始简化入库记录测试\n');
  
  const tests = [
    { name: '基本数据库连接', fn: testBasicConnection },
    { name: '检查数据库表', fn: checkTables },
    { name: '产品表检查', fn: testProductTable },
    { name: '用户表检查', fn: testUserTable },
    { name: '入库记录数量', fn: testInboundRecordCount },
    { name: '入库记录关联查询', fn: testInboundRecordWithRelations },
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
  
  // 关闭数据库连接
  await prisma.$disconnect();
}

// 运行测试
runSimpleTests().catch(console.error);
