/**
 * 清理测试数据脚本
 * 删除所有业务数据，只保留管理员用户和系统配置
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTestData() {
  console.log('🧹 开始清理测试数据...\n');

  try {
    // 1. 删除所有业务数据（按依赖关系从子表到父表）
    console.log('📋 第一步：删除订单相关数据');

    // 1.1 销售订单相关
    console.log('  - 删除销售订单费用项...');
    await prisma.salesOrderFeeItem.deleteMany({});

    console.log('  - 删除销售订单明细...');
    await prisma.salesOrderItem.deleteMany({});

    console.log('  - 删除销售订单...');
    await prisma.salesOrder.deleteMany({});

    // 1.2 采购订单相关
    console.log('  - 删除采购订单明细...');
    await prisma.purchaseOrderItem.deleteMany({});

    console.log('  - 删除采购订单...');
    await prisma.purchaseOrder.deleteMany({});

    // 1.3 厂家发货订单相关
    console.log('  - 删除厂家发货订单明细...');
    await prisma.factoryShipmentOrderItem.deleteMany({});

    console.log('  - 删除厂家发货订单...');
    await prisma.factoryShipmentOrder.deleteMany({});

    // 1.4 退货订单相关
    console.log('  - 删除退货订单明细...');
    await prisma.returnOrderItem.deleteMany({});

    console.log('  - 删除退货订单...');
    await prisma.returnOrder.deleteMany({});

    console.log('✅ 订单相关数据已清理\n');

    // 2. 删除财务数据
    console.log('📋 第二步：删除财务数据');

    console.log('  - 删除收款记录...');
    await prisma.paymentRecord.deleteMany({});

    console.log('  - 删除退款记录...');
    await prisma.refundRecord.deleteMany({});

    console.log('  - 删除应付款记录...');
    await prisma.payableRecord.deleteMany({});

    console.log('  - 删除付款记录...');
    await prisma.paymentOutRecord.deleteMany({});

    console.log('  - 删除费用记录...');
    await prisma.expenseRecord.deleteMany({});

    console.log('  - 删除对账单交易记录...');
    await prisma.statementTransaction.deleteMany({});

    console.log('  - 删除对账单...');
    await prisma.accountStatement.deleteMany({});

    console.log('✅ 财务数据已清理\n');

    // 3. 删除库存数据
    console.log('📋 第三步：删除库存数据');

    console.log('  - 删除盘点明细...');
    await prisma.inventoryCountItem.deleteMany({});

    console.log('  - 删除盘点记录...');
    await prisma.inventoryCount.deleteMany({});

    console.log('  - 删除入库记录...');
    await prisma.inboundRecord.deleteMany({});

    console.log('  - 删除出库记录...');
    await prisma.outboundRecord.deleteMany({});

    console.log('  - 删除库存调整记录...');
    await prisma.inventoryAdjustment.deleteMany({});

    console.log('  - 删除库存操作记录...');
    await prisma.inventoryOperation.deleteMany({});

    console.log('  - 删除批次规格...');
    await prisma.batchSpecification.deleteMany({});

    console.log('  - 删除库存记录...');
    await prisma.inventory.deleteMany({});

    console.log('✅ 库存数据已清理\n');

    // 4. 删除产品数据
    console.log('📋 第四步：删除产品数据');

    console.log('  - 删除客户产品价格...');
    await prisma.customerProductPrice.deleteMany({});

    console.log('  - 删除供应商产品价格...');
    await prisma.supplierProductPrice.deleteMany({});

    console.log('  - 删除产品变体...');
    await prisma.productVariant.deleteMany({});

    console.log('  - 删除产品...');
    await prisma.product.deleteMany({});

    console.log('  - 删除临时产品...');
    await prisma.temporaryProduct.deleteMany({});

    console.log('  - 删除产品分类...');
    await prisma.category.deleteMany({});

    console.log('✅ 产品数据已清理\n');

    // 5. 删除客户和供应商数据
    console.log('📋 第五步：删除客户和供应商数据');

    console.log('  - 删除客户...');
    await prisma.customer.deleteMany({});

    console.log('  - 删除供应商...');
    await prisma.supplier.deleteMany({});

    console.log('✅ 客户和供应商数据已清理\n');

    // 6. 删除物流查询数据
    console.log('📋 第六步：删除物流查询数据');

    console.log('  - 删除物流查询记录...');
    await prisma.shippingQuery.deleteMany({});

    console.log('✅ 物流查询数据已清理\n');

    // 7. 删除订单序列号
    console.log('📋 第七步：删除订单序列号');

    console.log('  - 删除订单序列号...');
    await prisma.orderSequence.deleteMany({});

    console.log('✅ 订单序列号已清理\n');

    // 8. 删除系统日志（保留系统设置）
    console.log('📋 第八步：删除系统日志');

    console.log('  - 删除系统日志...');
    await prisma.systemLog.deleteMany({});

    console.log('  - 删除设置变更日志...');
    await prisma.settingChangeLog.deleteMany({});

    console.log('  - 删除登录尝试记录...');
    await prisma.loginAttempt.deleteMany({});

    console.log('  - 删除账户锁定记录...');
    await prisma.accountLockout.deleteMany({});

    console.log('✅ 系统日志已清理\n');

    // 9. 删除非管理员用户
    console.log('📋 第九步：删除非管理员用户');

    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'admin',
      },
    });

    if (adminUser) {
      console.log(
        `  - 保留管理员用户: ${adminUser.username} (${adminUser.email})`
      );

      const deletedUsers = await prisma.user.deleteMany({
        where: {
          id: {
            not: adminUser.id,
          },
        },
      });

      console.log(`  - 删除了 ${deletedUsers.count} 个非管理员用户`);
    } else {
      console.log('  ⚠️  警告：未找到管理员用户，跳过用户清理');
    }

    console.log('✅ 用户数据已清理\n');

    // 10. 统计剩余数据
    console.log('📊 数据清理完成！剩余数据统计：\n');

    const userCount = await prisma.user.count();
    const settingCount = await prisma.systemSetting.count();
    const shippingSiteCount = await prisma.shippingSite.count();

    console.log(`  - 用户数量: ${userCount}`);
    console.log(`  - 系统设置数量: ${settingCount}`);
    console.log(`  - 物流站点数量: ${shippingSiteCount}`);

    console.log('\n✅ 所有测试数据已清理完成！');
    console.log('✅ 已保留：管理员用户、系统设置、物流站点配置');
  } catch (error) {
    console.error('❌ 清理数据时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
cleanTestData()
  .then(() => {
    console.log('\n🎉 脚本执行成功！');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 脚本执行失败:', error);
    process.exit(1);
  });
