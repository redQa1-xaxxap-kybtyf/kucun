/**
 * 采购费用数据验证脚本
 *
 * 验证采购订单费用链路的数据一致性问题
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ValidationResult {
  category: string;
  severity: 'error' | 'warning' | 'info';
  count: number;
  details: Array<Record<string, unknown>>;
  description: string;
}

const results: ValidationResult[] = [];

/**
 * 检查1: 采购费用的 supplierId 是否为 null
 */
async function checkMissingSupplierId(): Promise<void> {
  console.log('🔍 检查1: 采购费用的 supplierId...');

  const expensesWithoutSupplierId = await prisma.expenseRecord.findMany({
    where: {
      relatedType: 'purchase_order',
      supplierId: null,
    },
    select: {
      id: true,
      expenseNumber: true,
      expenseAmount: true,
      supplierId: true,
      relatedId: true,
      relatedNumber: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  // 获取对应的采购订单信息
  const relatedOrderIds = expensesWithoutSupplierId
    .map(e => e.relatedId)
    .filter(Boolean) as string[];
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      id: { in: relatedOrderIds },
    },
    select: {
      id: true,
      orderNumber: true,
      supplierId: true,
    },
  });

  const orderMap = new Map(orders.map(o => [o.id, o]));

  const details = expensesWithoutSupplierId.map(expense => {
    const order = orderMap.get(expense.relatedId || '');
    return {
      expenseNumber: expense.expenseNumber,
      expenseAmount: expense.expenseAmount,
      status: expense.status,
      paymentStatus: expense.paymentStatus,
      orderNumber: expense.relatedNumber,
      orderSupplierId: order?.supplierId || null,
      createdAt: expense.createdAt,
    };
  });

  results.push({
    category: '缺少 supplierId',
    severity: 'error',
    count: expensesWithoutSupplierId.length,
    details,
    description:
      '采购费用记录缺少 supplierId，无法在审批后创建应付款（Stage 3 阻断）',
  });

  console.log(
    `  ❌ 发现 ${expensesWithoutSupplierId.length} 条采购费用缺少 supplierId`
  );
}

/**
 * 检查2: 应付款金额是否包含费用
 */
async function checkPayableAmountAccuracy(): Promise<void> {
  console.log('🔍 检查2: 应付款金额准确性...');

  const payables = await prisma.payableRecord.findMany({
    where: {
      sourceType: 'purchase_order',
    },
    select: {
      id: true,
      payableNumber: true,
      payableAmount: true,
      sourceId: true,
      sourceNumber: true,
    },
    take: 100,
  });

  const orderIds = payables.map(p => p.sourceId).filter(Boolean) as string[];
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      id: { in: orderIds },
    },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      expenseAmount: true,
    },
  });

  const orderMap = new Map(orders.map(o => [o.id, o]));

  const inaccuratePayables = [];
  for (const payable of payables) {
    const order = orderMap.get(payable.sourceId || '');
    if (!order) continue;

    const totalAmount = Number(order.totalAmount);
    const expenseAmount = Number(order.expenseAmount) || 0;
    const expectedPayableAmount = totalAmount + expenseAmount;
    const actualPayableAmount = Number(payable.payableAmount);
    const difference = Math.abs(actualPayableAmount - expectedPayableAmount);

    if (difference > 0.01) {
      inaccuratePayables.push({
        payableNumber: payable.payableNumber,
        payableAmount: actualPayableAmount,
        orderTotalAmount: totalAmount,
        orderExpenseAmount: expenseAmount,
        expectedPayableAmount,
        difference: difference.toFixed(2),
      });
    }
  }

  results.push({
    category: '应付款金额不准确',
    severity: 'error',
    count: inaccuratePayables.length,
    details: inaccuratePayables.slice(0, 20),
    description: '应付款金额未包含费用金额，导致财务核算不准确',
  });

  console.log(
    `  ${inaccuratePayables.length > 0 ? '❌' : '✅'} 发现 ${inaccuratePayables.length} 条应付款金额不准确`
  );
}

/**
 * 检查3: 费用与应付款的关联情况
 */
async function checkExpensePayableLink(): Promise<void> {
  console.log('🔍 检查3: 费用与应付款关联关系...');

  // 检查已审批但未关联应付款的费用
  const approvedExpensesWithoutPayable = await prisma.expenseRecord.findMany({
    where: {
      relatedType: 'purchase_order',
      status: 'approved',
      payableId: null,
    },
    select: {
      id: true,
      expenseNumber: true,
      expenseAmount: true,
      status: true,
      paymentStatus: true,
      approvedAt: true,
      supplierId: true,
    },
    orderBy: {
      approvedAt: 'desc',
    },
    take: 50,
  });

  results.push({
    category: '已审批费用未关联应付款',
    severity: 'warning',
    count: approvedExpensesWithoutPayable.length,
    details: approvedExpensesWithoutPayable.map(e => ({
      expenseNumber: e.expenseNumber,
      expenseAmount: e.expenseAmount,
      status: e.status,
      paymentStatus: e.paymentStatus,
      approvedAt: e.approvedAt,
      hasSupplierId: !!e.supplierId,
    })),
    description: '已审批的采购费用未关联应付款，付款核销时无法更新费用支付状态',
  });

  console.log(
    `  ${approvedExpensesWithoutPayable.length > 0 ? '⚠️' : '✅'} 发现 ${approvedExpensesWithoutPayable.length} 条已审批费用未关联应付款`
  );

  // 检查关联了应付款的费用
  const expensesWithPayable = await prisma.expenseRecord.findMany({
    where: {
      relatedType: 'purchase_order',
      payableId: { not: null },
    },
    select: {
      id: true,
      expenseNumber: true,
      expenseAmount: true,
      status: true,
      paymentStatus: true,
      payableId: true,
      payable: {
        select: {
          payableNumber: true,
          status: true,
          payableAmount: true,
          remainingAmount: true,
        },
      },
    },
    take: 20,
  });

  results.push({
    category: '费用已关联应付款',
    severity: 'info',
    count: expensesWithPayable.length,
    details: expensesWithPayable.map(e => ({
      expenseNumber: e.expenseNumber,
      expenseAmount: e.expenseAmount,
      expenseStatus: e.status,
      expensePaymentStatus: e.paymentStatus,
      payableNumber: e.payable?.payableNumber,
      payableStatus: e.payable?.status,
      payableRemainingAmount: e.payable?.remainingAmount,
    })),
    description: '正确关联应付款的费用记录示例',
  });

  console.log(
    `  ℹ️  发现 ${expensesWithPayable.length} 条费用已正确关联应付款`
  );
}

