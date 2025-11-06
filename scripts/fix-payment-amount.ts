/**
 * 修复收款记录 SK-20251023-002 的收款金额
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPaymentAmount() {
  try {
    console.log('🔧 开始修复收款金额...\n');

    // 查找收款记录
    const payment = await prisma.paymentRecord.findFirst({
      where: {
        paymentNumber: 'SK-20251023-002',
      },
      include: {
        salesOrder: {
          select: {
            orderNumber: true,
            totalAmount: true,
            roundingAdjustment: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!payment) {
      console.log('❌ 收款记录 SK-20251023-002 不存在');
      return;
    }

    if (!payment.salesOrder) {
      console.log('❌ 关联销售订单不存在，无法计算应收金额');
      return;
    }

    console.log('📋 收款记录信息：');
    console.log(`收款单号: ${payment.paymentNumber}`);
    console.log(`客户: ${payment.customer.name}`);
    console.log(`订单号: ${payment.salesOrder.orderNumber}`);
    console.log(`当前收款金额: ￥${Number(payment.paymentAmount).toFixed(2)}`);
    console.log(
      `状态: ${payment.status === 'confirmed' ? '已确认' : '待确认'}`
    );
    console.log('');

    const totalAmount = Number(payment.salesOrder.totalAmount);
    const roundingAdjustment = Number(
      payment.salesOrder.roundingAdjustment || 0
    );
    const actualTotalAmount = totalAmount + roundingAdjustment;

    console.log('📊 订单金额信息：');
    console.log(`订单金额: ￥${totalAmount.toFixed(2)}`);
    console.log(`抹零金额: ￥${roundingAdjustment.toFixed(2)}`);
    console.log(`实际应收: ￥${actualTotalAmount.toFixed(2)}`);
    console.log('');

    // 更新收款金额
    const newPaymentAmount = actualTotalAmount;
    console.log(`🔄 更新收款金额为: ￥${newPaymentAmount.toFixed(2)}\n`);

    const updatedPayment = await prisma.paymentRecord.update({
      where: {
        id: payment.id,
      },
      data: {
        paymentAmount: newPaymentAmount,
      },
    });

    console.log('✅ 更新成功！\n');

    console.log('📊 更新后的数据：');
    console.log(
      `收款金额: ￥${Number(updatedPayment.paymentAmount).toFixed(2)}`
    );
    console.log('');

    // 验证
    if (
      Math.abs(Number(updatedPayment.paymentAmount) - actualTotalAmount) < 0.01
    ) {
      console.log('✅ 收款金额 = 实际应收，数据正确！');
    } else {
      console.log('⚠️  收款金额与实际应收不一致');
    }
  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixPaymentAmount();
