#!/usr/bin/env tsx

/**
 * 清空数据库脚本
 * 删除所有业务数据，但保留管理员账户
 *
 * ⚠️ 警告：此脚本会删除所有业务数据，请谨慎使用！
 * 仅适用于开发和测试环境
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🧹 开始清空数据库...\n');
  console.log('⚠️  警告：此操作将删除所有业务数据，但保留管理员账户！\n');

  try {
    // 1. 清空运输查询相关数据
    console.log('1️⃣ 清空运输查询数据...');
    await prisma.shippingQuery.deleteMany();
    console.log('   ✅ 已清空运输查询记录');

    // 2. 清空登录记录和账户锁定记录
    console.log('\n2️⃣ 清空登录记录...');
    await prisma.loginAttempt.deleteMany();
    console.log('   ✅ 已清空登录尝试记录');

    await prisma.accountLockout.deleteMany();
    console.log('   ✅ 已清空账户锁定记录');

    // 3. 清空付款相关数据
    console.log('\n3️⃣ 清空付款数据...');
    await prisma.paymentOutRecord.deleteMany();
    console.log('   ✅ 已清空付款记录');

    await prisma.payableRecord.deleteMany();
    console.log('   ✅ 已清空应付款记录');

    // 4. 清空系统日志和设置
    console.log('\n4️⃣ 清空系统日志和设置...');
    await prisma.systemLog.deleteMany();
    console.log('   ✅ 已清空系统日志');

    await prisma.settingChangeLog.deleteMany();
    console.log('   ✅ 已清空设置变更日志');

    await prisma.systemSetting.deleteMany();
    console.log('   ✅ 已清空系统设置');

    // 5. 清空订单序列
    console.log('\n5️⃣ 清空订单序列...');
    await prisma.orderSequence.deleteMany();
    console.log('   ✅ 已清空订单序列');

    // 6. 清空往来账单
    console.log('\n6️⃣ 清空往来账单...');
    await prisma.statementTransaction.deleteMany();
    console.log('   ✅ 已清空账单交易记录');

    await prisma.accountStatement.deleteMany();
    console.log('   ✅ 已清空往来账单');

    // 7. 清空退款和退货
    console.log('\n7️⃣ 清空退款和退货数据...');
    await prisma.refundRecord.deleteMany();
    console.log('   ✅ 已清空退款记录');

    await prisma.returnOrderItem.deleteMany();
    console.log('   ✅ 已清空退货订单明细');

    await prisma.returnOrder.deleteMany();
    console.log('   ✅ 已清空退货订单');

    // 8. 清空厂家发货订单
    console.log('\n8️⃣ 清空厂家发货订单...');
    await prisma.factoryShipmentOrderItem.deleteMany();
    console.log('   ✅ 已清空厂家发货订单明细');

    await prisma.factoryShipmentOrder.deleteMany();
    console.log('   ✅ 已清空厂家发货订单');

    // 9. 清空收款记录
    console.log('\n9️⃣ 清空收款记录...');
    await prisma.paymentRecord.deleteMany();
    console.log('   ✅ 已清空收款记录');

    // 10. 清空库存调整和操作记录
    console.log('\n🔟 清空库存调整记录...');
    await prisma.inventoryAdjustment.deleteMany();
    console.log('   ✅ 已清空库存调整记录');

    await prisma.inventoryOperation.deleteMany();
    console.log('   ✅ 已清空库存操作记录');

    // 11. 清空出入库记录
    console.log('\n1️⃣1️⃣ 清空出入库记录...');
    await prisma.outboundRecord.deleteMany();
    console.log('   ✅ 已清空出库记录');

    await prisma.inboundRecord.deleteMany();
    console.log('   ✅ 已清空入库记录');

    // 12. 清空批次规格
    console.log('\n1️⃣2️⃣ 清空批次规格...');
    await prisma.batchSpecification.deleteMany();
    console.log('   ✅ 已清空批次规格');

    // 13. 清空库存
    console.log('\n1️⃣3️⃣ 清空库存...');
    await prisma.inventory.deleteMany();
    console.log('   ✅ 已清空库存记录');

    // 14. 清空价格历史
    console.log('\n1️⃣4️⃣ 清空价格历史...');
    await prisma.customerProductPrice.deleteMany();
    console.log('   ✅ 已清空客户产品价格历史');

    await prisma.supplierProductPrice.deleteMany();
    console.log('   ✅ 已清空供应商产品价格历史');

    // 15. 清空销售订单
    console.log('\n1️⃣5️⃣ 清空销售订单...');
    await prisma.salesOrderFeeItem.deleteMany();
    console.log('   ✅ 已清空销售订单费用项');

    await prisma.salesOrderItem.deleteMany();
    console.log('   ✅ 已清空销售订单明细');

    await prisma.salesOrder.deleteMany();
    console.log('   ✅ 已清空销售订单');

    // 16. 清空产品和变体
    console.log('\n1️⃣6️⃣ 清空产品数据...');
    await prisma.productVariant.deleteMany();
    console.log('   ✅ 已清空产品变体');

    await prisma.product.deleteMany();
    console.log('   ✅ 已清空产品');

    // 17. 清空分类
    console.log('\n1️⃣7️⃣ 清空分类...');
    await prisma.category.deleteMany();
    console.log('   ✅ 已清空产品分类');

    // 18. 清空供应商
    console.log('\n1️⃣8️⃣ 清空供应商...');
    await prisma.supplier.deleteMany();
    console.log('   ✅ 已清空供应商');

    // 19. 清空客户
    console.log('\n1️⃣9️⃣ 清空客户...');
    await prisma.customer.deleteMany();
    console.log('   ✅ 已清空客户');

    // 20. 清空非管理员用户
    console.log('\n2️⃣0️⃣ 清空非管理员用户...');
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: {
          not: 'admin',
        },
      },
    });
    console.log(`   ✅ 已清空 ${deletedUsers.count} 个非管理员用户`);

    // 21. 验证管理员账户
    console.log('\n2️⃣1️⃣ 验证管理员账户...');
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'admin',
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
      },
    });

    if (adminUsers.length === 0) {
      console.log('   ⚠️  警告：没有找到管理员账户！');
    } else {
      console.log(`   ✅ 保留了 ${adminUsers.length} 个管理员账户：`);
      adminUsers.forEach(admin => {
        console.log(
          `      - ${admin.name} (${admin.username} / ${admin.email})`
        );
      });
    }

    console.log('\n✨ 数据库清空完成！');
    console.log('\n📊 保留的数据：');
    console.log('   - 管理员账户');
    console.log('\n💡 提示：');
    console.log('   - 运行 npm run db:seed 可以重新生成测试数据');
    console.log('   - 运行 npx tsx scripts/verify-admin.ts 可以验证管理员账户');
  } catch (error) {
    console.error('\n❌ 清空数据库失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清空操作
clearDatabase();
