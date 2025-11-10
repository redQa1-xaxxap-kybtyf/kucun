/**
 * 交互式清理测试数据脚本
 * 开发环境专用 - 删除所有业务数据，保留基础配置
 *
 * 使用方法: npx tsx scripts/clean-test-data-interactive.ts
 */

import * as readline from 'readline';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 询问用户确认
function askQuestion(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// 统计所有表的数据
async function getDataStats() {
  console.log('📊 正在统计数据...\n');

  const stats = {
    // 库存相关
    inventory: await prisma.inventory.count(),
    inboundRecords: await prisma.inboundRecord.count(),
    outboundRecords: await prisma.outboundRecord.count(),
    inventoryAdjustments: await prisma.inventoryAdjustment.count(),
    batchSpecifications: await prisma.batchSpecification.count(),
    inventoryCounts: await prisma.inventoryCount.count(),
    inventoryCountItems: await prisma.inventoryCountItem.count(),

    // 订单相关
    salesOrders: await prisma.salesOrder.count(),
    salesOrderItems: await prisma.salesOrderItem.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    purchaseOrderItems: await prisma.purchaseOrderItem.count(),
    returnOrders: await prisma.returnOrder.count(),
    returnOrderItems: await prisma.returnOrderItem.count(),
    factoryShipmentOrders: await prisma.factoryShipmentOrder.count(),
    factoryShipmentOrderItems: await prisma.factoryShipmentOrderItem.count(),

    // 财务相关
    paymentRecords: await prisma.paymentRecord.count(),
    paymentOutRecords: await prisma.paymentOutRecord.count(),
    payableRecords: await prisma.payableRecord.count(),
    refundRecords: await prisma.refundRecord.count(),
    expenseRecords: await prisma.expenseRecord.count(),
    accountStatements: await prisma.accountStatement.count(),
    statementTransactions: await prisma.statementTransaction.count(),

    // 基础数据（将保留）
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    suppliers: await prisma.supplier.count(),
    products: await prisma.product.count(),
    productVariants: await prisma.productVariant.count(),
    categories: await prisma.category.count(),

    // 其他
    systemLogs: await prisma.systemLog.count(),
    shippingQueries: await prisma.shippingQuery.count(),
  };

  return stats;
}

// 显示数据统计
function displayStats(stats: Record<string, number>, title: string) {
  console.log(`\n${title}`);
  console.log('='.repeat(60));

  console.log('\n📦 库存相关数据:');
  console.log(`   库存记录: ${stats.inventory}`);
  console.log(`   入库记录: ${stats.inboundRecords}`);
  console.log(`   出库记录: ${stats.outboundRecords}`);
  console.log(`   库存调整: ${stats.inventoryAdjustments}`);
  console.log(`   批次规格: ${stats.batchSpecifications}`);
  console.log(`   盘点记录: ${stats.inventoryCounts}`);
  console.log(`   盘点明细: ${stats.inventoryCountItems}`);

  console.log('\n📋 订单相关数据:');
  console.log(
    `   销售订单: ${stats.salesOrders} (明细: ${stats.salesOrderItems})`
  );
  console.log(
    `   采购订单: ${stats.purchaseOrders} (明细: ${stats.purchaseOrderItems})`
  );
  console.log(
    `   退货订单: ${stats.returnOrders} (明细: ${stats.returnOrderItems})`
  );
  console.log(
    `   工厂发货: ${stats.factoryShipmentOrders} (明细: ${stats.factoryShipmentOrderItems})`
  );

  console.log('\n💰 财务相关数据:');
  console.log(`   收款记录: ${stats.paymentRecords}`);
  console.log(`   付款记录: ${stats.paymentOutRecords}`);
  console.log(`   应付款记录: ${stats.payableRecords}`);
  console.log(`   退款记录: ${stats.refundRecords}`);
  console.log(`   费用记录: ${stats.expenseRecords}`);
  console.log(`   往来账单: ${stats.accountStatements}`);
  console.log(`   账单交易: ${stats.statementTransactions}`);

  console.log('\n📚 基础数据（将保留）:');
  console.log(`   用户: ${stats.users}`);
  console.log(`   客户: ${stats.customers}`);
  console.log(`   供应商: ${stats.suppliers}`);
  console.log(`   产品: ${stats.products} (变体: ${stats.productVariants})`);
  console.log(`   分类: ${stats.categories}`);

  console.log('\n🔧 其他数据:');
  console.log(`   系统日志: ${stats.systemLogs}`);
  console.log(`   运输查询: ${stats.shippingQueries}`);

  console.log('='.repeat(60));
}

// 执行清理操作
async function cleanData() {
  console.log('\n🗑️  开始清理数据...\n');

  let deletedCount = 0;

  // 使用事务确保数据一致性
  await prisma.$transaction(async tx => {
    // 1. 财务相关数据（按依赖关系顺序）
    console.log('1️⃣ 清理财务相关数据...');

    const statementTx = await tx.statementTransaction.deleteMany();
    console.log(`   ✅ 账单交易: ${statementTx.count} 条`);
    deletedCount += statementTx.count;

    const accountStmt = await tx.accountStatement.deleteMany();
    console.log(`   ✅ 往来账单: ${accountStmt.count} 条`);
    deletedCount += accountStmt.count;

    const refund = await tx.refundRecord.deleteMany();
    console.log(`   ✅ 退款记录: ${refund.count} 条`);
    deletedCount += refund.count;

    const payment = await tx.paymentRecord.deleteMany();
    console.log(`   ✅ 收款记录: ${payment.count} 条`);
    deletedCount += payment.count;

    const paymentOut = await tx.paymentOutRecord.deleteMany();
    console.log(`   ✅ 付款记录: ${paymentOut.count} 条`);
    deletedCount += paymentOut.count;

    const payable = await tx.payableRecord.deleteMany();
    console.log(`   ✅ 应付款记录: ${payable.count} 条`);
    deletedCount += payable.count;

    const expense = await tx.expenseRecord.deleteMany();
    console.log(`   ✅ 费用记录: ${expense.count} 条`);
    deletedCount += expense.count;

    // 2. 订单相关数据
    console.log('\n2️⃣ 清理订单相关数据...');

    const returnOrderItems = await tx.returnOrderItem.deleteMany();
    console.log(`   ✅ 退货订单明细: ${returnOrderItems.count} 条`);
    deletedCount += returnOrderItems.count;

    const returnOrders = await tx.returnOrder.deleteMany();
    console.log(`   ✅ 退货订单: ${returnOrders.count} 条`);
    deletedCount += returnOrders.count;

    const purchaseOrderItems = await tx.purchaseOrderItem.deleteMany();
    console.log(`   ✅ 采购订单明细: ${purchaseOrderItems.count} 条`);
    deletedCount += purchaseOrderItems.count;

    const purchaseOrders = await tx.purchaseOrder.deleteMany();
    console.log(`   ✅ 采购订单: ${purchaseOrders.count} 条`);
    deletedCount += purchaseOrders.count;

    const shippingQueries = await tx.shippingQuery.deleteMany();
    console.log(`   ✅ 运输查询: ${shippingQueries.count} 条`);
    deletedCount += shippingQueries.count;

    const factoryItems = await tx.factoryShipmentOrderItem.deleteMany();
    console.log(`   ✅ 工厂发货明细: ${factoryItems.count} 条`);
    deletedCount += factoryItems.count;

    const factoryOrders = await tx.factoryShipmentOrder.deleteMany();
    console.log(`   ✅ 工厂发货订单: ${factoryOrders.count} 条`);
    deletedCount += factoryOrders.count;

    const salesOrderFees = await tx.salesOrderFeeItem.deleteMany();
    console.log(`   ✅ 销售订单费用: ${salesOrderFees.count} 条`);
    deletedCount += salesOrderFees.count;

    const salesOrderItems = await tx.salesOrderItem.deleteMany();
    console.log(`   ✅ 销售订单明细: ${salesOrderItems.count} 条`);
    deletedCount += salesOrderItems.count;

    const salesOrders = await tx.salesOrder.deleteMany();
    console.log(`   ✅ 销售订单: ${salesOrders.count} 条`);
    deletedCount += salesOrders.count;

    // 3. 库存相关数据
    console.log('\n3️⃣ 清理库存相关数据...');

    const countItems = await tx.inventoryCountItem.deleteMany();
    console.log(`   ✅ 盘点明细: ${countItems.count} 条`);
    deletedCount += countItems.count;

    const counts = await tx.inventoryCount.deleteMany();
    console.log(`   ✅ 盘点记录: ${counts.count} 条`);
    deletedCount += counts.count;

    const outbound = await tx.outboundRecord.deleteMany();
    console.log(`   ✅ 出库记录: ${outbound.count} 条`);
    deletedCount += outbound.count;

    const inbound = await tx.inboundRecord.deleteMany();
    console.log(`   ✅ 入库记录: ${inbound.count} 条`);
    deletedCount += inbound.count;

    const adjustments = await tx.inventoryAdjustment.deleteMany();
    console.log(`   ✅ 库存调整: ${adjustments.count} 条`);
    deletedCount += adjustments.count;

    const batchSpecs = await tx.batchSpecification.deleteMany();
    console.log(`   ✅ 批次规格: ${batchSpecs.count} 条`);
    deletedCount += batchSpecs.count;

    const inventory = await tx.inventory.deleteMany();
    console.log(`   ✅ 库存记录: ${inventory.count} 条`);
    deletedCount += inventory.count;

    // 4. 系统日志
    console.log('\n4️⃣ 清理系统日志...');

    const systemLogs = await tx.systemLog.deleteMany();
    console.log(`   ✅ 系统日志: ${systemLogs.count} 条`);
    deletedCount += systemLogs.count;

    const settingLogs = await tx.settingChangeLog.deleteMany();
    console.log(`   ✅ 设置变更日志: ${settingLogs.count} 条`);
    deletedCount += settingLogs.count;

    const loginAttempts = await tx.loginAttempt.deleteMany();
    console.log(`   ✅ 登录尝试记录: ${loginAttempts.count} 条`);
    deletedCount += loginAttempts.count;
  });

  console.log(`\n✅ 总共删除 ${deletedCount} 条记录`);
}

async function main() {
  console.log('🧹 测试数据清理工具');
  console.log('='.repeat(60));
  console.log('⚠️  警告: 这将删除所有业务数据（订单、库存、财务记录等）');
  console.log('✅ 保留: 用户、客户、供应商、产品等基础数据');
  console.log('='.repeat(60));

  try {
    // 1. 检查环境
    const nodeEnv = process.env.NODE_ENV || 'development';
    console.log(`\n🔍 当前环境: ${nodeEnv}`);

    if (nodeEnv === 'production') {
      console.log('\n❌ 错误: 不能在生产环境执行此脚本！');
      process.exit(1);
    }

    // 2. 显示当前数据统计
    const beforeStats = await getDataStats();
    displayStats(beforeStats, '📊 当前数据统计');

    // 3. 询问用户确认
    console.log('\n⚠️  确认操作:');
    const answer = await askQuestion(
      '\n是否继续清理数据？这将删除所有业务数据！(输入 "yes" 确认): '
    );

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ 操作已取消');
      rl.close();
      return;
    }

    // 4. 执行清理
    await cleanData();

    // 5. 显示清理后的统计
    const afterStats = await getDataStats();
    displayStats(afterStats, '📊 清理后数据统计');

    // 6. 显示保留的基础数据
    console.log('\n✅ 保留的基础数据:');
    console.log(`   用户: ${afterStats.users} 个`);
    console.log(`   客户: ${afterStats.customers} 个`);
    console.log(`   供应商: ${afterStats.suppliers} 个`);
    console.log(`   产品: ${afterStats.products} 个`);
    console.log(`   分类: ${afterStats.categories} 个`);

    console.log('\n✨ 数据清理完成！');
    console.log('\n💡 下一步操作:');
    console.log(
      '   1. 清除 Redis 缓存: npx tsx scripts/clear-inventory-alerts-cache.ts'
    );
    console.log('   2. 生成测试数据: npm run db:seed');
    console.log('   3. 启动开发服务器: npm run dev');
  } catch (error) {
    console.error('\n❌ 清理失败:', error);
    throw error;
  } finally {
    rl.close();
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
