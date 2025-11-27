/**
 * 清空测试数据脚本（修复版）
 * 保留管理员用户和系统配置，清空所有业务数据
 * 正确处理外键依赖关系
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始清空测试数据...\n');

  try {
    // ============ 1️⃣ 清空财务相关数据 ============
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

    // ============ 2️⃣ 清空费用记录 ============
    console.log('\n2️⃣ 清空费用记录...');
    await prisma.expenseRecord.deleteMany();
    console.log('   ✅ 已清空费用记录');

    await prisma.payableRecord.deleteMany();
    console.log('   ✅ 已清空应付款记录');

    // ============ 3️⃣ 清空运输查询记录 ============
    console.log('\n3️⃣ 清空运输查询记录...');
    await prisma.shippingQuery.deleteMany();
    console.log('   ✅ 已清空运输查询');

    // ============ 4️⃣ 清空订单相关数据 ============
    console.log('\n4️⃣ 清空订单相关数据...');
    await prisma.returnOrderItem.deleteMany();
    console.log('   ✅ 已清空退货订单明细');

    await prisma.returnOrder.deleteMany();
    console.log('   ✅ 已清空退货订单');

    await prisma.factoryShipmentOrderFeeItem.deleteMany();
    console.log('   ✅ 已清空厂家发货费用项');

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

    // ============ 5️⃣ 清空采购订单 ============
    console.log('\n5️⃣ 清空采购订单...');
    await prisma.purchaseOrderItem.deleteMany();
    console.log('   ✅ 已清空采购订单明细');

    await prisma.purchaseOrder.deleteMany();
    console.log('   ✅ 已清空采购订单');

    // ============ 6️⃣ 清空库存相关数据 ============
    console.log('\n6️⃣ 清空库存相关数据...');
    await prisma.inventoryCountItem.deleteMany();
    console.log('   ✅ 已清空盘点明细');

    await prisma.inventoryCount.deleteMany();
    console.log('   ✅ 已清空盘点记录');

    await prisma.outboundRecord.deleteMany();
    console.log('   ✅ 已清空出库记录');

    await prisma.inboundRecord.deleteMany();
    console.log('   ✅ 已清空入库记录');

    await prisma.inventoryAdjustment.deleteMany();
    console.log('   ✅ 已清空库存调整记录');

    await prisma.inventoryOperation.deleteMany();
    console.log('   ✅ 已清空库存操作记录');

    await prisma.inventory.deleteMany();
    console.log('   ✅ 已清空库存');

    // ============ 7️⃣ 清空临时产品 ============
    console.log('\n7️⃣ 清空临时产品...');
    await prisma.temporaryProduct.deleteMany();
    console.log('   ✅ 已清空临时产品');

    // ============ 8️⃣ 清空产品相关数据 ============
    console.log('\n8️⃣ 清空产品相关数据...');
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

    // ============ 9️⃣ 清空客户和供应商数据 ============
    console.log('\n9️⃣ 清空客户和供应商数据...');
    await prisma.customer.deleteMany();
    console.log('   ✅ 已清空客户');

    await prisma.supplier.deleteMany();
    console.log('   ✅ 已清空供应商');

    // ============ 🔟 清空非管理员用户 ============
    console.log('\n🔟 清空非管理员用户...');
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: { not: 'admin' },
      },
    });
    console.log(`   ✅ 已删除 ${deletedUsers.count} 个非管理员用户`);

    // ============ 1️⃣1️⃣ 清空系统日志 ============
    console.log('\n1️⃣1️⃣ 清空系统日志...');
    await prisma.systemLog.deleteMany();
    console.log('   ✅ 已清空系统日志');

    await prisma.settingChangeLog.deleteMany();
    console.log('   ✅ 已清空设置变更日志');

    await prisma.loginAttempt.deleteMany();
    console.log('   ✅ 已清空登录尝试记录');

    // ============ 完成总结 ============
    console.log('\n✨ 测试数据清空完成！');
    console.log('\n📊 保留的数据：');
    console.log('   - 管理员账号');
    console.log('   - 系统配置');
    console.log('   - 运输站点配置');
    console.log('   - 订单序列号设置');

    // 统计剩余数据
    const adminCount = await prisma.user.count({
      where: { role: 'admin' },
    });
    const settingCount = await prisma.systemSetting.count();
    const shippingSiteCount = await prisma.shippingSite.count();
    const sequenceCount = await prisma.orderSequence.count();

    console.log(`\n📈 当前数据统计：`);
    console.log(`   - 管理员用户: ${adminCount} 个`);
    console.log(`   - 系统配置: ${settingCount} 项`);
    console.log(`   - 运输站点: ${shippingSiteCount} 个`);
    console.log(`   - 订单序列号: ${sequenceCount} 个`);

    // 显示管理员信息
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        status: true,
      },
    });

    console.log('\n👨‍💼 保留的管理员账户：');
    admins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.name} (@${admin.username})`);
      console.log(`      邮箱: ${admin.email}`);
      console.log(`      状态: ${admin.status}`);
    });

    console.log('\n🎉 数据清理成功！系统已恢复到初始状态。');
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
