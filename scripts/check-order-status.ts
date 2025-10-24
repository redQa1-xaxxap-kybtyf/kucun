/**
 * 检查订单状态
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrderStatus() {
  try {
    console.log('🔍 检查订单状态...\n');

    const order = await prisma.salesOrder.findFirst({
      where: {
        orderNumber: 'SO202510230100',
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        payments: {
          select: {
            paymentNumber: true,
            paymentAmount: true,
            status: true,
          },
        },
      },
    });

    if (!order) {
      console.log('❌ 订单不存在');
      return;
    }

    console.log('📋 订单信息：');
    console.log(`订单号: ${order.orderNumber}`);
    console.log(`客户: ${order.customer.name}`);
    console.log(`状态: ${order.status}`);
    console.log(`订单金额: ¥${Number(order.totalAmount).toFixed(2)}`);
    console.log(`抹零金额: ¥${Number(order.roundingAdjustment || 0).toFixed(2)}`);
    console.log(
      `实际应收: ¥${(Number(order.totalAmount) + Number(order.roundingAdjustment || 0)).toFixed(2)}`
    );
    console.log('');

    console.log('💰 收款记录：');
    if (order.payments.length === 0) {
      console.log('  无收款记录');
    } else {
      order.payments.forEach((payment, index) => {
        console.log(`  ${index + 1}. ${payment.paymentNumber}`);
        console.log(`     金额: ¥${Number(payment.paymentAmount).toFixed(2)}`);
        console.log(`     状态: ${payment.status === 'confirmed' ? '已确认' : '待确认'}`);
      });
    }
    console.log('');

    const totalAmount = Number(order.totalAmount);
    const roundingAdjustment = Number(order.roundingAdjustment || 0);
    const actualTotalAmount = totalAmount + roundingAdjustment;

    const confirmedPayments = order.payments.filter(p => p.status === 'confirmed');
    const pendingPayments = order.payments.filter(p => p.status === 'pending');
    const confirmedAmount = confirmedPayments.reduce(
      (sum, p) => sum + Number(p.paymentAmount),
      0
    );
    const pendingAmount = pendingPayments.reduce(
      (sum, p) => sum + Number(p.paymentAmount),
      0
    );
    const remainingAmount = actualTotalAmount - confirmedAmount - pendingAmount;

    console.log('📊 应收分析：');
    console.log(`实际应收: ¥${actualTotalAmount.toFixed(2)}`);
    console.log(`已确认: ¥${confirmedAmount.toFixed(2)}`);
    console.log(`待确认: ¥${pendingAmount.toFixed(2)}`);
    console.log(`待收金额: ¥${remainingAmount.toFixed(2)}`);
    console.log('');

    if (Math.abs(remainingAmount) < 0.01) {
      console.log('✅ 待收金额为 0，订单已完全收款！');
    } else if (remainingAmount > 0) {
      console.log(`⚠️  还需收款 ¥${remainingAmount.toFixed(2)}`);
    } else {
      console.log(`⚠️  多收了 ¥${Math.abs(remainingAmount).toFixed(2)}`);
    }
  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkOrderStatus();

