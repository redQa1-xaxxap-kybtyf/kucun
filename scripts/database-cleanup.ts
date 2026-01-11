/**
 * 全面清理测试数据脚本
 *
 * 功能：
 * 1. 删除所有测试数据（客户、产品、订单、库存等）
 * 2. 保留管理员用户账户（role = 'ADMIN'）
 * 3. 保留系统配置数据
 * 4. 在事务中执行，确保原子性
 * 5. 详细记录删除的数据统计
 *
 * 使用方法：
 *   npx tsx scripts/database-cleanup.ts
 */

/* eslint-disable no-console, max-lines-per-function */

import type { Prisma } from '@prisma/client';

import 'dotenv/config';
import { prisma } from '../lib/db';

interface CleanupStats {
  [key: string]: number;
}

async function performCleanup(
  tx: Prisma.TransactionClient,
  adminUserIds: string[],
  stats: CleanupStats
): Promise<void> {
  // 步骤 2: 删除库存相关数据
  console.log('\n📍 步骤 2: 清理库存相关数据');

  stats['库存成本队列'] = (await tx.inventoryCostQueue.deleteMany({})).count;
  console.log(`   ✓ 删除库存成本队列: ${stats['库存成本队列']} 条`);

  stats['库存盘点明细'] = (await tx.inventoryCountItem.deleteMany({})).count;
  console.log(`   ✓ 删除库存盘点明细: ${stats['库存盘点明细']} 条`);

  stats['库存盘点'] = (await tx.inventoryCount.deleteMany({})).count;
  console.log(`   ✓ 删除库存盘点: ${stats['库存盘点']} 条`);

  stats['库存调整'] = (await tx.inventoryAdjustment.deleteMany({})).count;
  console.log(`   ✓ 删除库存调整: ${stats['库存调整']} 条`);

  stats['库存操作记录'] = (await tx.inventoryOperation.deleteMany({})).count;
  console.log(`   ✓ 删除库存操作记录: ${stats['库存操作记录']} 条`);

  stats['出库记录'] = (await tx.outboundRecord.deleteMany({})).count;
  console.log(`   ✓ 删除出库记录: ${stats['出库记录']} 条`);

  stats['入库记录'] = (await tx.inboundRecord.deleteMany({})).count;
  console.log(`   ✓ 删除入库记录: ${stats['入库记录']} 条`);

  stats['批次规格'] = (await tx.batchSpecification.deleteMany({})).count;
  console.log(`   ✓ 删除批次规格: ${stats['批次规格']} 条`);

  stats['库存'] = (await tx.inventory.deleteMany({})).count;
  console.log(`   ✓ 删除库存: ${stats['库存']} 条`);

  // 步骤 3: 删除财务相关数据
  console.log('\n📍 步骤 3: 清理财务相关数据');

  stats['账户流水'] = (await tx.statementTransaction.deleteMany({})).count;
  console.log(`   ✓ 删除账户流水: ${stats['账户流水']} 条`);

  stats['账户对账单'] = (await tx.accountStatement.deleteMany({})).count;
  console.log(`   ✓ 删除账户对账单: ${stats['账户对账单']} 条`);

  stats['退款记录'] = (await tx.refundRecord.deleteMany({})).count;
  console.log(`   ✓ 删除退款记录: ${stats['退款记录']} 条`);

  stats['收款记录'] = (await tx.paymentRecord.deleteMany({})).count;
  console.log(`   ✓ 删除收款记录: ${stats['收款记录']} 条`);

  stats['付款记录'] = (await tx.paymentOutRecord.deleteMany({})).count;
  console.log(`   ✓ 删除付款记录: ${stats['付款记录']} 条`);

  stats['应付账款'] = (await tx.payableRecord.deleteMany({})).count;
  console.log(`   ✓ 删除应付账款: ${stats['应付账款']} 条`);

  stats['费用记录'] = (await tx.expenseRecord.deleteMany({})).count;
  console.log(`   ✓ 删除费用记录: ${stats['费用记录']} 条`);

  // 步骤 4: 删除订单相关数据
  console.log('\n📍 步骤 4: 清理订单相关数据');

  stats['退货单明细'] = (await tx.returnOrderItem.deleteMany({})).count;
  console.log(`   ✓ 删除退货单明细: ${stats['退货单明细']} 条`);

  stats['退货单'] = (await tx.returnOrder.deleteMany({})).count;
  console.log(`   ✓ 删除退货单: ${stats['退货单']} 条`);

  stats['工厂发货单运费明细'] = (
    await tx.factoryShipmentOrderFeeItem.deleteMany({})
  ).count;
  console.log(`   ✓ 删除工厂发货单运费明细: ${stats['工厂发货单运费明细']} 条`);

  stats['运输查询记录'] = (await tx.shippingQuery.deleteMany({})).count;
  console.log(`   ✓ 删除运输查询记录: ${stats['运输查询记录']} 条`);

  stats['工厂发货单明细'] = (
    await tx.factoryShipmentOrderItem.deleteMany({})
  ).count;
  console.log(`   ✓ 删除工厂发货单明细: ${stats['工厂发货单明细']} 条`);

  stats['工厂发货单'] = (await tx.factoryShipmentOrder.deleteMany({})).count;
  console.log(`   ✓ 删除工厂发货单: ${stats['工厂发货单']} 条`);

  stats['采购订单明细'] = (await tx.purchaseOrderItem.deleteMany({})).count;
  console.log(`   ✓ 删除采购订单明细: ${stats['采购订单明细']} 条`);

  stats['采购订单'] = (await tx.purchaseOrder.deleteMany({})).count;
  console.log(`   ✓ 删除采购订单: ${stats['采购订单']} 条`);

  stats['销售订单费用明细'] = (await tx.salesOrderFeeItem.deleteMany({})).count;
  console.log(`   ✓ 删除销售订单费用明细: ${stats['销售订单费用明细']} 条`);

  stats['销售订单明细'] = (await tx.salesOrderItem.deleteMany({})).count;
  console.log(`   ✓ 删除销售订单明细: ${stats['销售订单明细']} 条`);

  stats['销售订单'] = (await tx.salesOrder.deleteMany({})).count;
  console.log(`   ✓ 删除销售订单: ${stats['销售订单']} 条`);

  // 步骤 5: 删除产品相关数据
  console.log('\n📍 步骤 5: 清理产品相关数据');

  stats['客户产品价格'] = (await tx.customerProductPrice.deleteMany({})).count;
  console.log(`   ✓ 删除客户产品价格: ${stats['客户产品价格']} 条`);

  stats['供应商产品价格'] = (
    await tx.supplierProductPrice.deleteMany({})
  ).count;
  console.log(`   ✓ 删除供应商产品价格: ${stats['供应商产品价格']} 条`);

  stats['临时产品'] = (await tx.temporaryProduct.deleteMany({})).count;
  console.log(`   ✓ 删除临时产品: ${stats['临时产品']} 条`);

  stats['产品变体'] = (await tx.productVariant.deleteMany({})).count;
  console.log(`   ✓ 删除产品变体: ${stats['产品变体']} 条`);

  stats['产品'] = (await tx.product.deleteMany({})).count;
  console.log(`   ✓ 删除产品: ${stats['产品']} 条`);

  stats['产品分类'] = (await tx.category.deleteMany({})).count;
  console.log(`   ✓ 删除产品分类: ${stats['产品分类']} 条`);

  // 步骤 6: 删除客户和供应商数据
  console.log('\n📍 步骤 6: 清理客户和供应商数据');

  stats['客户'] = (await tx.customer.deleteMany({})).count;
  console.log(`   ✓ 删除客户: ${stats['客户']} 条`);

  stats['供应商'] = (await tx.supplier.deleteMany({})).count;
  console.log(`   ✓ 删除供应商: ${stats['供应商']} 条`);

  // 步骤 7: 删除非管理员用户数据
  console.log('\n📍 步骤 7: 清理非管理员用户数据');

  stats['登录日志'] = (
    await tx.loginLog.deleteMany({
      where: { userId: { notIn: adminUserIds } },
    })
  ).count;
  console.log(`   ✓ 删除非管理员登录日志: ${stats['登录日志']} 条`);

  stats['系统日志'] = (
    await tx.systemLog.deleteMany({
      where: { userId: { notIn: adminUserIds } },
    })
  ).count;
  console.log(`   ✓ 删除非管理员系统日志: ${stats['系统日志']} 条`);

  stats['非管理员用户'] = (
    await tx.user.deleteMany({
      where: { role: { not: 'ADMIN' } },
    })
  ).count;
  console.log(`   ✓ 删除非管理员用户: ${stats['非管理员用户']} 条`);

  // 步骤 8: 重置订单序号
  console.log('\n📍 步骤 8: 重置订单序号');

  stats['订单序号'] = (await tx.orderSequence.deleteMany({})).count;
  console.log(`   ✓ 删除订单序号: ${stats['订单序号']} 条`);
}

