/**
 * 临时商品保存问题诊断脚本
 *
 * 用途：检查调货销售订单中临时商品未保存到数据库的问题
 *
 * 运行方式：
 * npx tsx scripts/diagnose-temporary-products.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('🔍 开始诊断临时商品保存问题...\n');

  // 1. 检查临时商品表
  console.log('📊 步骤 1: 检查临时商品表数据');
  const temporaryProducts = await prisma.temporaryProduct.findMany({
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
      creator: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log(`✅ 临时商品总数: ${temporaryProducts.length}`);
  if (temporaryProducts.length > 0) {
    console.log('\n最近的临时商品:');
    temporaryProducts.forEach((tp, index) => {
      console.log(`  ${index + 1}. [${tp.code}] ${tp.name}`);
      console.log(`     供应商: ${tp.supplier.name}`);
      console.log(`     使用次数: ${tp.usageCount}`);
      console.log(
        `     最后使用: ${tp.lastUsedAt ? new Date(tp.lastUsedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '从未使用'}`
      );
      console.log(
        `     创建时间: ${new Date(tp.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
      );
    });
  } else {
    console.log('⚠️  临时商品表为空！');
  }

  // 2. 检查调货销售订单
  console.log('\n📊 步骤 2: 检查调货销售订单');
  const transferOrders = await prisma.salesOrder.findMany({
    where: {
      orderType: 'TRANSFER',
    },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          productCode: true,
          temporaryProductId: true,
          isManualProduct: true,
          manualProductName: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  console.log(`✅ 调货销售订单总数: ${transferOrders.length}`);

  if (transferOrders.length > 0) {
    console.log('\n最近的调货销售订单:');
    transferOrders.forEach((order, index) => {
      console.log(`\n  ${index + 1}. 订单号: ${order.orderNumber}`);
      console.log(`     供应商: ${order.supplier?.name || '未设置'}`);
      console.log(`     订单项数量: ${order.items.length}`);

      const manualItems = order.items.filter(item => item.isManualProduct);
      console.log(`     手动商品数量: ${manualItems.length}`);

      if (manualItems.length > 0) {
        console.log('     手动商品详情:');
        manualItems.forEach((item, idx) => {
          console.log(
            `       ${idx + 1}. 商品名称: ${item.manualProductName || '未填写'}`
          );
          console.log(`          产品编码: ${item.productCode || '未填写'}`);
          console.log(
            `          临时商品ID: ${item.temporaryProductId || '❌ 未关联'}`
          );
        });
      }
    });
  } else {
    console.log('⚠️  没有找到调货销售订单！');
  }

  // 3. 检查订单项中的临时商品关联
  console.log('\n📊 步骤 3: 检查订单项中的临时商品关联');
  const itemsWithTempProduct = await prisma.salesOrderItem.findMany({
    where: {
      temporaryProductId: {
        not: null,
      },
    },
    include: {
      temporaryProduct: true,
      salesOrder: {
        select: {
          orderNumber: true,
          orderType: true,
        },
      },
    },
    take: 10,
  });

  console.log(`✅ 关联了临时商品的订单项数量: ${itemsWithTempProduct.length}`);
  if (itemsWithTempProduct.length > 0) {
    console.log('\n关联了临时商品的订单项:');
    itemsWithTempProduct.forEach((item, index) => {
      console.log(`  ${index + 1}. 订单: ${item.salesOrder.orderNumber}`);
      console.log(
        `     临时商品: [${item.temporaryProduct?.code}] ${item.temporaryProduct?.name}`
      );
    });
  }

  // 4. 检查手动商品但未关联临时商品的订单项
  console.log('\n📊 步骤 4: 检查手动商品但未关联临时商品的订单项（问题项）');
  const problematicItems = await prisma.salesOrderItem.findMany({
    where: {
      isManualProduct: true,
      temporaryProductId: null,
      salesOrder: {
        orderType: 'TRANSFER',
      },
    },
    include: {
      salesOrder: {
        select: {
          orderNumber: true,
          orderType: true,
          supplierId: true,
          supplier: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    take: 20,
  });

  console.log(`⚠️  问题订单项数量: ${problematicItems.length}`);
  if (problematicItems.length > 0) {
    console.log('\n问题订单项详情（手动商品但未关联临时商品）:');
    problematicItems.forEach((item, index) => {
      console.log(`\n  ${index + 1}. 订单: ${item.salesOrder.orderNumber}`);
      console.log(
        `     供应商: ${item.salesOrder.supplier?.name || '❌ 未设置'}`
      );
      console.log(`     产品编码: ${item.productCode || '❌ 未填写'}`);
      console.log(`     商品名称: ${item.manualProductName || '❌ 未填写'}`);
      console.log(`     isManualProduct: ${item.isManualProduct}`);
      console.log(
        `     temporaryProductId: ${item.temporaryProductId || '❌ NULL'}`
      );

      // 分析问题原因
      const issues: string[] = [];
      if (!item.salesOrder.supplierId) {
        issues.push('订单未设置供应商');
      }
      if (!item.productCode) {
        issues.push('订单项未填写产品编码');
      }
      if (!item.manualProductName) {
        issues.push('订单项未填写商品名称');
      }

      if (issues.length > 0) {
        console.log(`     ❌ 问题原因: ${issues.join(', ')}`);
      } else {
        console.log(`     ⚠️  数据完整但未创建临时商品（可能是逻辑问题）`);
      }
    });
  } else {
    console.log('✅ 没有发现问题订单项！');
  }

  // 5. 统计分析
  console.log('\n📊 步骤 5: 统计分析');
  const stats = {
    totalTransferOrders: await prisma.salesOrder.count({
      where: { orderType: 'TRANSFER' },
    }),
    totalManualItems: await prisma.salesOrderItem.count({
      where: {
        isManualProduct: true,
        salesOrder: { orderType: 'TRANSFER' },
      },
    }),
    manualItemsWithTempProduct: await prisma.salesOrderItem.count({
      where: {
        isManualProduct: true,
        temporaryProductId: { not: null },
        salesOrder: { orderType: 'TRANSFER' },
      },
    }),
    manualItemsWithoutTempProduct: await prisma.salesOrderItem.count({
      where: {
        isManualProduct: true,
        temporaryProductId: null,
        salesOrder: { orderType: 'TRANSFER' },
      },
    }),
    totalTemporaryProducts: await prisma.temporaryProduct.count(),
  };

  console.log('统计数据:');
  console.log(`  调货销售订单总数: ${stats.totalTransferOrders}`);
  console.log(`  手动商品订单项总数: ${stats.totalManualItems}`);
  console.log(`  已关联临时商品的订单项: ${stats.manualItemsWithTempProduct}`);
  console.log(
    `  未关联临时商品的订单项: ${stats.manualItemsWithoutTempProduct}`
  );
  console.log(`  临时商品表记录数: ${stats.totalTemporaryProducts}`);

  if (stats.manualItemsWithoutTempProduct > 0) {
    const successRate = (
      (stats.manualItemsWithTempProduct / stats.totalManualItems) *
      100
    ).toFixed(2);
    console.log(`\n  ⚠️  临时商品创建成功率: ${successRate}%`);
  } else {
    console.log('\n  ✅ 所有手动商品都已正确关联临时商品！');
  }

  console.log('\n✅ 诊断完成！');
}

main()
  .catch(error => {
    console.error('❌ 诊断过程中发生错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
