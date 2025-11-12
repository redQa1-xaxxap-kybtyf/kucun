/**
 * 应收货款诊断脚本
 * 用于验证销售订单数据和应收货款查询逻辑
 *
 * 运行方式:
 * npx tsx scripts/debug-receivables.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 开始诊断应收货款数据...\n');

  // 1. 查询最近创建的销售订单
  console.log('📊 最近创建的 10 个销售订单:');
  console.log('='.repeat(80));

  const recentOrders = await prisma.salesOrder.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
  });

  recentOrders.forEach((order, index) => {
    console.log(`\n${index + 1}. 订单编号: ${order.orderNumber}`);
    console.log(`   订单 ID: ${order.id}`);
    console.log(
      `   状态: ${order.status} ${order.status === 'confirmed' ? '✅' : order.status === 'draft' ? '⚠️' : '✅'}`
    );
    console.log(`   客户: ${order.customer.name}`);
    console.log(`   金额: ¥${order.totalAmount.toFixed(2)}`);
    console.log(`   创建时间: ${order.createdAt.toISOString()}`);
  });

  // 2. 统计各状态的订单数量
  console.log('\n\n📈 订单状态统计:');
  console.log('='.repeat(80));

  const statusCounts = await prisma.salesOrder.groupBy({
    by: ['status'],
    _count: {
      id: true,
    },
  });

  statusCounts.forEach(({ status, _count }) => {
    const isReceivable = ['confirmed', 'shipped', 'completed'].includes(status);
    console.log(
      `${status.padEnd(15)} : ${_count.id.toString().padStart(5)} 个订单 ${isReceivable ? '✅ (应收货款)' : '⚠️  (不在应收货款)'}`
    );
  });

  // 3. 查询符合应收货款条件的订单
  console.log(
    '\n\n💰 符合应收货款条件的订单 (status IN [confirmed, shipped, completed]):'
  );
  console.log('='.repeat(80));

  const receivableOrders = await prisma.salesOrder.findMany({
    where: {
      status: { in: ['confirmed', 'shipped', 'completed'] },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
  });

  console.log(`\n总计: ${receivableOrders.length} 个订单\n`);

  receivableOrders.forEach((order, index) => {
    const unpaidAmount = order.totalAmount - order.paidAmount;
    const paymentStatus =
      unpaidAmount <= 0
        ? '已付清'
        : unpaidAmount < order.totalAmount
          ? '部分支付'
          : '未支付';

    console.log(`${index + 1}. ${order.orderNumber}`);
    console.log(`   客户: ${order.customer.name}`);
    console.log(`   状态: ${order.status}`);
    console.log(`   总额: ¥${order.totalAmount.toFixed(2)}`);
    console.log(`   已付: ¥${order.paidAmount.toFixed(2)}`);
    console.log(`   未付: ¥${unpaidAmount.toFixed(2)} (${paymentStatus})`);
    console.log(`   创建: ${order.createdAt.toISOString()}`);
    console.log('');
  });

  // 4. 检查最近 1 小时内创建的订单
  console.log('\n⏰ 最近 1 小时内创建的订单:');
  console.log('='.repeat(80));

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCreated = await prisma.salesOrder.findMany({
    where: {
      createdAt: {
        gte: oneHourAgo,
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
  });

  if (recentCreated.length === 0) {
    console.log('\n❌ 没有在最近 1 小时内创建的订单');
  } else {
    console.log(`\n✅ 找到 ${recentCreated.length} 个订单:\n`);
    recentCreated.forEach((order, index) => {
      const isReceivable = ['confirmed', 'shipped', 'completed'].includes(
        order.status
      );
      console.log(`${index + 1}. ${order.orderNumber}`);
      console.log(
        `   状态: ${order.status} ${isReceivable ? '✅ (应收货款)' : '⚠️  (不在应收货款)'}`
      );
      console.log(`   客户: ${order.customer.name}`);
      console.log(`   金额: ¥${order.totalAmount.toFixed(2)}`);
      console.log(`   创建: ${order.createdAt.toISOString()}`);
      console.log('');
    });
  }

  // 5. 检查是否有 draft 状态的订单
  console.log('\n📝 草稿状态的订单 (不会出现在应收货款):');
  console.log('='.repeat(80));

  const draftOrders = await prisma.salesOrder.findMany({
    where: {
      status: 'draft',
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      totalAmount: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
  });

  if (draftOrders.length === 0) {
    console.log('\n✅ 没有草稿状态的订单');
  } else {
    console.log(`\n⚠️  找到 ${draftOrders.length} 个草稿订单:\n`);
    draftOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.orderNumber}`);
      console.log(`   客户: ${order.customer.name}`);
      console.log(`   金额: ¥${order.totalAmount.toFixed(2)}`);
      console.log(`   创建: ${order.createdAt.toISOString()}`);
      console.log('');
    });
  }

  console.log('\n✅ 诊断完成!\n');
}

main()
  .catch(e => {
    console.error('❌ 诊断过程中出错:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
