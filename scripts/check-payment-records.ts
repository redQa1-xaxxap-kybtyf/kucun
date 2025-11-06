/* eslint-disable no-console */
/**
 * 检查订单 SO202510230100 的收款记录
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORDER_NUMBER = 'SO202510230100';

type PaymentRecord = {
  paymentNumber: string;
  paymentAmount: number | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'applied' | string;
  paymentDate: Date;
  createdAt: Date;
};

type OrderWithPayments = {
  orderNumber: string;
  totalAmount: number;
  roundingAdjustment: number | null;
  customer: {
    name: string;
  };
  payments: PaymentRecord[];
};

interface PaymentStats {
  confirmedPayments: PaymentRecord[];
  pendingPayments: PaymentRecord[];
  confirmedAmount: number;
  pendingAmount: number;
  totalAmount: number;
  actualTotalAmount: number;
  remainingAmount: number;
}

const currency = (value: number): string => `￥${value.toFixed(2)}`;

function printOrderBasics(order: OrderWithPayments) {
  console.log('📋 订单信息：');
  console.log(`订单号: ${order.orderNumber}`);
  console.log(`客户: ${order.customer.name}`);
  console.log(`订单金额: ${currency(Number(order.totalAmount))}`);
  console.log(`抹零金额: ${currency(Number(order.roundingAdjustment || 0))}`);
  console.log(
    `实际应收: ${currency(
      Number(order.totalAmount) + Number(order.roundingAdjustment || 0)
    )}`
  );
  console.log('');
}

function printPaymentRecords(payments: PaymentRecord[]) {
  console.log('💰 收款记录：');
  if (!payments.length) {
    console.log('  无收款记录\n');
    return;
  }

  payments.forEach((payment, index) => {
    console.log(`\n  收款 ${index + 1}:`);
    console.log(`    收款单号: ${payment.paymentNumber}`);
    console.log(
      `    收款金额: ${currency(Number(payment.paymentAmount || 0))}`
    );
    console.log(
      `    状态: ${payment.status === 'confirmed' ? '已确认' : '待确认'}`
    );
    console.log(
      `    收款日期: ${payment.paymentDate.toISOString().split('T')[0]}`
    );
    console.log(`    创建时间: ${payment.createdAt.toISOString()}`);
  });
  console.log('\n');
}

function calculatePaymentStats(order: OrderWithPayments): PaymentStats {
  const confirmedPayments = order.payments.filter(
    p => p.status === 'confirmed'
  );
  const pendingPayments = order.payments.filter(p => p.status === 'pending');
  const confirmedAmount = confirmedPayments.reduce(
    (sum, p) => sum + Number(p.paymentAmount || 0),
    0
  );
  const pendingAmount = pendingPayments.reduce(
    (sum, p) => sum + Number(p.paymentAmount || 0),
    0
  );

  const totalAmount = Number(order.totalAmount || 0);
  const roundingAdjustment = Number(order.roundingAdjustment || 0);
  const actualTotalAmount = totalAmount + roundingAdjustment;
  const remainingAmount = actualTotalAmount - confirmedAmount - pendingAmount;

  return {
    confirmedPayments,
    pendingPayments,
    confirmedAmount,
    pendingAmount,
    totalAmount,
    actualTotalAmount,
    remainingAmount,
  };
}

function printPaymentStats(stats: PaymentStats) {
  console.log('📊 收款统计：');
  console.log(
    `已确认收款: ${currency(stats.confirmedAmount)} (${stats.confirmedPayments.length} 笔)`
  );
  console.log(
    `待确认收款: ${currency(stats.pendingAmount)} (${stats.pendingPayments.length} 笔)`
  );
  console.log(
    `总收款: ${currency(stats.confirmedAmount + stats.pendingAmount)}\n`
  );
}

function analyzeReceivables(stats: PaymentStats) {
  console.log('💡 应收分析：');
  console.log(`实际应收: ${currency(stats.actualTotalAmount)}`);
  console.log(
    `已收+待收: ${currency(stats.confirmedAmount + stats.pendingAmount)}`
  );
  console.log(`待收金额: ${currency(stats.remainingAmount)}\n`);

  if (Math.abs(stats.remainingAmount) < 0.01) {
    console.log('✅ 待收金额为 0，订单已完全收款！');
  } else if (stats.remainingAmount > 0) {
    console.log(`⚠️  还需收款 ${currency(stats.remainingAmount)}`);
  } else {
    console.log(`⚠️  多收了 ${currency(Math.abs(stats.remainingAmount))}`);
  }
}

function reviewPendingPayments(order: OrderWithPayments, stats: PaymentStats) {
  if (!stats.pendingPayments.length) {
    return;
  }

  console.log('\n🔍 收款金额检查：');
  stats.pendingPayments.forEach(payment => {
    const paymentAmount = Number(payment.paymentAmount || 0);
    if (Math.abs(paymentAmount - stats.actualTotalAmount) < 0.01) {
      console.log(
        `  ✅ 收款 ${payment.paymentNumber}: ${currency(paymentAmount)} = 实际应收`
      );
    } else if (Math.abs(paymentAmount - stats.totalAmount) < 0.01) {
      console.log(
        `  ⚠️  收款 ${payment.paymentNumber}: ${currency(paymentAmount)} = 订单金额（未考虑抹零）`
      );
      console.log(
        `      建议修改为: ${currency(stats.actualTotalAmount)} (订单金额 + 抹零)`
      );
    } else {
      console.log(
        `  ❓ 收款 ${payment.paymentNumber}: ${currency(paymentAmount)}`
      );
    }
  });
}

async function fetchOrder(): Promise<OrderWithPayments | null> {
  return prisma.salesOrder.findFirst({
    where: {
      orderNumber: ORDER_NUMBER,
    },
    select: {
      orderNumber: true,
      totalAmount: true,
      roundingAdjustment: true,
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
          paymentDate: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
}

async function checkPaymentRecords() {
  try {
    console.log(`🔍 检查订单 ${ORDER_NUMBER} 的收款记录...\n`);

    const order = await fetchOrder();

    if (!order) {
      console.log(`❌ 订单 ${ORDER_NUMBER} 不存在`);
      return;
    }

    printOrderBasics(order);
    printPaymentRecords(order.payments);

    const stats = calculatePaymentStats(order);
    printPaymentStats(stats);
    analyzeReceivables(stats);
    reviewPendingPayments(order, stats);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPaymentRecords();
