/**
 * 验证数据清理结果
 * 检查数据库中剩余的数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyCleanData() {
  console.log('🔍 开始验证数据清理结果...\n');

  try {
    // 检查所有表的数据量
    const counts = {
      // 用户相关
      users: await prisma.user.count(),
      loginAttempts: await prisma.loginAttempt.count(),
      accountLockouts: await prisma.accountLockout.count(),

      // 客户和供应商
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),

      // 产品相关
      categories: await prisma.category.count(),
      products: await prisma.product.count(),
      productVariants: await prisma.productVariant.count(),
      temporaryProducts: await prisma.temporaryProduct.count(),
      customerProductPrices: await prisma.customerProductPrice.count(),
      supplierProductPrices: await prisma.supplierProductPrice.count(),

      // 订单相关
      salesOrders: await prisma.salesOrder.count(),
      salesOrderItems: await prisma.salesOrderItem.count(),
      salesOrderFeeItems: await prisma.salesOrderFeeItem.count(),
      purchaseOrders: await prisma.purchaseOrder.count(),
      purchaseOrderItems: await prisma.purchaseOrderItem.count(),
      factoryShipmentOrders: await prisma.factoryShipmentOrder.count(),
      factoryShipmentOrderItems: await prisma.factoryShipmentOrderItem.count(),
      returnOrders: await prisma.returnOrder.count(),
      returnOrderItems: await prisma.returnOrderItem.count(),

      // 库存相关
      inventories: await prisma.inventory.count(),
      batchSpecifications: await prisma.batchSpecification.count(),
      inboundRecords: await prisma.inboundRecord.count(),
      outboundRecords: await prisma.outboundRecord.count(),
      inventoryOperations: await prisma.inventoryOperation.count(),
      inventoryAdjustments: await prisma.inventoryAdjustment.count(),
      inventoryCounts: await prisma.inventoryCount.count(),
      inventoryCountItems: await prisma.inventoryCountItem.count(),

      // 财务相关
      paymentRecords: await prisma.paymentRecord.count(),
      refundRecords: await prisma.refundRecord.count(),
      payableRecords: await prisma.payableRecord.count(),
      paymentOutRecords: await prisma.paymentOutRecord.count(),
      expenseRecords: await prisma.expenseRecord.count(),
      accountStatements: await prisma.accountStatement.count(),
      statementTransactions: await prisma.statementTransaction.count(),

      // 物流相关
      shippingSites: await prisma.shippingSite.count(),
      shippingQueries: await prisma.shippingQuery.count(),

      // 系统相关
      orderSequences: await prisma.orderSequence.count(),
      systemSettings: await prisma.systemSetting.count(),
      settingChangeLogs: await prisma.settingChangeLog.count(),
      systemLogs: await prisma.systemLog.count(),
    };

    // 显示结果
    console.log('📊 数据统计结果：\n');

    console.log('👤 用户相关：');
    console.log(`  - 用户: ${counts.users}`);
    console.log(`  - 登录尝试记录: ${counts.loginAttempts}`);
    console.log(`  - 账户锁定记录: ${counts.accountLockouts}\n`);

    console.log('🏢 客户和供应商：');
    console.log(`  - 客户: ${counts.customers}`);
    console.log(`  - 供应商: ${counts.suppliers}\n`);

    console.log('📦 产品相关：');
    console.log(`  - 产品分类: ${counts.categories}`);
    console.log(`  - 产品: ${counts.products}`);
    console.log(`  - 产品变体: ${counts.productVariants}`);
    console.log(`  - 临时产品: ${counts.temporaryProducts}`);
    console.log(`  - 客户产品价格: ${counts.customerProductPrices}`);
    console.log(`  - 供应商产品价格: ${counts.supplierProductPrices}\n`);

    console.log('📋 订单相关：');
    console.log(`  - 销售订单: ${counts.salesOrders}`);
    console.log(`  - 销售订单明细: ${counts.salesOrderItems}`);
    console.log(`  - 销售订单费用项: ${counts.salesOrderFeeItems}`);
    console.log(`  - 采购订单: ${counts.purchaseOrders}`);
    console.log(`  - 采购订单明细: ${counts.purchaseOrderItems}`);
    console.log(`  - 厂家发货订单: ${counts.factoryShipmentOrders}`);
    console.log(`  - 厂家发货订单明细: ${counts.factoryShipmentOrderItems}`);
    console.log(`  - 退货订单: ${counts.returnOrders}`);
    console.log(`  - 退货订单明细: ${counts.returnOrderItems}\n`);

    console.log('📊 库存相关：');
    console.log(`  - 库存记录: ${counts.inventories}`);
    console.log(`  - 批次规格: ${counts.batchSpecifications}`);
    console.log(`  - 入库记录: ${counts.inboundRecords}`);
    console.log(`  - 出库记录: ${counts.outboundRecords}`);
    console.log(`  - 库存操作记录: ${counts.inventoryOperations}`);
    console.log(`  - 库存调整记录: ${counts.inventoryAdjustments}`);
    console.log(`  - 盘点记录: ${counts.inventoryCounts}`);
    console.log(`  - 盘点明细: ${counts.inventoryCountItems}\n`);

    console.log('💰 财务相关：');
    console.log(`  - 收款记录: ${counts.paymentRecords}`);
    console.log(`  - 退款记录: ${counts.refundRecords}`);
    console.log(`  - 应付款记录: ${counts.payableRecords}`);
    console.log(`  - 付款记录: ${counts.paymentOutRecords}`);
    console.log(`  - 费用记录: ${counts.expenseRecords}`);
    console.log(`  - 对账单: ${counts.accountStatements}`);
    console.log(`  - 对账单交易: ${counts.statementTransactions}\n`);

    console.log('🚚 物流相关：');
    console.log(`  - 物流站点: ${counts.shippingSites}`);
    console.log(`  - 物流查询记录: ${counts.shippingQueries}\n`);

    console.log('⚙️  系统相关：');
    console.log(`  - 订单序列号: ${counts.orderSequences}`);
    console.log(`  - 系统设置: ${counts.systemSettings}`);
    console.log(`  - 设置变更日志: ${counts.settingChangeLogs}`);
    console.log(`  - 系统日志: ${counts.systemLogs}\n`);

    // 检查是否有业务数据残留
    const hasBusinessData =
      counts.customers > 0 ||
      counts.suppliers > 0 ||
      counts.products > 0 ||
      counts.salesOrders > 0 ||
      counts.purchaseOrders > 0 ||
      counts.factoryShipmentOrders > 0 ||
      counts.inventories > 0 ||
      counts.paymentRecords > 0;

    if (hasBusinessData) {
      console.log('⚠️  警告：仍有业务数据残留！');
    } else {
      console.log('✅ 确认：所有业务数据已清理干净！');
    }

    // 显示保留的管理员信息
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
    });

    if (adminUser) {
      console.log('\n👤 保留的管理员用户：');
      console.log(`  - 用户名: ${adminUser.username}`);
      console.log(`  - 邮箱: ${adminUser.email}`);
      console.log(`  - 角色: ${adminUser.role}`);
    }

    console.log('\n✅ 验证完成！');
  } catch (error) {
    console.error('❌ 验证时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行验证
verifyCleanData()
  .then(() => {
    console.log('\n🎉 验证脚本执行成功！');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 验证脚本执行失败:', error);
    process.exit(1);
  });
