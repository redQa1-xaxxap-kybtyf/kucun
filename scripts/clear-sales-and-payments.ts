/**
 * 清空销售订单、应收货款和收款记录的测试数据
 *
 * 使用方法:
 * npm run db:clear-sales
 *
 * 或者直接运行:
 * npx tsx scripts/clear-sales-and-payments.ts
 */

import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  console.log('\n🧹 开始清空销售订单、应收货款和收款记录\n');
  console.log('='.repeat(60));

  try {
    // 统计清理前的数据量
    console.log('\n📊 清理前数据统计:');
    const beforeStats = {
      salesOrders: await prisma.salesOrder.count(),
      salesOrderItems: await prisma.salesOrderItem.count(),
      salesOrderFeeItems: await prisma.salesOrderFeeItem.count(),
      paymentRecords: await prisma.paymentRecord.count(),
      returnOrders: await prisma.returnOrder.count(),
      returnOrderItems: await prisma.returnOrderItem.count(),
      refundRecords: await prisma.refundRecord.count(),
      outboundRecords: await prisma.outboundRecord.count(),
      statementTransactions: await prisma.statementTransaction.count(),
      accountStatements: await prisma.accountStatement.count(),
    };

    console.log(`   销售订单: ${beforeStats.salesOrders} 条`);
    console.log(`   销售订单明细: ${beforeStats.salesOrderItems} 条`);
    console.log(`   销售订单费用项: ${beforeStats.salesOrderFeeItems} 条`);
    console.log(`   收款记录: ${beforeStats.paymentRecords} 条`);
    console.log(`   退货订单: ${beforeStats.returnOrders} 条`);
    console.log(`   退货订单明细: ${beforeStats.returnOrderItems} 条`);
    console.log(`   退款记录: ${beforeStats.refundRecords} 条`);
    console.log(`   出库记录: ${beforeStats.outboundRecords} 条`);
    console.log(`   往来账单交易: ${beforeStats.statementTransactions} 条`);
    console.log(`   往来账单: ${beforeStats.accountStatements} 条`);

    // 确认是否继续
    if (beforeStats.salesOrders === 0 && beforeStats.paymentRecords === 0) {
      console.log('\n✅ 没有需要清理的数据');
      return;
    }

    console.log('\n⚠️  警告: 此操作将删除所有销售订单和收款记录相关数据!');
    console.log('⚠️  此操作不可恢复!');
    console.log('\n按 Ctrl+C 取消,或等待 5 秒后自动继续...\n');

    // 等待 5 秒
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🚀 开始清理数据...\n');

    // 按照依赖关系顺序删除数据
    // 1. 获取所有客户的往来账单ID
    console.log('1️⃣ 获取客户往来账单...');
    const customerStatements = await prisma.accountStatement.findMany({
      where: {
        entityType: 'customer',
      },
      select: {
        id: true,
      },
    });
    const statementIds = customerStatements.map(s => s.id);
    console.log(`   找到 ${statementIds.length} 条客户往来账单`);

    // 2. 清空往来账单交易记录
    console.log('\n2️⃣ 清空往来账单交易记录...');
    const deletedTransactions = await prisma.statementTransaction.deleteMany({
      where: {
        statementId: {
          in: statementIds,
        },
      },
    });
    console.log(`   ✅ 已清空 ${deletedTransactions.count} 条往来账单交易记录`);

    // 3. 清空往来账单
    console.log('\n3️⃣ 清空客户往来账单...');
    const deletedStatements = await prisma.accountStatement.deleteMany({
      where: {
        entityType: 'customer',
      },
    });
    console.log(`   ✅ 已清空 ${deletedStatements.count} 条往来账单`);

    // 4. 清空退款记录
    console.log('\n4️⃣ 清空退款记录...');
    const deletedRefunds = await prisma.refundRecord.deleteMany();
    console.log(`   ✅ 已清空 ${deletedRefunds.count} 条退款记录`);

    // 5. 清空退货订单明细
    console.log('\n5️⃣ 清空退货订单明细...');
    const deletedReturnItems = await prisma.returnOrderItem.deleteMany();
    console.log(`   ✅ 已清空 ${deletedReturnItems.count} 条退货订单明细`);

    // 6. 清空退货订单
    console.log('\n6️⃣ 清空退货订单...');
    const deletedReturns = await prisma.returnOrder.deleteMany();
    console.log(`   ✅ 已清空 ${deletedReturns.count} 条退货订单`);

    // 7. 清空收款记录
    console.log('\n7️⃣ 清空收款记录...');
    const deletedPayments = await prisma.paymentRecord.deleteMany();
    console.log(`   ✅ 已清空 ${deletedPayments.count} 条收款记录`);

    // 8. 清空出库记录
    console.log('\n8️⃣ 清空出库记录...');
    const deletedOutbounds = await prisma.outboundRecord.deleteMany();
    console.log(`   ✅ 已清空 ${deletedOutbounds.count} 条出库记录`);

    // 9. 清空销售订单费用项
    console.log('\n9️⃣ 清空销售订单费用项...');
    const deletedFeeItems = await prisma.salesOrderFeeItem.deleteMany();
    console.log(`   ✅ 已清空 ${deletedFeeItems.count} 条销售订单费用项`);

    // 10. 清空销售订单明细
    console.log('\n🔟 清空销售订单明细...');
    const deletedOrderItems = await prisma.salesOrderItem.deleteMany();
    console.log(`   ✅ 已清空 ${deletedOrderItems.count} 条销售订单明细`);

    // 11. 清空销售订单
    console.log('\n1️⃣1️⃣ 清空销售订单...');
    const deletedOrders = await prisma.salesOrder.deleteMany();
    console.log(`   ✅ 已清空 ${deletedOrders.count} 条销售订单`);

    // 统计清理后的数据量
    console.log('\n📊 清理后数据统计:');
    const afterStats = {
      salesOrders: await prisma.salesOrder.count(),
      salesOrderItems: await prisma.salesOrderItem.count(),
      salesOrderFeeItems: await prisma.salesOrderFeeItem.count(),
      paymentRecords: await prisma.paymentRecord.count(),
      returnOrders: await prisma.returnOrder.count(),
      returnOrderItems: await prisma.returnOrderItem.count(),
      refundRecords: await prisma.refundRecord.count(),
      outboundRecords: await prisma.outboundRecord.count(),
      statementTransactions: await prisma.statementTransaction.count(),
      accountStatements: await prisma.accountStatement.count(),
    };

    console.log(`   销售订单: ${afterStats.salesOrders} 条`);
    console.log(`   销售订单明细: ${afterStats.salesOrderItems} 条`);
    console.log(`   销售订单费用项: ${afterStats.salesOrderFeeItems} 条`);
    console.log(`   收款记录: ${afterStats.paymentRecords} 条`);
    console.log(`   退货订单: ${afterStats.returnOrders} 条`);
    console.log(`   退货订单明细: ${afterStats.returnOrderItems} 条`);
    console.log(`   退款记录: ${afterStats.refundRecords} 条`);
    console.log(`   出库记录: ${afterStats.outboundRecords} 条`);
    console.log(`   往来账单交易: ${afterStats.statementTransactions} 条`);
    console.log(`   往来账单: ${afterStats.accountStatements} 条`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 数据清理完成!\n');

    // 显示清理汇总
    console.log('📋 清理汇总:');
    console.log(`   删除销售订单: ${deletedOrders.count} 条`);
    console.log(`   删除销售订单明细: ${deletedOrderItems.count} 条`);
    console.log(`   删除销售订单费用项: ${deletedFeeItems.count} 条`);
    console.log(`   删除收款记录: ${deletedPayments.count} 条`);
    console.log(`   删除退货订单: ${deletedReturns.count} 条`);
    console.log(`   删除退货订单明细: ${deletedReturnItems.count} 条`);
    console.log(`   删除退款记录: ${deletedRefunds.count} 条`);
    console.log(`   删除出库记录: ${deletedOutbounds.count} 条`);
    console.log(`   删除往来账单交易: ${deletedTransactions.count} 条`);
    console.log(`   删除往来账单: ${deletedStatements.count} 条`);

    console.log('\n💡 提示:');
    console.log('   - 客户、产品、库存等基础数据已保留');
    console.log('   - 用户数据已保留');
    console.log('   - 可以重新创建销售订单进行测试');
    console.log('');
  } catch (error) {
    console.error('\n❌ 清理数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('执行失败:', error);
    process.exit(1);
  });
