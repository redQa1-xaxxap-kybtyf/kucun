/**
 * 清空测试数据脚本
 * 保留用户和系统配置，清空所有业务数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始清空测试数据...\n');

  try {
    // 按照依赖关系顺序删除数据
    console.log('1️⃣ 清空财务相关数据...');
    await prisma.statementTransaction.deleteMany();
    console.log('   ✅ 已清空账单交易');

    await prisma.accountStatement.deleteMany();
    console.log('   ✅ 已清空往来账单');

    await prisma.refundRecord.deleteMany();
    console.log('   ✅ 已清空退款记录');

    await prisma.paymentRecord.deleteMany();
    console.log('   ✅ 已清空付款记录');

    await prisma.paymentOutRecord.deleteMany();
    console.log('   ✅ 已清空应付款付款记录');

    await prisma.payableRecord.deleteMany();
    console.log('   ✅ 已清空应付款记录');

    console.log('\n2️⃣ 清空订单相关数据...');
    await prisma.returnOrderItem.deleteMany();
    console.log('   ✅ 已清空退货订单明细');

    await prisma.returnOrder.deleteMany();
    console.log('   ✅ 已清空退货订单');

    await prisma.factoryShipmentOrderItem.deleteMany();
    console.log('   ✅ 已清空厂家发货订单明细');

    await prisma.factoryShipmentOrder.deleteMany();
    console.log('   ✅ 已清空厂家发货订单');

    await prisma.salesOrderItem.deleteMany();
    console.log('   ✅ 已清空销售订单明细');

    await prisma.salesOrderFeeItem.deleteMany();
    console.log('   ✅ 已清空销售订单费用');

    await prisma.salesOrder.deleteMany();
    console.log('   ✅ 已清空销售订单');

    console.log('\n3️⃣ 清空库存相关数据...');
    await prisma.outboundRecord.deleteMany();
    console.log('   ✅ 已清空出库记录');

    await prisma.inboundRecord.deleteMany();
    console.log('   ✅ 已清空入库记录');

    await prisma.inventoryAdjustment.deleteMany();
    console.log('   ✅ 已清空库存调整记录');

    await prisma.inventory.deleteMany();
    console.log('   ✅ 已清空库存');

    console.log('\n4️⃣ 清空产品相关数据...');
    await prisma.batchSpecification.deleteMany();
    console.log('   ✅ 已清空批次规格');

    await prisma.customerProductPrice.deleteMany();
    console.log('   ✅ 已清空客户产品价格');

    await prisma.supplierProductPrice.deleteMany();
    console.log('   ✅ 已清空供应商产品价格');

    await prisma.productVariant.deleteMany();
    console.log('   ✅ 已清空产品规格');

    await prisma.product.deleteMany();
    console.log('   ✅ 已清空产品');

    await prisma.category.deleteMany();
    console.log('   ✅ 已清空分类');

    console.log('\n5️⃣ 清空客户和供应商数据...');
    await prisma.customer.deleteMany();
    console.log('   ✅ 已清空客户');

    await prisma.supplier.deleteMany();
    console.log('   ✅ 已清空供应商');

    console.log('\n✨ 测试数据清空完成！');
    console.log('\n📊 保留的数据：');
    console.log('   - 用户账号');
    console.log('   - 系统配置');

    // 统计剩余数据
    const userCount = await prisma.user.count();
    const settingCount = await prisma.systemSetting.count();
    console.log(`\n📈 当前数据统计：`);
    console.log(`   - 用户: ${userCount} 个`);
    console.log(`   - 系统配置: ${settingCount} 项`);
  } catch (error) {
    console.error('\n❌ 清空数据失败:', error);
    throw error;
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
