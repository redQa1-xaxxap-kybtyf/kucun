/**
 * 调试入库记录关联查询问题
 * 检查操作人和产品信息为什么没有成功获取到
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

async function debugInboundRelations() {
  console.log('🔍 调试入库记录关联查询问题...\n');
  
  try {
    // 1. 检查入库记录表的数据
    console.log('1. 检查入库记录表的基础数据...');
    const rawRecords = await prisma.inboundRecord.findMany({
      take: 2,
    });
    
    console.log(`✅ 找到 ${rawRecords.length} 条入库记录`);
    rawRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. 记录ID: ${record.id}`);
      console.log(`     记录编号: ${record.recordNumber}`);
      console.log(`     产品ID: ${record.productId}`);
      console.log(`     用户ID: ${record.userId}`);
      console.log(`     数量: ${record.quantity}`);
      console.log(`     原因: ${record.reason}`);
    });
    
    // 2. 检查产品表的数据
    console.log('\n2. 检查产品表的数据...');
    const products = await prisma.product.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        code: true,
        unit: true,
      },
    });
    
    console.log(`✅ 找到 ${products.length} 个产品`);
    products.forEach((product, index) => {
      console.log(`  ${index + 1}. 产品ID: ${product.id}`);
      console.log(`     产品名称: ${product.name}`);
      console.log(`     产品编码: ${product.code}`);
      console.log(`     产品单位: ${product.unit}`);
    });
    
    // 3. 检查用户表的数据
    console.log('\n3. 检查用户表的数据...');
    const users = await prisma.user.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    
    console.log(`✅ 找到 ${users.length} 个用户`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. 用户ID: ${user.id}`);
      console.log(`     用户名称: ${user.name}`);
      console.log(`     用户邮箱: ${user.email}`);
    });
    
    // 4. 检查关联查询
    console.log('\n4. 测试关联查询...');
    const recordsWithRelations = await prisma.inboundRecord.findMany({
      take: 2,
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
    
    console.log(`✅ 关联查询返回 ${recordsWithRelations.length} 条记录`);
    recordsWithRelations.forEach((record, index) => {
      console.log(`  ${index + 1}. 记录: ${record.recordNumber}`);
      console.log(`     产品信息: ${record.product ? '✅ 已获取' : '❌ 未获取'}`);
      if (record.product) {
        console.log(`       - 产品名称: ${record.product.name}`);
        console.log(`       - 产品编码: ${record.product.code}`);
        console.log(`       - 产品单位: ${record.product.unit}`);
      }
      console.log(`     用户信息: ${record.user ? '✅ 已获取' : '❌ 未获取'}`);
      if (record.user) {
        console.log(`       - 用户名称: ${record.user.name}`);
      }
    });
    
    // 5. 检查外键关系
    console.log('\n5. 检查外键关系...');
    if (rawRecords.length > 0) {
      const firstRecord = rawRecords[0];
      
      // 检查产品是否存在
      const product = await prisma.product.findUnique({
        where: { id: firstRecord.productId },
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
        },
      });
      
      console.log(`产品 ${firstRecord.productId}: ${product ? '✅ 存在' : '❌ 不存在'}`);
      if (product) {
        console.log(`  产品名称: ${product.name}`);
        console.log(`  产品编码: ${product.code}`);
      }
      
      // 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: firstRecord.userId },
        select: {
          id: true,
          name: true,
        },
      });
      
      console.log(`用户 ${firstRecord.userId}: ${user ? '✅ 存在' : '❌ 不存在'}`);
      if (user) {
        console.log(`  用户名称: ${user.name}`);
      }
    }
    
    // 6. 测试格式化函数的输入数据
    console.log('\n6. 测试格式化函数的输入数据...');
    if (recordsWithRelations.length > 0) {
      const testRecord = recordsWithRelations[0];
      
      console.log('格式化函数将接收到的数据结构:');
      console.log(`  record.id: ${testRecord.id}`);
      console.log(`  record.recordNumber: ${testRecord.recordNumber}`);
      console.log(`  record.productId: ${testRecord.productId}`);
      console.log(`  record.product: ${testRecord.product ? '存在' : '不存在'}`);
      if (testRecord.product) {
        console.log(`    record.product.name: ${testRecord.product.name}`);
        console.log(`    record.product.code: ${testRecord.product.code}`);
        console.log(`    record.product.unit: ${testRecord.product.unit}`);
      }
      console.log(`  record.user: ${testRecord.user ? '存在' : '不存在'}`);
      if (testRecord.user) {
        console.log(`    record.user.name: ${testRecord.user.name}`);
      }
      console.log(`  record.quantity: ${testRecord.quantity}`);
      console.log(`  record.reason: ${testRecord.reason}`);
      console.log(`  record.userId: ${testRecord.userId}`);
      
      // 模拟格式化过程
      const formatted = {
        id: testRecord.id,
        recordNumber: testRecord.recordNumber,
        productId: testRecord.productId,
        productName: testRecord.product?.name || '未知产品',
        productSku: testRecord.product?.code || '未知编码',
        productUnit: testRecord.product?.unit || '未知单位',
        quantity: testRecord.quantity,
        reason: testRecord.reason,
        userId: testRecord.userId,
        userName: testRecord.user?.name || '未知用户',
        createdAt: testRecord.createdAt.toISOString(),
        updatedAt: testRecord.updatedAt.toISOString(),
      };
      
      console.log('\n格式化后的数据:');
      console.log(`  产品名称: ${formatted.productName}`);
      console.log(`  产品编码: ${formatted.productSku}`);
      console.log(`  用户名称: ${formatted.userName}`);
    }
    
    console.log('\n✅ 调试完成');
    
  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行调试
debugInboundRelations().catch(console.error);