async function displayStats(stats: CleanupStats): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 数据清理统计：');
  console.log('='.repeat(80));

  let totalDeleted = 0;
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => {
      console.log(`   ${key.padEnd(20)}: ${count.toLocaleString()} 条`);
      totalDeleted += count;
    });

  console.log('='.repeat(80));
  console.log(`   总计删除: ${totalDeleted.toLocaleString()} 条记录`);
  console.log('='.repeat(80));
}

async function verifyRemainingData(): Promise<void> {
  console.log('\n📍 验证保留的数据：');

  const remainingAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, username: true, name: true },
    take: 1000,
  });

  console.log(`\n✅ 保留的管理员账户 (${remainingAdmins.length} 个):`);
  remainingAdmins.forEach(admin => {
    console.log(`   - ${admin.name} (${admin.email})`);
  });

  const systemSettings = await prisma.systemSetting.count();
  console.log(`\n✅ 保留的系统配置: ${systemSettings} 条`);
}

async function main() {
  console.log('\n🧹 开始全面清理测试数据\n');
  console.log('='.repeat(80));
  console.log('⚠️  警告：此操作将删除所有测试数据，仅保留管理员账户和系统配置');
  console.log('='.repeat(80));
  console.log('\n⏱️  预计执行时间：1-5分钟（取决于数据量）\n');

  const stats: CleanupStats = {};

  try {
    await prisma.$transaction(
      async tx => {
        console.log('📊 开始数据清理事务...\n');

        console.log('📍 步骤 1: 识别管理员账户（将保留）');
        const adminUsers = await tx.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true, email: true, username: true, name: true },
          take: 1000,
        });

        console.log(`✅ 找到 ${adminUsers.length} 个管理员账户：`);
        adminUsers.forEach(admin => {
          console.log(`   - ${admin.name} (${admin.email})`);
        });

        const adminUserIds = adminUsers.map(u => u.id);
        await performCleanup(tx, adminUserIds, stats);

        console.log('\n✅ 事务中的所有删除操作完成');
      },
      {
        maxWait: 300000,
        timeout: 600000,
      }
    );

    await displayStats(stats);
    await verifyRemainingData();

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ 数据库清理完成！');
    console.log('='.repeat(80));
    console.log('\n💡 提示：');
    console.log('   1. 所有测试数据已删除');
    console.log('   2. 管理员账户已保留');
    console.log('   3. 系统配置已保留');
    console.log('   4. 订单序号已重置');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ 清理失败:', error);
    console.error('\n⚠️  事务已回滚，数据库未发生任何更改');
    throw error;
  }
}

main()
  .catch(error => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
