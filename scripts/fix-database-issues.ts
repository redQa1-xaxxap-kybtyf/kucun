/**
 * 修复数据库问题脚本
 * 根据健康检查结果修复发现的问题
 * 运行: npx tsx scripts/fix-database-issues.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FixResult {
  category: string;
  issue: string;
  fixed: number;
  failed: number;
  details: string[];
}

const results: FixResult[] = [];

function addResult(result: FixResult) {
  results.push(result);
  console.log(`\n${result.fixed > 0 ? '✅' : '⚠️'} ${result.issue}`);
  console.log(`   修复: ${result.fixed}条, 失败: ${result.failed}条`);
  if (result.details.length > 0) {
    result.details.slice(0, 3).forEach(detail => console.log(`   - ${detail}`));
    if (result.details.length > 3) {
      console.log(`   ... 还有 ${result.details.length - 3} 条`);
    }
  }
}

// 1. 修复收款状态问题
async function fixPaymentStatus() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 1. 修复收款状态问题');
  console.log('='.repeat(80));

  const invalidPaymentStatus = await prisma.$queryRaw<
    Array<{ id: string; paymentNumber: string; status: string }>
  >`
    SELECT id, payment_number as paymentNumber, status
    FROM payment_records
    WHERE status NOT IN ('pending', 'confirmed', 'cancelled')
  `;

  console.log(`\n发现 ${invalidPaymentStatus.length} 条状态非法的收款记录`);

  if (invalidPaymentStatus.length === 0) {
    console.log('✅ 无需修复');
    return;
  }

  let fixed = 0;
  let failed = 0;
  const details: string[] = [];

  for (const record of invalidPaymentStatus) {
    try {
      // 根据状态值判断应该修正为什么状态
      let newStatus = 'pending';
      if (record.status === 'completed' || record.status === 'applied') {
        newStatus = 'confirmed';
      }

      await prisma.paymentRecord.update({
        where: { id: record.id },
        data: { status: newStatus },
      });

      fixed++;
      details.push(
        `收款单 ${record.paymentNumber}: ${record.status} → ${newStatus}`
      );
    } catch (error) {
      failed++;
      console.error(`❌ 修复失败: ${record.paymentNumber}`, error);
    }
  }

  addResult({
    category: '数据一致性',
    issue: '收款状态非法',
    fixed,
    failed,
    details,
  });
}

// 2. 修复订单金额与明细不一致
async function fixOrderAmounts() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 2. 修复订单金额与明细不一致');
  console.log('='.repeat(80));

  const inconsistentOrders = await prisma.$queryRaw<
    Array<{
      id: string;
      orderNumber: string;
      totalAmount: number;
      itemsTotal: number;
    }>
  >`
    SELECT 
      so.id,
      so.order_number as orderNumber,
      so.total_amount as totalAmount,
      COALESCE(SUM(soi.subtotal), 0) as itemsTotal
    FROM sales_orders so
    LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
    GROUP BY so.id, so.order_number, so.total_amount
    HAVING ABS(so.total_amount - COALESCE(SUM(soi.subtotal), 0)) > 0.01
  `;

  console.log(`\n发现 ${inconsistentOrders.length} 条金额不一致的订单`);

  if (inconsistentOrders.length === 0) {
    console.log('✅ 无需修复');
    return;
  }

  let fixed = 0;
  let failed = 0;
  const details: string[] = [];

  for (const order of inconsistentOrders) {
    try {
      // 重新计算订单金额
      const itemsAgg = await prisma.salesOrderItem.aggregate({
        where: { salesOrderId: order.id },
        _sum: { subtotal: true },
      });

      const correctTotal = Number(itemsAgg._sum.subtotal ?? 0);

      // 获取费用项
      const feeAgg = await prisma.salesOrderFeeItem.aggregate({
        where: { salesOrderId: order.id },
        _sum: { feeAmount: true },
      });

      const totalFees = Number(feeAgg._sum.feeAmount ?? 0);
      const finalTotal = correctTotal + totalFees;

      await prisma.salesOrder.update({
        where: { id: order.id },
        data: { totalAmount: finalTotal },
      });

      fixed++;
      details.push(
        `订单 ${order.orderNumber}: ${order.totalAmount} → ${finalTotal} (明细: ${correctTotal}, 费用: ${totalFees})`
      );
    } catch (error) {
      failed++;
      console.error(`❌ 修复失败: ${order.orderNumber}`, error);
    }
  }

  addResult({
    category: '数据一致性',
    issue: '订单金额与明细不一致',
    fixed,
    failed,
    details,
  });
}

// 3. 删除孤儿数据
async function deleteOrphanedRecords() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 3. 删除孤儿数据');
  console.log('='.repeat(80));

  // 3.1 删除孤儿订单明细
  const orphanedItems = await prisma.$queryRaw<
    Array<{ id: string; salesOrderId: string }>
  >`
    SELECT soi.id, soi.sales_order_id as salesOrderId
    FROM sales_order_items soi
    LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
    WHERE so.id IS NULL
  `;

  if (orphanedItems.length > 0) {
    console.log(`\n发现 ${orphanedItems.length} 条孤儿订单明细`);
    const result = await prisma.salesOrderItem.deleteMany({
      where: {
        id: {
          in: orphanedItems.map(item => item.id),
        },
      },
    });
    console.log(`✅ 已删除 ${result.count} 条孤儿订单明细`);
  }

  // 3.2 删除孤儿交易记录
  const orphanedTransactions = await prisma.$queryRaw<
    Array<{ id: string; statementId: string }>
  >`
    SELECT st.id, st.statement_id as statementId
    FROM statement_transactions st
    LEFT JOIN account_statements ast ON st.statement_id = ast.id
    WHERE ast.id IS NULL
  `;

  if (orphanedTransactions.length > 0) {
    console.log(`\n发现 ${orphanedTransactions.length} 条孤儿交易记录`);
    const result = await prisma.statementTransaction.deleteMany({
      where: {
        id: {
          in: orphanedTransactions.map(tx => tx.id),
        },
      },
    });
    console.log(`✅ 已删除 ${result.count} 条孤儿交易记录`);
  }

  // 3.3 删除孤儿库存记录
  const orphanedInventory = await prisma.$queryRaw<
    Array<{ id: string; productId: string }>
  >`
    SELECT i.id, i.product_id as productId
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE p.id IS NULL
  `;

  if (orphanedInventory.length > 0) {
    console.log(`\n发现 ${orphanedInventory.length} 条孤儿库存记录`);
    const result = await prisma.inventory.deleteMany({
      where: {
        id: {
          in: orphanedInventory.map(inv => inv.id),
        },
      },
    });
    console.log(`✅ 已删除 ${result.count} 条孤儿库存记录`);
  }
}

// 主函数
async function main() {
  console.log('\n');
  console.log('🔧 数据库问题修复工具');
  console.log('='.repeat(80));
  console.log('开始时间:', new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(80));

  try {
    // 执行修复
    await fixPaymentStatus();
    await fixOrderAmounts();
    await deleteOrphanedRecords();

    // 生成报告
    console.log('\n' + '='.repeat(80));
    console.log('📊 修复报告汇总');
    console.log('='.repeat(80) + '\n');

    const totalFixed = results.reduce((sum, r) => sum + r.fixed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    console.log(`总修复数: ${totalFixed}`);
    console.log(`总失败数: ${totalFailed}\n`);

    if (results.length > 0) {
      console.log('详细结果:\n');
      results.forEach((r, index) => {
        console.log(`${index + 1}. ${r.issue}`);
        console.log(`   修复: ${r.fixed}条, 失败: ${r.failed}条`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ 修复完成!');
    console.log('='.repeat(80));
    console.log('\n建议操作:');
    console.log(
      '1. 重新运行健康检查: npx tsx scripts/database-health-check.ts'
    );
    console.log('2. 测试相关功能确保正常工作');
    console.log('3. 如有问题可从备份恢复\n');

    console.log('='.repeat(80));
    console.log('完成时间:', new Date().toLocaleString('zh-CN'));
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
