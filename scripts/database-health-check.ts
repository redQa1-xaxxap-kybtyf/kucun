/**
 * 数据库健康检查工具
 * 全面检查数据完整性、一致性和关联关系
 * 运行: npx tsx scripts/database-health-check.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CheckResult {
  category: string;
  table: string;
  issue: string;
  count: number;
  severity: 'error' | 'warning' | 'info';
  details?: string[];
  suggestion?: string;
}

const results: CheckResult[] = [];

function addResult(result: CheckResult) {
  results.push(result);
  const icon =
    result.severity === 'error'
      ? '❌'
      : result.severity === 'warning'
        ? '⚠️'
        : 'ℹ️';
  console.log(
    `${icon} [${result.category}] ${result.table}: ${result.issue} (${result.count}条)`
  );
  if (result.details && result.details.length > 0) {
    result.details.slice(0, 5).forEach(detail => console.log(`   - ${detail}`));
    if (result.details.length > 5) {
      console.log(`   ... 还有 ${result.details.length - 5} 条`);
    }
  }
}

// 1. 孤儿数据检查
async function checkOrphanedRecords() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 1. 孤儿数据检查');
  console.log('='.repeat(80) + '\n');

  // 1.1 检查销售订单的客户关联
  const salesOrdersWithoutCustomer = await prisma.$queryRaw<
    Array<{ id: string; orderNumber: string; customerId: string }>
  >`
    SELECT so.id, so.order_number as orderNumber, so.customer_id as customerId
    FROM sales_orders so
    LEFT JOIN customers c ON so.customer_id = c.id
    WHERE c.id IS NULL
  `;

  if (salesOrdersWithoutCustomer.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'sales_orders',
      issue: '客户不存在',
      count: salesOrdersWithoutCustomer.length,
      severity: 'error',
      details: salesOrdersWithoutCustomer.map(
        r => `订单 ${r.orderNumber} 引用了不存在的客户 ${r.customerId}`
      ),
      suggestion: '运行修复脚本将这些订单关联到默认客户或删除',
    });
  }

  // 1.2 检查销售订单的用户关联
  const salesOrdersWithoutUser = await prisma.$queryRaw<
    Array<{ id: string; orderNumber: string; userId: string }>
  >`
    SELECT so.id, so.order_number as orderNumber, so.user_id as userId
    FROM sales_orders so
    LEFT JOIN users u ON so.user_id = u.id
    WHERE u.id IS NULL
  `;

  if (salesOrdersWithoutUser.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'sales_orders',
      issue: '用户不存在',
      count: salesOrdersWithoutUser.length,
      severity: 'error',
      details: salesOrdersWithoutUser.map(
        r => `订单 ${r.orderNumber} 引用了不存在的用户 ${r.userId}`
      ),
      suggestion: '运行修复脚本将这些订单关联到管理员用户',
    });
  }

  // 1.3 检查销售订单明细的订单关联
  const salesOrderItemsWithoutOrder = await prisma.$queryRaw<
    Array<{ id: string; salesOrderId: string }>
  >`
    SELECT soi.id, soi.sales_order_id as salesOrderId
    FROM sales_order_items soi
    LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
    WHERE so.id IS NULL
  `;

  if (salesOrderItemsWithoutOrder.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'sales_order_items',
      issue: '订单不存在',
      count: salesOrderItemsWithoutOrder.length,
      severity: 'error',
      details: salesOrderItemsWithoutOrder.map(
        r => `订单明细 ${r.id} 引用了不存在的订单 ${r.salesOrderId}`
      ),
      suggestion: '删除这些孤儿明细记录',
    });
  }

  // 1.4 检查收款记录的客户关联
  const paymentRecordsWithoutCustomer = await prisma.$queryRaw<
    Array<{ id: string; paymentNumber: string; customerId: string }>
  >`
    SELECT pr.id, pr.payment_number as paymentNumber, pr.customer_id as customerId
    FROM payment_records pr
    LEFT JOIN customers c ON pr.customer_id = c.id
    WHERE c.id IS NULL
  `;

  if (paymentRecordsWithoutCustomer.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'payment_records',
      issue: '客户不存在',
      count: paymentRecordsWithoutCustomer.length,
      severity: 'error',
      details: paymentRecordsWithoutCustomer.map(
        r => `收款记录 ${r.paymentNumber} 引用了不存在的客户 ${r.customerId}`
      ),
      suggestion: '运行修复脚本将这些记录关联到默认客户',
    });
  }

  // 1.5 检查收款记录的订单关联（非预收款）
  const paymentRecordsWithoutOrder = await prisma.$queryRaw<
    Array<{ id: string; paymentNumber: string; salesOrderId: string }>
  >`
    SELECT pr.id, pr.payment_number as paymentNumber, pr.sales_order_id as salesOrderId
    FROM payment_records pr
    LEFT JOIN sales_orders so ON pr.sales_order_id = so.id
    WHERE pr.sales_order_id IS NOT NULL AND so.id IS NULL
  `;

  if (paymentRecordsWithoutOrder.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'payment_records',
      issue: '订单不存在',
      count: paymentRecordsWithoutOrder.length,
      severity: 'error',
      details: paymentRecordsWithoutOrder.map(
        r => `收款记录 ${r.paymentNumber} 引用了不存在的订单 ${r.salesOrderId}`
      ),
      suggestion: '检查这些收款记录是否应该标记为预收款',
    });
  }

  // 1.6 检查退款记录的订单关联
  const refundRecordsWithoutOrder = await prisma.$queryRaw<
    Array<{ id: string; refundNumber: string; salesOrderId: string }>
  >`
    SELECT rr.id, rr.refund_number as refundNumber, rr.sales_order_id as salesOrderId
    FROM refund_records rr
    LEFT JOIN sales_orders so ON rr.sales_order_id = so.id
    WHERE so.id IS NULL
  `;

  if (refundRecordsWithoutOrder.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'refund_records',
      issue: '订单不存在',
      count: refundRecordsWithoutOrder.length,
      severity: 'error',
      details: refundRecordsWithoutOrder.map(
        r => `退款记录 ${r.refundNumber} 引用了不存在的订单 ${r.salesOrderId}`
      ),
      suggestion: '删除这些孤儿退款记录',
    });
  }

  // 1.7 检查往来账单交易的账单关联
  const transactionsWithoutStatement = await prisma.$queryRaw<
    Array<{ id: string; statementId: string; referenceId: string }>
  >`
    SELECT st.id, st.statement_id as statementId, st.reference_id as referenceId
    FROM statement_transactions st
    LEFT JOIN account_statements ast ON st.statement_id = ast.id
    WHERE ast.id IS NULL
  `;

  if (transactionsWithoutStatement.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'statement_transactions',
      issue: '账单不存在',
      count: transactionsWithoutStatement.length,
      severity: 'error',
      details: transactionsWithoutStatement.map(
        r => `交易记录 ${r.id} 引用了不存在的账单 ${r.statementId}`
      ),
      suggestion: '删除这些孤儿交易记录',
    });
  }

  // 1.8 检查库存记录的产品关联
  const inventoryWithoutProduct = await prisma.$queryRaw<
    Array<{ id: string; productId: string; batchNumber: string | null }>
  >`
    SELECT i.id, i.product_id as productId, i.batch_number as batchNumber
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE p.id IS NULL
  `;

  if (inventoryWithoutProduct.length > 0) {
    addResult({
      category: '孤儿数据',
      table: 'inventory',
      issue: '产品不存在',
      count: inventoryWithoutProduct.length,
      severity: 'error',
      details: inventoryWithoutProduct.map(
        r =>
          `库存记录 ${r.id} 引用了不存在的产品 ${r.productId}${r.batchNumber ? ` (批次: ${r.batchNumber})` : ''}`
      ),
      suggestion: '删除这些孤儿库存记录',
    });
  }

  console.log('');
}

// 2. 数据重复检查
async function checkDuplicateRecords() {
  console.log('='.repeat(80));
  console.log('📋 2. 数据重复检查');
  console.log('='.repeat(80) + '\n');

  // 2.1 检查重复的订单号
  const duplicateOrderNumbers = await prisma.$queryRaw<
    Array<{ orderNumber: string; count: bigint; ids: string }>
  >`
    SELECT order_number as orderNumber, COUNT(*) as count, GROUP_CONCAT(id) as ids
    FROM sales_orders
    GROUP BY order_number
    HAVING COUNT(*) > 1
  `;

  if (duplicateOrderNumbers.length > 0) {
    addResult({
      category: '数据重复',
      table: 'sales_orders',
      issue: '订单号重复',
      count: duplicateOrderNumbers.length,
      severity: 'error',
      details: duplicateOrderNumbers.map(
        r => `订单号 ${r.orderNumber} 重复 ${r.count} 次, IDs: ${r.ids}`
      ),
      suggestion: '保留最早的订单,删除重复的订单',
    });
  }

  // 2.2 检查重复的收款单号
  const duplicatePaymentNumbers = await prisma.$queryRaw<
    Array<{ paymentNumber: string; count: bigint; ids: string }>
  >`
    SELECT payment_number as paymentNumber, COUNT(*) as count, GROUP_CONCAT(id) as ids
    FROM payment_records
    GROUP BY payment_number
    HAVING COUNT(*) > 1
  `;

  if (duplicatePaymentNumbers.length > 0) {
    addResult({
      category: '数据重复',
      table: 'payment_records',
      issue: '收款单号重复',
      count: duplicatePaymentNumbers.length,
      severity: 'error',
      details: duplicatePaymentNumbers.map(
        r => `收款单号 ${r.paymentNumber} 重复 ${r.count} 次, IDs: ${r.ids}`
      ),
      suggestion: '保留最早的收款记录,删除重复的记录',
    });
  }

  // 2.3 检查重复的退款单号
  const duplicateRefundNumbers = await prisma.$queryRaw<
    Array<{ refundNumber: string; count: bigint; ids: string }>
  >`
    SELECT refund_number as refundNumber, COUNT(*) as count, GROUP_CONCAT(id) as ids
    FROM refund_records
    GROUP BY refund_number
    HAVING COUNT(*) > 1
  `;

  if (duplicateRefundNumbers.length > 0) {
    addResult({
      category: '数据重复',
      table: 'refund_records',
      issue: '退款单号重复',
      count: duplicateRefundNumbers.length,
      severity: 'error',
      details: duplicateRefundNumbers.map(
        r => `退款单号 ${r.refundNumber} 重复 ${r.count} 次, IDs: ${r.ids}`
      ),
      suggestion: '保留最早的退款记录,删除重复的记录',
    });
  }

  console.log('');
}

// 3. 数据一致性检查
async function checkDataConsistency() {
  console.log('='.repeat(80));
  console.log('📋 3. 数据一致性检查');
  console.log('='.repeat(80) + '\n');

  // 3.1 检查负数金额
  const negativeAmountOrders = await prisma.$queryRaw<
    Array<{ id: string; orderNumber: string; totalAmount: number }>
  >`
    SELECT id, order_number as orderNumber, total_amount as totalAmount
    FROM sales_orders
    WHERE total_amount < 0
  `;

  if (negativeAmountOrders.length > 0) {
    addResult({
      category: '数据一致性',
      table: 'sales_orders',
      issue: '订单金额为负数',
      count: negativeAmountOrders.length,
      severity: 'error',
      details: negativeAmountOrders.map(
        r => `订单 ${r.orderNumber} 金额为 ${r.totalAmount}`
      ),
      suggestion: '检查订单明细计算逻辑,修正金额',
    });
  }

  // 3.2 检查负数收款金额
  const negativePaymentAmounts = await prisma.$queryRaw<
    Array<{ id: string; paymentNumber: string; paymentAmount: number }>
  >`
    SELECT id, payment_number as paymentNumber, payment_amount as paymentAmount
    FROM payment_records
    WHERE payment_amount < 0
  `;

  if (negativePaymentAmounts.length > 0) {
    addResult({
      category: '数据一致性',
      table: 'payment_records',
      issue: '收款金额为负数',
      count: negativePaymentAmounts.length,
      severity: 'error',
      details: negativePaymentAmounts.map(
        r => `收款单 ${r.paymentNumber} 金额为 ${r.paymentAmount}`
      ),
      suggestion: '检查收款记录,修正金额',
    });
  }

  // 3.3 检查非法订单状态
  const invalidOrderStatus = await prisma.$queryRaw<
    Array<{ id: string; orderNumber: string; status: string }>
  >`
    SELECT id, order_number as orderNumber, status
    FROM sales_orders
    WHERE status NOT IN ('draft', 'confirmed', 'shipped', 'completed', 'cancelled')
  `;

  if (invalidOrderStatus.length > 0) {
    addResult({
      category: '数据一致性',
      table: 'sales_orders',
      issue: '订单状态非法',
      count: invalidOrderStatus.length,
      severity: 'warning',
      details: invalidOrderStatus.map(
        r => `订单 ${r.orderNumber} 状态为 ${r.status}`
      ),
      suggestion: '修正为合法状态值',
    });
  }

  // 3.4 检查非法收款状态
  const invalidPaymentStatus = await prisma.$queryRaw<
    Array<{ id: string; paymentNumber: string; status: string }>
  >`
    SELECT id, payment_number as paymentNumber, status
    FROM payment_records
    WHERE status NOT IN ('pending', 'confirmed', 'cancelled', 'applied')
  `;

  if (invalidPaymentStatus.length > 0) {
    addResult({
      category: '数据一致性',
      table: 'payment_records',
      issue: '收款状态非法',
      count: invalidPaymentStatus.length,
      severity: 'warning',
      details: invalidPaymentStatus.map(
        r => `收款单 ${r.paymentNumber} 状态为 ${r.status}`
      ),
      suggestion: '修正为合法状态值: pending, confirmed, cancelled, applied',
    });
  }

  // 3.5 检查订单金额与明细金额不一致(包含费用项)
  const inconsistentOrderAmounts = await prisma.$queryRaw<
    Array<{
      id: string;
      orderNumber: string;
      totalAmount: number;
      itemsTotal: number;
      feesTotal: number;
    }>
  >`
    SELECT
      so.id,
      so.order_number as orderNumber,
      so.total_amount as totalAmount,
      COALESCE(SUM(soi.subtotal), 0) as itemsTotal,
      COALESCE((
        SELECT SUM(fee.fee_amount)
        FROM sales_order_fee_items fee
        WHERE fee.sales_order_id = so.id
      ), 0) as feesTotal
    FROM sales_orders so
    LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
    GROUP BY so.id, so.order_number, so.total_amount
    HAVING ABS(so.total_amount - (COALESCE(SUM(soi.subtotal), 0) + COALESCE((
      SELECT SUM(fee.fee_amount)
      FROM sales_order_fee_items fee
      WHERE fee.sales_order_id = so.id
    ), 0))) > 0.01
  `;

  if (inconsistentOrderAmounts.length > 0) {
    addResult({
      category: '数据一致性',
      table: 'sales_orders',
      issue: '订单金额与明细不一致',
      count: inconsistentOrderAmounts.length,
      severity: 'warning',
      details: inconsistentOrderAmounts.map(
        r =>
          `订单 ${r.orderNumber} 总额 ${r.totalAmount} 与明细+费用合计 ${r.itemsTotal + r.feesTotal} 不一致 (明细: ${r.itemsTotal}, 费用: ${r.feesTotal})`
      ),
      suggestion: '重新计算订单金额',
    });
  }

  // 3.6 检查收款金额超过订单金额
  const overpaidOrders = await prisma.$queryRaw<
    Array<{
      orderNumber: string;
      totalAmount: number;
      paidAmount: number;
    }>
  >`
    SELECT
      so.order_number as orderNumber,
      so.total_amount as totalAmount,
      COALESCE(SUM(pr.payment_amount), 0) as paidAmount
    FROM sales_orders so
    LEFT JOIN payment_records pr ON so.id = pr.sales_order_id AND pr.status = 'confirmed'
    GROUP BY so.id, so.order_number, so.total_amount
    HAVING COALESCE(SUM(pr.payment_amount), 0) > so.total_amount + 0.01
  `;

  if (overpaidOrders.length > 0) {
    addResult({
      category: '数据一致性',
      table: 'payment_records',
      issue: '收款金额超过订单金额',
      count: overpaidOrders.length,
      severity: 'warning',
      details: overpaidOrders.map(
        r =>
          `订单 ${r.orderNumber} 总额 ${r.totalAmount}, 已收款 ${r.paidAmount}`
      ),
      suggestion: '检查收款记录是否有误',
    });
  }

  console.log('');
}

// 4. 关联关系完整性检查
async function checkRelationshipIntegrity() {
  console.log('='.repeat(80));
  console.log('📋 4. 关联关系完整性检查');
  console.log('='.repeat(80) + '\n');

  // 4.1 检查没有明细的订单
  const ordersWithoutItems = await prisma.$queryRaw<
    Array<{ id: string; orderNumber: string; status: string }>
  >`
    SELECT so.id, so.order_number as orderNumber, so.status
    FROM sales_orders so
    LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
    WHERE soi.id IS NULL AND so.status != 'draft'
  `;

  if (ordersWithoutItems.length > 0) {
    addResult({
      category: '关联完整性',
      table: 'sales_orders',
      issue: '订单没有明细',
      count: ordersWithoutItems.length,
      severity: 'warning',
      details: ordersWithoutItems.map(
        r => `订单 ${r.orderNumber} (${r.status}) 没有订单明细`
      ),
      suggestion: '草稿订单可以没有明细,其他状态的订单应该有明细',
    });
  }

  // 4.2 检查已完成订单但没有收款记录
  const completedOrdersWithoutPayment = await prisma.$queryRaw<
    Array<{ id: string; orderNumber: string; totalAmount: number }>
  >`
    SELECT so.id, so.order_number as orderNumber, so.total_amount as totalAmount
    FROM sales_orders so
    LEFT JOIN payment_records pr ON so.id = pr.sales_order_id
    WHERE so.status = 'completed' AND pr.id IS NULL AND so.total_amount > 0
  `;

  if (completedOrdersWithoutPayment.length > 0) {
    addResult({
      category: '关联完整性',
      table: 'sales_orders',
      issue: '已完成订单没有收款记录',
      count: completedOrdersWithoutPayment.length,
      severity: 'info',
      details: completedOrdersWithoutPayment.map(
        r => `订单 ${r.orderNumber} 金额 ${r.totalAmount} 没有收款记录`
      ),
      suggestion: '可能是现金交易或未记录收款',
    });
  }

  // 4.3 检查账单实体是否存在
  const statementsWithInvalidEntity = await prisma.$queryRaw<
    Array<{
      id: string;
      entityId: string;
      entityType: string;
      entityName: string;
    }>
  >`
    SELECT
      ast.id,
      ast.entity_id as entityId,
      ast.entity_type as entityType,
      ast.entity_name as entityName
    FROM account_statements ast
    LEFT JOIN customers c ON ast.entity_type = 'customer' AND ast.entity_id = c.id
    LEFT JOIN suppliers s ON ast.entity_type = 'supplier' AND ast.entity_id = s.id
    WHERE c.id IS NULL AND s.id IS NULL
  `;

  if (statementsWithInvalidEntity.length > 0) {
    addResult({
      category: '关联完整性',
      table: 'account_statements',
      issue: '账单实体不存在',
      count: statementsWithInvalidEntity.length,
      severity: 'error',
      details: statementsWithInvalidEntity.map(
        r =>
          `账单 ${r.id} 的${r.entityType} ${r.entityName} (${r.entityId}) 不存在`
      ),
      suggestion: '删除这些无效的账单记录',
    });
  }

  console.log('');
}

// 主函数
async function main() {
  console.log('\n');
  console.log('🏥 数据库健康检查工具');
  console.log('='.repeat(80));
  console.log('开始时间:', new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(80));

  try {
    // 执行所有检查
    await checkOrphanedRecords();
    await checkDuplicateRecords();
    await checkDataConsistency();
    await checkRelationshipIntegrity();

    // 生成报告
    console.log('='.repeat(80));
    console.log('📊 检查报告汇总');
    console.log('='.repeat(80) + '\n');

    const errorCount = results.filter(r => r.severity === 'error').length;
    const warningCount = results.filter(r => r.severity === 'warning').length;
    const infoCount = results.filter(r => r.severity === 'info').length;

    console.log(`总问题数: ${results.length}`);
    console.log(`  ❌ 错误 (Error): ${errorCount}`);
    console.log(`  ⚠️  警告 (Warning): ${warningCount}`);
    console.log(`  ℹ️  信息 (Info): ${infoCount}\n`);

    if (results.length === 0) {
      console.log('✅ 恭喜! 数据库健康状况良好,未发现任何问题!\n');
    } else {
      console.log('📋 问题分类统计:\n');

      const categories = [...new Set(results.map(r => r.category))];
      categories.forEach(category => {
        const categoryResults = results.filter(r => r.category === category);
        console.log(`${category}:`);
        categoryResults.forEach(r => {
          const icon =
            r.severity === 'error'
              ? '❌'
              : r.severity === 'warning'
                ? '⚠️'
                : 'ℹ️';
          console.log(`  ${icon} ${r.table}: ${r.issue} (${r.count}条)`);
        });
        console.log('');
      });

      console.log('='.repeat(80));
      console.log('💡 修复建议:\n');

      results
        .filter(r => r.severity === 'error')
        .forEach((r, index) => {
          console.log(`${index + 1}. [${r.table}] ${r.issue}`);
          console.log(`   建议: ${r.suggestion}\n`);
        });

      if (errorCount > 0) {
        console.log('⚠️  发现严重错误,建议立即修复!\n');
        console.log('下一步操作:');
        console.log('1. 备份数据库: npm run backup-db');
        console.log('2. 运行修复脚本: npx tsx scripts/fix-database-issues.ts');
        console.log(
          '3. 重新运行检查: npx tsx scripts/database-health-check.ts\n'
        );
      }
    }

    console.log('='.repeat(80));
    console.log('完成时间:', new Date().toLocaleString('zh-CN'));
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
