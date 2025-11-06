/**
 * 修复订单 SO202510230100 的抹零金额
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrderRounding() {
  try {
    console.log('🔧 开始修复订单抹零金额...\n');

    // 查找订单
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
            id: true,
            paymentAmount: true,
            status: true,
          },
        },
      },
    });

    if (!order) {
      console.log('❌ 订单 SO202510230100 不存在');
      return;
    }

    console.log('📋 订单信息：');
    console.log(`订单号: ${order.orderNumber}`);
    console.log(`客户: ${order.customer.name}`);
    console.log(`订单金额: ￥${Number(order.totalAmount).toFixed(2)}`);
    console.log(
      `当前抹零金额: ￥${Number(order.roundingAdjustment || 0).toFixed(2)}`
    );
    console.log(`已收金额: ￥${Number(order.paidAmount).toFixed(2)}`);
    console.log('');

    // 计算收款信息
    const confirmedPayments = order.payments.filter(
      p => p.status === 'confirmed'
    );
    const pendingPayments = order.payments.filter(p => p.status === 'pending');
    const confirmedAmount = confirmedPayments.reduce(
      (sum, p) => sum + Number(p.paymentAmount),
      0
    );
    const pendingAmount = pendingPayments.reduce(
      (sum, p) => sum + Number(p.paymentAmount),
      0
    );

    console.log('💰 收款信息：');
    console.log(`已确认收款: ￥${confirmedAmount.toFixed(2)}`);
    console.log(`待确认收款: ￥${pendingAmount.toFixed(2)}`);
    console.log('');

    // 更新抹零金额
    const newRoundingAdjustment = -6.5;
    console.log(`🔄 更新抹零金额为: ￥${newRoundingAdjustment.toFixed(2)}\n`);

    const updatedOrder = await prisma.salesOrder.update({
      where: {
        id: order.id,
      },
      data: {
        roundingAdjustment: newRoundingAdjustment,
      },
    });

    console.log('✅ 更新成功！\n');

    // 验证更新后的数据
    const totalAmount = Number(updatedOrder.totalAmount);
    const roundingAdjustment = Number(updatedOrder.roundingAdjustment || 0);
    const actualTotalAmount = totalAmount + roundingAdjustment;
    const remainingAmount = actualTotalAmount - confirmedAmount - pendingAmount;

    console.log('📊 更新后的数据：');
    console.log(`订单金额: ￥${totalAmount.toFixed(2)}`);
    console.log(`抹零金额: ￥${roundingAdjustment.toFixed(2)}`);
    console.log(
      `实际应收: ￥${actualTotalAmount.toFixed(2)} (${totalAmount.toFixed(2)} + ${roundingAdjustment.toFixed(2)})`
    );
    console.log(`已确认: ￥${confirmedAmount.toFixed(2)}`);
    console.log(`待确认: ￥${pendingAmount.toFixed(2)}`);
    console.log(
      `待收金额: ￥${remainingAmount.toFixed(2)} (${actualTotalAmount.toFixed(2)} - ${confirmedAmount.toFixed(2)} - ${pendingAmount.toFixed(2)})`
    );
    console.log('');

    if (Math.abs(remainingAmount) < 0.01) {
      console.log('✅ 待收金额为 0，订单已完全收款！');
    } else {
      console.log(`⚠️  待收金额为 ￥${remainingAmount.toFixed(2)}`);
    }
  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixOrderRounding();
