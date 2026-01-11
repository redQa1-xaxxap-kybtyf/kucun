/**
 * 调试数据库问题
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. 检查收款状态
  console.log('1. 检查收款状态问题:\n');
  const payment = await prisma.paymentRecord.findFirst({
    where: { paymentNumber: 'SK-20251022-008' },
  });
  console.log('收款记录:', payment);
  console.log('状态:', payment?.status);
  console.log('合法状态: pending, confirmed, cancelled');
  console.log('');

  // 2. 检查订单金额
  console.log('2. 检查订单金额问题:\n');
  const order = await prisma.salesOrder.findFirst({
    where: { orderNumber: 'SO202510220107' },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
      feeItems: true,
    },
  });

  console.log('订单总额:', order?.totalAmount);

  const itemsTotal =
    order?.items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0) || 0;
  console.log('明细合计:', itemsTotal);

  const feesTotal =
    order?.feeItems.reduce((sum, fee) => sum + Number(fee.feeAmount ?? 0), 0) ||
    0;
  console.log('费用合计:', feesTotal);

  console.log('应该的总额:', itemsTotal + feesTotal);

  console.log('\n明细列表:');
  order?.items.forEach((item, index) => {
    const manualName =
      'manualProductName' in item
        ? ((item as { manualProductName?: string }).manualProductName ?? '')
        : '';
    const itemName = (item.product?.name ?? manualName) || '未知产品';
    console.log(
      `  ${index + 1}. ${itemName} x ${item.quantity} = ${item.subtotal}`
    );
  });

  console.log('\n费用列表:');
  order?.feeItems.forEach((fee, index) => {
    console.log(`  ${index + 1}. ${fee.feeName}: ${fee.feeAmount}`);
  });

  await prisma.$disconnect();
}

main();