/**
 * 检查4: Stage 3 兼容性综合评估
 */
async function checkStage3Compatibility(): Promise<void> {
  console.log('🔍 检查4: Stage 3 兼容性...');

  // 统计总体情况
  const totalPurchaseExpenses = await prisma.expenseRecord.count({
    where: {
      relatedType: 'purchase_order',
    },
  });

  const expensesWithSupplierId = await prisma.expenseRecord.count({
    where: {
      relatedType: 'purchase_order',
      supplierId: { not: null },
    },
  });

  const approvedExpenses = await prisma.expenseRecord.count({
    where: {
      relatedType: 'purchase_order',
      status: 'approved',
    },
  });

  const approvedExpensesWithPayable = await prisma.expenseRecord.count({
    where: {
      relatedType: 'purchase_order',
      status: 'approved',
      payableId: { not: null },
    },
  });

  const compatibility = {
    totalPurchaseExpenses,
    expensesWithSupplierId,
    expensesWithSupplierIdRate:
      totalPurchaseExpenses > 0
        ? `${((expensesWithSupplierId / totalPurchaseExpenses) * 100).toFixed(2)}%`
        : 'N/A',
    approvedExpenses,
    approvedExpensesWithPayable,
    approvedExpensesWithPayableRate:
      approvedExpenses > 0
        ? `${((approvedExpensesWithPayable / approvedExpenses) * 100).toFixed(2)}%`
        : 'N/A',
    stage3Compatible: expensesWithSupplierId === totalPurchaseExpenses,
  };

  results.push({
    category: 'Stage 3 兼容性评估',
    severity: compatibility.stage3Compatible ? 'info' : 'error',
    count: 1,
    details: [compatibility],
    description: 'Stage 3 应付账款集成兼容性综合评估',
  });

  console.log(
    `  📊 Stage 3 兼容性: ${compatibility.stage3Compatible ? '✅ 兼容' : '❌ 不兼容'}`
  );
  console.log(`     - 总费用数: ${totalPurchaseExpenses}`);
  console.log(
    `     - 有 supplierId: ${expensesWithSupplierId} (${compatibility.expensesWithSupplierIdRate})`
  );
  console.log(`     - 已审批: ${approvedExpenses}`);
  console.log(
    `     - 已关联应付款: ${approvedExpensesWithPayable} (${compatibility.approvedExpensesWithPayableRate})`
  );
}

/**
 * 生成验证报告
 */
function generateReport(): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 数据验证报告');
  console.log('='.repeat(60));

  let errorCount = 0;
  let warningCount = 0;

  for (const result of results) {
    const icon =
      result.severity === 'error'
        ? '❌'
        : result.severity === 'warning'
          ? '⚠️'
          : 'ℹ️';
    console.log(`\n${icon} ${result.category}`);
    console.log(`   ${result.description}`);
    console.log(`   发现数量: ${result.count}`);

    if (result.severity === 'error') {
      errorCount += result.count;
    } else if (result.severity === 'warning') {
      warningCount += result.count;
    }

    if (result.details.length > 0 && result.details.length <= 5) {
      console.log('   示例数据:');
      console.log(
        `   ${JSON.stringify(result.details, null, 2).split('\n').join('\n   ')}`
      );
    } else if (result.details.length > 5) {
      console.log(`   （仅显示前5条，共 ${result.details.length} 条）`);
      console.log(
        `   ${JSON.stringify(result.details.slice(0, 5), null, 2).split('\n').join('\n   ')}`
      );
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 验证汇总');
  console.log('='.repeat(60));
  console.log(`🔴 错误: ${errorCount} 条`);
  console.log(`🟡 警告: ${warningCount} 条`);
  console.log('='.repeat(60));

  if (errorCount > 0) {
    console.log('\n🚨 发现严重问题，建议立即执行 P0 修复');
    console.log(
      '   修复方案详见: claudedocs/purchase-order-expense-audit-report.md'
    );
  } else if (warningCount > 0) {
    console.log('\n⚠️  发现潜在问题，建议执行 P1 修复');
  } else {
    console.log('\n✅ 数据验证通过，无严重问题');
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    console.log('🚀 开始数据验证...\n');

    await checkMissingSupplierId();
    await checkPayableAmountAccuracy();
    await checkExpensePayableLink();
    await checkStage3Compatibility();

    generateReport();
  } catch (error) {
    logger.error('validate-purchase-expense-data', '数据验证失败', error);
    console.error('\n❌ 数据验证失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✅ 数据验证完成\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 验证脚本执行失败:', error);
    process.exit(1);
  });
