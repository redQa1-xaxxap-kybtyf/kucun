/**
 * 测试数据库连接和退款记录
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  console.log('🧪 测试数据库连接和退款记录...\n');

  try {
    // 1. 测试数据库连接
    console.log('1. 测试数据库连接...');
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 2. 检查退款记录表
    console.log('\n2. 检查退款记录表...');
    const refundCount = await prisma.refundRecord.count();
    console.log(`✅ 退款记录总数: ${refundCount}`);

    // 3. 获取前5条退款记录
    console.log('\n3. 获取前5条退款记录...');
    const refunds = await prisma.refundRecord.findMany({
      take: 5,
      select: {
        id: true,
        refundNumber: true,
        refundAmount: true,
        status: true,
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
    });

    console.log(`✅ 获取到 ${refunds.length} 条退款记录:`);
    refunds.forEach((refund, index) => {
      console.log(
        `   ${index + 1}. ${refund.refundNumber} - ¥${refund.refundAmount} - ${refund.status}`
      );
      console.log(`      客户: ${refund.customer?.name || '未知'}`);
      console.log(`      订单: ${refund.salesOrder?.orderNumber || '未知'}`);
      console.log(`      操作员: ${refund.user?.name || '未知'}`);
    });

    // 4. 测试查询条件
    console.log('\n4. 测试查询条件...');
    const where = {};
    const testRefunds = await prisma.refundRecord.findMany({
      where,
      select: {
        id: true,
        refundNumber: true,
        returnOrderId: true,
        returnOrderNumber: true,
        salesOrderId: true,
        customerId: true,
        refundType: true,
        refundMethod: true,
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        status: true,
        refundDate: true,
        processedDate: true,
        reason: true,
        remarks: true,
        bankInfo: true,
        receiptNumber: true,
        createdAt: true,
        updatedAt: true,
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
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    console.log(`✅ 查询测试成功，获取到 ${testRefunds.length} 条记录`);

    // 5. 测试格式化数据
    console.log('\n5. 测试格式化数据...');
    const formattedRefunds = testRefunds.map(refund => ({
      id: refund.id,
      refundNumber: refund.refundNumber,
      returnOrderId: refund.returnOrderId,
      returnOrderNumber: refund.returnOrderNumber,
      salesOrderId: refund.salesOrderId,
      salesOrderNumber: refund.salesOrder?.orderNumber || '',
      customerId: refund.customerId,
      customerName: refund.customer?.name || '',
      refundType: refund.refundType,
      refundMethod: refund.refundMethod,
      refundAmount: refund.refundAmount,
      processedAmount: refund.processedAmount,
      remainingAmount: refund.remainingAmount,
      status: refund.status,
      refundDate: refund.refundDate.toISOString().split('T')[0],
      processedDate: refund.processedDate?.toISOString().split('T')[0] || null,
      reason: refund.reason,
      remarks: refund.remarks,
      bankInfo: refund.bankInfo,
      receiptNumber: refund.receiptNumber,
      createdAt: refund.createdAt.toISOString(),
      updatedAt: refund.updatedAt.toISOString(),
      customer: refund.customer,
      salesOrder: refund.salesOrder,
      user: refund.user,
    }));

    console.log(`✅ 数据格式化成功，处理了 ${formattedRefunds.length} 条记录`);

    console.log('\n✅ 所有测试通过！数据库连接和查询都正常工作');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();
