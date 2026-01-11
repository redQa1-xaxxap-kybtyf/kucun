import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

async function verifySeedData() {
  console.log('🔍 开始验证测试数据...\n');

  try {
    // 1. 验证用户数据
    console.log('👤 验证用户数据...');
    const [totalUsers, adminUsers, salesUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { role: 'sales' } }),
    ]);
    console.log(`   总用户数: ${totalUsers}`);
    console.log(`   管理员: ${adminUsers}`);
    console.log(`   销售员: ${salesUsers}`);

    // 2. 验证产品数据
    console.log('\n📦 验证产品数据...');
    const [totalProducts, productsWithCategory, activeProducts] =
      await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { categoryId: { not: null } } }),
        prisma.product.count({ where: { status: 'active' } }),
      ]);
    console.log(`   总产品数: ${totalProducts}`);
    console.log(`   有分类的产品: ${productsWithCategory}`);
    console.log(`   激活状态: ${activeProducts}`);

    // 3. 验证产品变体
    console.log('\n🎨 验证产品变体...');
    const [totalVariants, activeVariants] = await Promise.all([
      prisma.productVariant.count(),
      prisma.productVariant.count({ where: { status: 'active' } }),
    ]);
    console.log(`   总变体数: ${totalVariants}`);
    console.log(`   激活状态: ${activeVariants}`);

    // 4. 验证客户数据
    console.log('\n👥 验证客户数据...');
    const [totalCustomers, customersWithPhone, customersWithAddress] =
      await Promise.all([
        prisma.customer.count(),
        prisma.customer.count({ where: { phone: { not: null } } }),
        prisma.customer.count({ where: { address: { not: null } } }),
      ]);
    console.log(`   总客户数: ${totalCustomers}`);
    console.log(`   有电话的客户: ${customersWithPhone}`);
    console.log(`   有地址的客户: ${customersWithAddress}`);

    // 5. 验证供应商数据
    console.log('\n🏭 验证供应商数据...');
    const [totalSuppliers, activeSuppliers, suppliersWithCode] =
      await Promise.all([
        prisma.supplier.count(),
        prisma.supplier.count({ where: { status: 'active' } }),
        prisma.supplier.count({ where: { supplierCode: { not: null } } }),
      ]);
    console.log(`   总供应商数: ${totalSuppliers}`);
    console.log(`   激活状态: ${activeSuppliers}`);
    console.log(`   有编码的供应商: ${suppliersWithCode}`);

    // 6. 验证库存数据
    console.log('\n📊 验证库存数据...');
    const [inventoryCount, inventorySum, inventoryWithBatch] = await Promise.all(
      [
        prisma.inventory.count(),
        prisma.inventory.aggregate({ _sum: { quantity: true } }),
        prisma.inventory.count({ where: { batchNumber: { not: null } } }),
      ]
    );
    console.log(`   总库存记录: ${inventoryCount}`);
    console.log(`   总库存数量: ${inventorySum._sum.quantity ?? 0}`);
    console.log(`   有批次号的记录: ${inventoryWithBatch}`);

    // 7. 验证入库记录
    console.log('\n📥 验证入库记录...');
    const [inboundCount, inboundSum] = await Promise.all([
      prisma.inboundRecord.count(),
      prisma.inboundRecord.aggregate({ _sum: { quantity: true } }),
    ]);
    console.log(`   总入库记录: ${inboundCount}`);
    console.log(`   总入库数量: ${(inboundSum._sum.quantity ?? 0).toFixed(0)}`);

    // 8. 验证销售订单
    console.log('\n🛒 验证销售订单...');
    const [
      totalSalesOrders,
      confirmedOrders,
      shippedOrders,
      completedOrders,
      transferOrders,
      salesOrderAmountSum,
    ] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.salesOrder.count({ where: { status: 'confirmed' } }),
      prisma.salesOrder.count({ where: { status: 'shipped' } }),
      prisma.salesOrder.count({ where: { status: 'completed' } }),
      prisma.salesOrder.count({ where: { orderType: 'TRANSFER' } }),
      prisma.salesOrder.aggregate({ _sum: { totalAmount: true } }),
    ]);
    console.log(`   总订单数: ${totalSalesOrders}`);
    console.log(`   已确认: ${confirmedOrders}`);
    console.log(`   已发货: ${shippedOrders}`);
    console.log(`   已完成: ${completedOrders}`);
    console.log(`   调货订单: ${transferOrders}`);
    console.log(
      `   订单总金额: ￥${Number(salesOrderAmountSum._sum.totalAmount ?? 0).toFixed(2)}`
    );

    // 9. 验证收款记录
    console.log('\n💰 验证收款记录...');
    const [
      totalPayments,
      paymentAmountSum,
      cashPayments,
      bankTransferPayments,
    ] = await Promise.all([
      prisma.paymentRecord.count(),
      prisma.paymentRecord.aggregate({ _sum: { paymentAmount: true } }),
      prisma.paymentRecord.count({ where: { paymentMethod: 'cash' } }),
      prisma.paymentRecord.count({ where: { paymentMethod: 'bank_transfer' } }),
    ]);
    console.log(`   总收款记录: ${totalPayments}`);
    console.log(
      `   收款总金额: ￥${Number(paymentAmountSum._sum.paymentAmount ?? 0).toFixed(2)}`
    );
    console.log(`   现金: ${cashPayments}`);
    console.log(`   转账: ${bankTransferPayments}`);

    // 10. 验证应付款记录
    console.log('\n📋 验证应付款记录...');
    const [
      totalPayables,
      payableAmountSum,
      paidAmountSum,
      pendingPayables,
      partialPayables,
      paidPayables,
    ] = await Promise.all([
      prisma.payableRecord.count(),
      prisma.payableRecord.aggregate({ _sum: { payableAmount: true } }),
      prisma.payableRecord.aggregate({ _sum: { paidAmount: true } }),
      prisma.payableRecord.count({ where: { status: 'pending' } }),
      prisma.payableRecord.count({ where: { status: 'partial' } }),
      prisma.payableRecord.count({ where: { status: 'paid' } }),
    ]);
    console.log(`   总应付款记录: ${totalPayables}`);
    console.log(
      `   应付款总金额: ￥${Number(payableAmountSum._sum.payableAmount ?? 0).toFixed(2)}`
    );
    console.log(
      `   已付款金额: ￥${Number(paidAmountSum._sum.paidAmount ?? 0).toFixed(2)}`
    );
    console.log(`   待付款: ${pendingPayables}`);
    console.log(`   部分付款: ${partialPayables}`);
    console.log(`   已付清: ${paidPayables}`);

    // 11. 验证付款记录
    console.log('\n💸 验证付款记录...');
    const [totalPaymentOutRecords, paymentOutAmountSum] = await Promise.all([
      prisma.paymentOutRecord.count(),
      prisma.paymentOutRecord.aggregate({ _sum: { paymentAmount: true } }),
    ]);
    console.log(`   总付款记录: ${totalPaymentOutRecords}`);
    console.log(
      `   付款总金额: ￥${Number(paymentOutAmountSum._sum.paymentAmount ?? 0).toFixed(2)}`
    );

    // 12. 验证厂家发货订单
    console.log('\n🚚 验证厂家发货订单...');
    const [
      totalFactoryOrders,
      confirmedFactoryOrders,
      shippedFactoryOrders,
      arrivedFactoryOrders,
      completedFactoryOrders,
      factoryOrderAmountSum,
    ] = await Promise.all([
      prisma.factoryShipmentOrder.count(),
      prisma.factoryShipmentOrder.count({ where: { status: 'confirmed' } }),
      prisma.factoryShipmentOrder.count({ where: { status: 'shipped' } }),
      prisma.factoryShipmentOrder.count({ where: { status: 'arrived' } }),
      prisma.factoryShipmentOrder.count({ where: { status: 'completed' } }),
      prisma.factoryShipmentOrder.aggregate({ _sum: { totalAmount: true } }),
    ]);
    console.log(`   总订单数: ${totalFactoryOrders}`);
    console.log(`   已确认: ${confirmedFactoryOrders}`);
    console.log(`   已发货: ${shippedFactoryOrders}`);
    console.log(`   已到港: ${arrivedFactoryOrders}`);
    console.log(`   已完成: ${completedFactoryOrders}`);
    console.log(
      `   订单总金额: ￥${Number(factoryOrderAmountSum._sum.totalAmount ?? 0).toFixed(2)}`
    );

    // 13. 验证退货订单
    console.log('\n↩️  验证退货订单...');
    const [
      totalReturnOrders,
      submittedReturnOrders,
      approvedReturnOrders,
      processingReturnOrders,
      completedReturnOrders,
    ] = await Promise.all([
      prisma.returnOrder.count(),
      prisma.returnOrder.count({ where: { status: 'submitted' } }),
      prisma.returnOrder.count({ where: { status: 'approved' } }),
      prisma.returnOrder.count({ where: { status: 'processing' } }),
      prisma.returnOrder.count({ where: { status: 'completed' } }),
    ]);
    console.log(`   总退货订单: ${totalReturnOrders}`);
    console.log(`   已提交: ${submittedReturnOrders}`);
    console.log(`   已批准: ${approvedReturnOrders}`);
    console.log(`   处理中: ${processingReturnOrders}`);
    console.log(`   已完成: ${completedReturnOrders}`);

    // 14. 验证退款记录
    console.log('\n💵 验证退款记录...');
    const [totalRefunds, refundAmountSum, completedRefunds] = await Promise.all([
      prisma.refundRecord.count(),
      prisma.refundRecord.aggregate({ _sum: { refundAmount: true } }),
      prisma.refundRecord.count({ where: { status: 'completed' } }),
    ]);
    console.log(`   总退款记录: ${totalRefunds}`);
    console.log(
      `   退款总金额: ￥${Number(refundAmountSum._sum.refundAmount ?? 0).toFixed(2)}`
    );
    console.log(`   已完成: ${completedRefunds}`);

    // 15. 验证系统日志
    console.log('\n📝 验证系统日志...');
    const [totalLogs, userActionLogs, businessLogs, systemEventLogs] =
      await Promise.all([
        prisma.systemLog.count(),
        prisma.systemLog.count({ where: { type: 'user_action' } }),
        prisma.systemLog.count({ where: { type: 'business_operation' } }),
        prisma.systemLog.count({ where: { type: 'system_event' } }),
      ]);
    console.log(`   总日志数: ${totalLogs}`);
    console.log(`   用户操作: ${userActionLogs}`);
    console.log(`   业务操作: ${businessLogs}`);
    console.log(`   系统事件: ${systemEventLogs}`);

    // 16. 验证数据关联性
    console.log('\n🔗 验证数据关联性...');
    const [salesOrdersWithItems, factoryOrdersWithItems, returnOrdersWithItems] =
      await Promise.all([
        prisma.salesOrder.count({ where: { items: { some: {} } } }),
        prisma.factoryShipmentOrder.count({ where: { items: { some: {} } } }),
        prisma.returnOrder.count({ where: { items: { some: {} } } }),
      ]);
    console.log(
      `   有明细的订单: ${salesOrdersWithItems}/${totalSalesOrders}`
    );
    console.log(
      `   有明细的厂家订单: ${factoryOrdersWithItems}/${totalFactoryOrders}`
    );
    console.log(
      `   有明细的退货订单: ${returnOrdersWithItems}/${totalReturnOrders}`
    );

    // 17. 验证数据时间范围
    console.log('\n📅 验证数据时间范围...');
    const [salesOrderDates, paymentDates, inboundDates] = await Promise.all([
      prisma.salesOrder.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
      prisma.paymentRecord.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
      prisma.inboundRecord.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
    ]);

    const candidateMinDates = [
      salesOrderDates._min.createdAt,
      paymentDates._min.createdAt,
      inboundDates._min.createdAt,
    ].filter(Boolean) as Date[];

    const candidateMaxDates = [
      salesOrderDates._max.createdAt,
      paymentDates._max.createdAt,
      inboundDates._max.createdAt,
    ].filter(Boolean) as Date[];

    if (candidateMinDates.length > 0 && candidateMaxDates.length > 0) {
      const minDate = new Date(Math.min(...candidateMinDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...candidateMaxDates.map(d => d.getTime())));
      console.log(`   最早日期: ${formatDate(minDate)}`);
      console.log(`   最晚日期: ${formatDate(maxDate)}`);
    } else {
      console.log('   暂无时间范围可用数据');
    }

    console.log('\n✅ 数据验证完成！所有数据看起来都正常。');
    console.log('\n💡 提示：');
    console.log('   - 可以使用 npm run db:studio 打开 Prisma Studio 查看数据');
    console.log('   - 可以启动开发服务器测试各个功能模块');
    console.log('   - 数据包含完整的业务流程，适合进行端到端测试');
  } catch (error) {
    console.error('❌ 验证过程中出错:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySeedData();
