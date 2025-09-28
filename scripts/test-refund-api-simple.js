const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRefundAPI() {
  try {
    console.log('🔍 测试退款API...');

    // 1. 检查数据库连接
    console.log('1. 检查数据库连接...');
    const userCount = await prisma.user.count();
    console.log(`   用户数量: ${userCount}`);

    const customerCount = await prisma.customer.count();
    console.log(`   客户数量: ${customerCount}`);

    const salesOrderCount = await prisma.salesOrder.count();
    console.log(`   销售订单数量: ${salesOrderCount}`);

    // 2. 检查退款记录
    console.log('2. 检查退款记录...');
    const refundCount = await prisma.refundRecord.count();
    console.log(`   退款记录数量: ${refundCount}`);

    if (refundCount === 0) {
      console.log('   没有退款记录，尝试创建测试数据...');

      // 获取第一个用户和客户
      const user = await prisma.user.findFirst();
      const customer = await prisma.customer.findFirst();
      const salesOrder = await prisma.salesOrder.findFirst();

      if (!user || !customer || !salesOrder) {
        console.log('   缺少基础数据，无法创建测试退款记录');
        return;
      }

      // 创建测试退款记录
      const testRefund = await prisma.refundRecord.create({
        data: {
          refundNumber: 'RT-TEST-001',
          returnOrderId: null, // 可选字段
          returnOrderNumber: null, // 可选字段
          salesOrderId: salesOrder.id,
          customerId: customer.id,
          userId: user.id,
          refundType: 'partial_refund',
          refundMethod: 'bank_transfer',
          refundAmount: 1000.0,
          processedAmount: 0,
          remainingAmount: 1000.0,
          refundDate: new Date(),
          status: 'pending',
          reason: '产品质量问题',
          remarks: '测试退款记录',
        },
      });

      console.log(`   创建测试退款记录: ${testRefund.refundNumber}`);
    }

    // 3. 测试查询退款记录
    console.log('3. 测试查询退款记录...');
    const refunds = await prisma.refundRecord.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 5,
    });

    console.log(`   查询到 ${refunds.length} 条退款记录:`);
    refunds.forEach((refund, index) => {
      console.log(
        `   ${index + 1}. ${refund.refundNumber} - ${refund.customerName || refund.customer?.name} - ¥${refund.refundAmount}`
      );
    });

    console.log('✅ 退款API测试完成');
  } catch (error) {
    console.error('❌ 退款API测试失败:', error);
    console.error('错误详情:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testRefundAPI();
