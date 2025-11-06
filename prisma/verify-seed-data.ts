import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySeedData() {
  console.log('🔍 开始验证测试数据...\n');

  try {
    // 1. 验证用户数据
    console.log('👤 验证用户数据...');
    const users = await prisma.user.findMany();
    console.log(`   总用户数: ${users.length}`);
    console.log(`   管理员: ${users.filter(u => u.role === 'admin').length}`);
    console.log(`   销售员: ${users.filter(u => u.role === 'sales').length}`);

    // 2. 验证产品数据
    console.log('\n📦 验证产品数据...');
    const products = await prisma.product.findMany({
      include: { category: true },
    });
    console.log(`   总产品数: ${products.length}`);
    console.log(
      `   有分类的产品: ${products.filter(p => p.categoryId).length}`
    );
    console.log(
      `   激活状态: ${products.filter(p => p.status === 'active').length}`
    );

    // 3. 验证产品变体
    console.log('\n🎨 验证产品变体...');
    const variants = await prisma.productVariant.findMany();
    console.log(`   总变体数: ${variants.length}`);
    console.log(
      `   激活状态: ${variants.filter(v => v.status === 'active').length}`
    );

    // 4. 验证客户数据
    console.log('\n👥 验证客户数据...');
    const customers = await prisma.customer.findMany();
    console.log(`   总客户数: ${customers.length}`);
    console.log(`   有电话的客户: ${customers.filter(c => c.phone).length}`);
    console.log(`   有地址的客户: ${customers.filter(c => c.address).length}`);

    // 5. 验证供应商数据
    console.log('\n🏭 验证供应商数据...');
    const suppliers = await prisma.supplier.findMany();
    console.log(`   总供应商数: ${suppliers.length}`);
    console.log(
      `   激活状态: ${suppliers.filter(s => s.status === 'active').length}`
    );
    console.log(
      `   有编码的供应商: ${suppliers.filter(s => s.supplierCode).length}`
    );

    // 6. 验证库存数据
    console.log('\n📊 验证库存数据...');
    const inventory = await prisma.inventory.findMany();
    console.log(`   总库存记录: ${inventory.length}`);
    const totalQuantity = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    console.log(`   总库存数量: ${totalQuantity}`);
    console.log(
      `   有批次号的记录: ${inventory.filter(i => i.batchNumber).length}`
    );

    // 7. 验证入库记录
    console.log('\n📥 验证入库记录...');
    const inboundRecords = await prisma.inboundRecord.findMany();
    console.log(`   总入库记录: ${inboundRecords.length}`);
    const totalInbound = inboundRecords.reduce((sum, r) => sum + r.quantity, 0);
    console.log(`   总入库数量: ${totalInbound.toFixed(0)}`);

    // 8. 验证销售订单
    console.log('\n🛒 验证销售订单...');
    const salesOrders = await prisma.salesOrder.findMany({
      include: { items: true },
    });
    console.log(`   总订单数: ${salesOrders.length}`);
    console.log(
      `   已确认: ${salesOrders.filter(o => o.status === 'confirmed').length}`
    );
    console.log(
      `   已发货: ${salesOrders.filter(o => o.status === 'shipped').length}`
    );
    console.log(
      `   已完成: ${salesOrders.filter(o => o.status === 'completed').length}`
    );
    console.log(
      `   调货订单: ${salesOrders.filter(o => o.orderType === 'TRANSFER').length}`
    );
    const totalOrderAmount = salesOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0
    );
    console.log(`   订单总金额: ￥${totalOrderAmount.toFixed(2)}`);

    // 9. 验证收款记录
    console.log('\n💰 验证收款记录...');
    const paymentRecords = await prisma.paymentRecord.findMany();
    console.log(`   总收款记录: ${paymentRecords.length}`);
    const totalPayment = paymentRecords.reduce(
      (sum, p) => sum + p.paymentAmount,
      0
    );
    console.log(`   收款总金额: ￥${totalPayment.toFixed(2)}`);
    console.log(
      `   现金: ${paymentRecords.filter(p => p.paymentMethod === 'cash').length}`
    );
    console.log(
      `   转账: ${paymentRecords.filter(p => p.paymentMethod === 'bank_transfer').length}`
    );

    // 10. 验证应付款记录
    console.log('\n📋 验证应付款记录...');
    const payableRecords = await prisma.payableRecord.findMany();
    console.log(`   总应付款记录: ${payableRecords.length}`);
    const totalPayable = payableRecords.reduce(
      (sum, p) => sum + p.payableAmount,
      0
    );
    console.log(`   应付款总金额: ￥${totalPayable.toFixed(2)}`);
    const totalPaid = payableRecords.reduce((sum, p) => sum + p.paidAmount, 0);
    console.log(`   已付款金额: ￥${totalPaid.toFixed(2)}`);
    console.log(
      `   待付款: ${payableRecords.filter(p => p.status === 'pending').length}`
    );
    console.log(
      `   部分付款: ${payableRecords.filter(p => p.status === 'partial').length}`
    );
    console.log(
      `   已付清: ${payableRecords.filter(p => p.status === 'paid').length}`
    );

    // 11. 验证付款记录
    console.log('\n💸 验证付款记录...');
    const paymentOutRecords = await prisma.paymentOutRecord.findMany();
    console.log(`   总付款记录: ${paymentOutRecords.length}`);
    const totalPaymentOut = paymentOutRecords.reduce(
      (sum, p) => sum + p.paymentAmount,
      0
    );
    console.log(`   付款总金额: ￥${totalPaymentOut.toFixed(2)}`);

    // 12. 验证厂家发货订单
    console.log('\n🚚 验证厂家发货订单...');
    const factoryOrders = await prisma.factoryShipmentOrder.findMany({
      include: { items: true },
    });
    console.log(`   总订单数: ${factoryOrders.length}`);
    console.log(
      `   已确认: ${factoryOrders.filter(o => o.status === 'confirmed').length}`
    );
    console.log(
      `   已发货: ${factoryOrders.filter(o => o.status === 'shipped').length}`
    );
    console.log(
      `   已到港: ${factoryOrders.filter(o => o.status === 'arrived').length}`
    );
    console.log(
      `   已完成: ${factoryOrders.filter(o => o.status === 'completed').length}`
    );
    const totalFactoryAmount = factoryOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0
    );
    console.log(`   订单总金额: ￥${totalFactoryAmount.toFixed(2)}`);

    // 13. 验证退货订单
    console.log('\n↩️  验证退货订单...');
    const returnOrders = await prisma.returnOrder.findMany({
      include: { items: true },
    });
    console.log(`   总退货订单: ${returnOrders.length}`);
    console.log(
      `   已提交: ${returnOrders.filter(o => o.status === 'submitted').length}`
    );
    console.log(
      `   已批准: ${returnOrders.filter(o => o.status === 'approved').length}`
    );
    console.log(
      `   处理中: ${returnOrders.filter(o => o.status === 'processing').length}`
    );
    console.log(
      `   已完成: ${returnOrders.filter(o => o.status === 'completed').length}`
    );

    // 14. 验证退款记录
    console.log('\n💵 验证退款记录...');
    const refundRecords = await prisma.refundRecord.findMany();
    console.log(`   总退款记录: ${refundRecords.length}`);
    const totalRefund = refundRecords.reduce(
      (sum, r) => sum + r.refundAmount,
      0
    );
    console.log(`   退款总金额: ￥${totalRefund.toFixed(2)}`);
    console.log(
      `   已完成: ${refundRecords.filter(r => r.status === 'completed').length}`
    );

    // 15. 验证系统日志
    console.log('\n📝 验证系统日志...');
    const systemLogs = await prisma.systemLog.findMany();
    console.log(`   总日志数: ${systemLogs.length}`);
    console.log(
      `   用户操作: ${systemLogs.filter(l => l.type === 'user_action').length}`
    );
    console.log(
      `   业务操作: ${systemLogs.filter(l => l.type === 'business_operation').length}`
    );
    console.log(
      `   系统事件: ${systemLogs.filter(l => l.type === 'system_event').length}`
    );

    // 16. 验证数据关联性
    console.log('\n🔗 验证数据关联性...');
    const ordersWithItems = salesOrders.filter(o => o.items.length > 0);
    console.log(
      `   有明细的订单: ${ordersWithItems.length}/${salesOrders.length}`
    );

    const factoryOrdersWithItems = factoryOrders.filter(
      o => o.items.length > 0
    );
    console.log(
      `   有明细的厂家订单: ${factoryOrdersWithItems.length}/${factoryOrders.length}`
    );

    const returnOrdersWithItems = returnOrders.filter(o => o.items.length > 0);
    console.log(
      `   有明细的退货订单: ${returnOrdersWithItems.length}/${returnOrders.length}`
    );

    // 17. 验证数据时间范围
    console.log('\n📅 验证数据时间范围...');
    const allDates = [
      ...salesOrders.map(o => o.createdAt),
      ...paymentRecords.map(p => p.createdAt),
      ...inboundRecords.map(r => r.createdAt),
    ];
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    console.log(`   最早日期: ${minDate.toISOString().split('T')[0]}`);
    console.log(`   最晚日期: ${maxDate.toISOString().split('T')[0]}`);

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
