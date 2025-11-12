/**
 * 清空厂家发货数据和客户数据
 *
 * 警告：此操作不可逆！请确保已备份重要数据！
 */

import * as readline from 'readline';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function clearData() {
  console.log('⚠️  警告：清空厂家发货数据和客户数据');
  console.log('='.repeat(80));
  console.log('');
  console.log('此操作将删除以下数据：');
  console.log('  1. 所有厂家发货订单 (FactoryShipmentOrder)');
  console.log('  2. 所有厂家发货订单明细 (FactoryShipmentOrderItem)');
  console.log('  3. 所有客户 (Customer)');
  console.log('  4. 所有客户产品价格记录 (CustomerProductPrice)');
  console.log('');
  console.log('⚠️  此操作不可逆！请确保已备份重要数据！');
  console.log('');

  try {
    // 1. 统计当前数据
    console.log('📊 当前数据统计：');
    console.log('='.repeat(80));

    const stats = {
      factoryShipmentOrders: await prisma.factoryShipmentOrder.count(),
      factoryShipmentOrderItems: await prisma.factoryShipmentOrderItem.count(),
      customers: await prisma.customer.count(),
      customerProductPrices: await prisma.customerProductPrice.count(),
    };

    console.log(`  - 厂家发货订单: ${stats.factoryShipmentOrders} 条`);
    console.log(`  - 厂家发货订单明细: ${stats.factoryShipmentOrderItems} 条`);
    console.log(`  - 客户: ${stats.customers} 个`);
    console.log(`  - 客户产品价格记录: ${stats.customerProductPrices} 条`);
    console.log('');

    if (
      stats.factoryShipmentOrders === 0 &&
      stats.factoryShipmentOrderItems === 0 &&
      stats.customers === 0 &&
      stats.customerProductPrices === 0
    ) {
      console.log('✅ 数据库已经是空的，无需清空。');
      return;
    }

    // 2. 二次确认
    const answer1 = await question(
      '❓ 确定要删除以上所有数据吗？(输入 "yes" 确认): '
    );

    if (answer1.toLowerCase() !== 'yes') {
      console.log('❌ 操作已取消。');
      return;
    }

    const answer2 = await question(
      '❓ 最后确认：此操作不可逆！(输入 "DELETE" 确认): '
    );

    if (answer2 !== 'DELETE') {
      console.log('❌ 操作已取消。');
      return;
    }

    console.log('');
    console.log('🗑️  开始清空数据...');
    console.log('='.repeat(80));

    // 3. 按顺序删除数据（避免外键约束错误）

    // 3.1 删除厂家发货订单明细（子表）
    console.log('\n📍 步骤 1/4: 删除厂家发货订单明细...');
    const deletedItems = await prisma.factoryShipmentOrderItem.deleteMany({});
    console.log(`  ✅ 已删除 ${deletedItems.count} 条订单明细`);

    // 3.2 删除厂家发货订单（父表）
    console.log('\n📍 步骤 2/4: 删除厂家发货订单...');
    const deletedOrders = await prisma.factoryShipmentOrder.deleteMany({});
    console.log(`  ✅ 已删除 ${deletedOrders.count} 个订单`);

    // 3.3 删除客户产品价格记录（关联表）
    console.log('\n📍 步骤 3/4: 删除客户产品价格记录...');
    const deletedPrices = await prisma.customerProductPrice.deleteMany({});
    console.log(`  ✅ 已删除 ${deletedPrices.count} 条价格记录`);

    // 3.4 删除客户（主表）
    console.log('\n📍 步骤 4/4: 删除客户...');

    // 先检查是否有其他关联数据
    const customersWithRelations = await prisma.customer.findMany({
      include: {
        salesOrders: true,
        outboundRecords: true,
        paymentRecords: true,
        returnOrders: true,
        refundRecords: true,
      },
    });

    const customersWithData = customersWithRelations.filter(
      c =>
        c.salesOrders.length > 0 ||
        c.outboundRecords.length > 0 ||
        c.paymentRecords.length > 0 ||
        c.returnOrders.length > 0 ||
        c.refundRecords.length > 0
    );

    if (customersWithData.length > 0) {
      console.log(
        `  ⚠️  警告: 有 ${customersWithData.length} 个客户有其他关联数据，无法删除：`
      );
      customersWithData.forEach(c => {
        console.log(`    - ${c.name}:`);
        if (c.salesOrders.length > 0) {
          console.log(`      · 销售订单: ${c.salesOrders.length}`);
        }
        if (c.outboundRecords.length > 0) {
          console.log(`      · 出库记录: ${c.outboundRecords.length}`);
        }
        if (c.paymentRecords.length > 0) {
          console.log(`      · 付款记录: ${c.paymentRecords.length}`);
        }
        if (c.returnOrders.length > 0) {
          console.log(`      · 退货订单: ${c.returnOrders.length}`);
        }
        if (c.refundRecords.length > 0) {
          console.log(`      · 退款记录: ${c.refundRecords.length}`);
        }
      });
      console.log('');
      console.log('  ℹ️  只删除没有其他关联数据的客户...');
    }

    const deletedCustomers = await prisma.customer.deleteMany({
      where: {
        AND: [
          { salesOrders: { none: {} } },
          { outboundRecords: { none: {} } },
          { paymentRecords: { none: {} } },
          { returnOrders: { none: {} } },
          { refundRecords: { none: {} } },
        ],
      },
    });
    console.log(`  ✅ 已删除 ${deletedCustomers.count} 个客户`);

    // 4. 验证结果
    console.log('');
    console.log('📊 清空后数据统计：');
    console.log('='.repeat(80));

    const finalStats = {
      factoryShipmentOrders: await prisma.factoryShipmentOrder.count(),
      factoryShipmentOrderItems: await prisma.factoryShipmentOrderItem.count(),
      customers: await prisma.customer.count(),
      customerProductPrices: await prisma.customerProductPrice.count(),
    };

    console.log(`  - 厂家发货订单: ${finalStats.factoryShipmentOrders} 条`);
    console.log(
      `  - 厂家发货订单明细: ${finalStats.factoryShipmentOrderItems} 条`
    );
    console.log(`  - 客户: ${finalStats.customers} 个`);
    console.log(`  - 客户产品价格记录: ${finalStats.customerProductPrices} 条`);

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ 数据清空完成！');
    console.log('');
    console.log('📋 删除汇总：');
    console.log(`  - 厂家发货订单明细: ${deletedItems.count} 条`);
    console.log(`  - 厂家发货订单: ${deletedOrders.count} 个`);
    console.log(`  - 客户产品价格记录: ${deletedPrices.count} 条`);
    console.log(`  - 客户: ${deletedCustomers.count} 个`);

    if (finalStats.customers > 0) {
      console.log('');
      console.log(
        `⚠️  注意: 还有 ${finalStats.customers} 个客户因为有其他关联数据未被删除`
      );
    }
  } catch (error) {
    console.error('');
    console.error('❌ 清空数据失败:', error);
    throw error;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// 运行清空脚本
clearData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
