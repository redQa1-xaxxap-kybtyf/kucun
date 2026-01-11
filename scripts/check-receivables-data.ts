/**
 * 检查应收款数据脚本
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 检查应收款数据...\n');

  try {
    const where = {
      status: { in: ['confirmed', 'shipped', 'completed'] },
    };

    const take = 50;
    const totalOrders = await prisma.salesOrder.count({ where });

    // 查询销售订单（默认只展示最近一部分，避免脚本输出/内存失控）
    const orders = await prisma.salesOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        roundingAdjustment: true,
        customer: {
          select: {
            name: true,
          },
        },
        payments: {
          where: {
            status: { in: ['confirmed', 'pending'] },
          },
          select: {
            actualPaymentAmount: true,
            status: true,
          },
        },
      },
    });

    console.log(
      `📊 找到 ${totalOrders} 个订单（展示最近 ${orders.length} 个）\n`
    );

    orders.forEach((order, index) => {
      const confirmedPayments = order.payments.filter(
        p => p.status === 'confirmed'
      );
      const pendingPayments = order.payments.filter(
        p => p.status === 'pending'
      );

      const paidAmount = confirmedPayments.reduce(
        (sum, p) => sum + Number(p.actualPaymentAmount),
        0
      );
      const pendingAmount = pendingPayments.reduce(
        (sum, p) => sum + Number(p.actualPaymentAmount),
        0
      );

      const totalAmount = Number(order.totalAmount);
      const roundingAdjustment = Number(order.roundingAdjustment || 0);
      const actualTotalAmount = totalAmount + roundingAdjustment;
      const remainingAmount = Math.max(
        0,
        actualTotalAmount - paidAmount - pendingAmount
      );

      console.log(`${index + 1}. 订单 ${order.orderNumber}`);
      console.log(`   客户: ${order.customer.name}`);
      console.log(`   订单金额: ￥${totalAmount.toFixed(2)}`);
      console.log(`   抹零金额: ￥${roundingAdjustment.toFixed(2)}`);
      console.log(
        `   实际应收: ￥${actualTotalAmount.toFixed(2)} (${totalAmount} + ${roundingAdjustment})`
      );
      console.log(`   已收金额: ￥${paidAmount.toFixed(2)}`);
      console.log(`   待确认: ￥${pendingAmount.toFixed(2)}`);
      console.log(`   待收金额: ￥${remainingAmount.toFixed(2)}`);
      console.log(
        `   计算验证: ${actualTotalAmount} - ${paidAmount} - ${pendingAmount} = ${remainingAmount}`
      );
      console.log('');
    });

    // 检查原始数据类型
    if (orders.length > 0) {
      const firstOrder = orders[0];
      console.log('\n🔬 数据类型检查:');
      console.log(`   totalAmount 类型: ${typeof firstOrder.totalAmount}`);
      console.log(
        `   totalAmount 值: ${firstOrder.totalAmount} (${firstOrder.totalAmount.constructor.name})`
      );
      console.log(
        `   roundingAdjustment 类型: ${typeof firstOrder.roundingAdjustment}`
      );
      console.log(
        `   roundingAdjustment 值: ${firstOrder.roundingAdjustment} (${firstOrder.roundingAdjustment?.constructor.name || 'null'})`
      );
    }
  } catch (error) {
    console.error('\n❌ 检查失败:', error);
    throw error;
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
