/**
 * 清理所有测试数据脚本
 * 开发环境专用 - 删除所有业务数据，保留数据库结构
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始清理所有测试数据...\n');
  console.log('⚠️  警告: 这将删除所有业务数据！');
  console.log('='.repeat(60));

  try {
    // 1. 统计当前数据
    console.log('\n📊 当前数据统计:');
    const beforeStats = {
      users: await prisma.user.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      categories: await prisma.category.count(),
      productVariants: await prisma.productVariant.count(),
      salesOrders: await prisma.salesOrder.count(),
      factoryOrders: await prisma.factoryShipmentOrder.count(),
      purchaseOrders: await prisma.purchaseOrder.count(),
      returnOrders: await prisma.returnOrder.count(),
      inventory: await prisma.inventory.count(),
      paymentRecords: await prisma.paymentRecord.count(),
      payableRecords: await prisma.payableRecord.count(),
      refundRecords: await prisma.refundRecord.count(),
      accountStatements: await prisma.accountStatement.count(),
      systemLogs: await prisma.systemLog.count(),
    };

    console.log(JSON.stringify(beforeStats, null, 2));

    // 2. 备份数据库文件
    console.log('\n💾 备份数据库文件...');
    const backupPath = `prisma/dev.db.backup.${Date.now()}`;
    console.log(`   备份路径: ${backupPath}`);
    console.log('   (请手动备份 prisma/dev.db 文件)');

    // 3. 按依赖关系顺序删除数据
    console.log('\n🗑️  开始删除数据...\n');

    // 3.1 财务相关数据
    console.log('1️⃣ 清空财务相关数据...');
    await prisma.statementTransaction.deleteMany();
    console.log('   ✅ 已清空账单交易');

    await prisma.accountStatement.deleteMany();
    console.log('   ✅ 已清空往来账单');

    await prisma.refundRecord.deleteMany();
    console.log('   ✅ 已清空退款记录');

    await prisma.paymentRecord.deleteMany();
    console.log('   ✅ 已清空收款记录');

    await prisma.paymentOutRecord.deleteMany();
    console.log('   ✅ 已清空应付款付款记录');

    await prisma.payableRecord.deleteMany();
    console.log('   ✅ 已清空应付款记录');

    // 3.2 订单相关数据
    console.log('\n2️⃣ 清空订单相关数据...');

    await prisma.returnOrderItem.deleteMany();
    console.log('   ✅ 已清空退货订单明细');

    await prisma.returnOrder.deleteMany();
    console.log('   ✅ 已清空退货订单');

    await prisma.purchaseOrderItem.deleteMany();
    console.log('   ✅ 已清空采购订单明细');

    await prisma.purchaseOrder.deleteMany();
    console.log('   ✅ 已清空采购订单');

    await prisma.shippingQuery.deleteMany();
    console.log('   ✅ 已清空运输查询记录');

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

    // 3.3 库存相关数据
    console.log('\n3️⃣ 清空库存相关数据...');

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

    await prisma.inventory.deleteMany();
    console.log('   ✅ 已清空库存');

    // 3.4 产品相关数据
    console.log('\n4️⃣ 清空产品相关数据...');

    await prisma.batchSpecification.deleteMany();
    console.log('   ✅ 已清空批次规格');

    await prisma.customerProductPrice.deleteMany();
    console.log('   ✅ 已清空客户产品价格');

    await prisma.supplierProductPrice.deleteMany();
    console.log('   ✅ 已清空供应商产品价格');

    await prisma.productVariant.deleteMany();
    console.log('   ✅ 已清空产品变体');

    await prisma.product.deleteMany();
    console.log('   ✅ 已清空产品');

    await prisma.category.deleteMany();
    console.log('   ✅ 已清空分类');

    // 3.5 客户和供应商数据
    console.log('\n5️⃣ 清空客户和供应商数据...');

    await prisma.customer.deleteMany();
    console.log('   ✅ 已清空客户');

    await prisma.supplier.deleteMany();
    console.log('   ✅ 已清空供应商');

    // 3.6 用户数据（保留管理员）
    console.log('\n6️⃣ 清空非管理员用户...');
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: { not: 'admin' },
      },
    });
    console.log(`   ✅ 已删除 ${deletedUsers.count} 个非管理员用户`);

    // 3.7 系统日志
    console.log('\n7️⃣ 清空系统日志...');

    await prisma.systemLog.deleteMany();
    console.log('   ✅ 已清空系统日志');

    await prisma.settingChangeLog.deleteMany();
    console.log('   ✅ 已清空设置变更日志');

    await prisma.loginAttempt.deleteMany();
    console.log('   ✅ 已清空登录尝试记录');

    // 3.8 其他数据
    console.log('\n8️⃣ 清空其他数据...');

    await prisma.expense.deleteMany();
    console.log('   ✅ 已清空费用记录');

    await prisma.shippingSite.deleteMany();
    console.log('   ✅ 已清空运输站点配置');

    // 4. 统计清理后的数据
    console.log('\n📊 清理后数据统计:');
    const afterStats = {
      users: await prisma.user.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      categories: await prisma.category.count(),
      productVariants: await prisma.productVariant.count(),
      salesOrders: await prisma.salesOrder.count(),
      factoryOrders: await prisma.factoryShipmentOrder.count(),
      purchaseOrders: await prisma.purchaseOrder.count(),
      returnOrders: await prisma.returnOrder.count(),
      inventory: await prisma.inventory.count(),
      paymentRecords: await prisma.paymentRecord.count(),
      payableRecords: await prisma.payableRecord.count(),
      refundRecords: await prisma.refundRecord.count(),
      accountStatements: await prisma.accountStatement.count(),
      systemLogs: await prisma.systemLog.count(),
    };

    console.log(JSON.stringify(afterStats, null, 2));

    // 5. 显示保留的管理员信息
    console.log('\n👨‍💼 保留的管理员账户:');
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

    if (admins.length === 0) {
      console.log('   ⚠️  警告: 没有管理员账户！');
      console.log('   请运行: npx tsx scripts/create-correct-admin.ts');
    } else {
      admins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.name} (@${admin.username})`);
        console.log(`      邮箱: ${admin.email}`);
        console.log(`      状态: ${admin.status}`);
      });
    }

    console.log('\n✨ 所有测试数据清理完成！');
    console.log('\n💡 下一步操作:');
    console.log('   1. 如需生成新的测试数据: npm run db:seed');
    console.log(
      '   2. 如需创建管理员账户: npx tsx scripts/create-correct-admin.ts'
    );
    console.log('   3. 启动开发服务器: npm run dev');
  } catch (error) {
    console.error('\n❌ 清理数据失败:', error);
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
