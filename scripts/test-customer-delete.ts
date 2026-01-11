/**
 * 测试客户删除功能
 * 验证所有关联数据检查是否正常工作
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCustomerDelete() {
  console.log('🧪 测试客户删除功能');
  console.log('='.repeat(80));

  try {
    // 1. 查找所有客户
    const customers = await prisma.customer.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            salesOrders: true,
            outboundRecords: true,
            paymentRecords: true,
            returnOrders: true,
            refundRecords: true,
            factoryShipmentOrders: true,
            childCustomers: true,
            productPrices: true,
          },
        },
      },
    });

    console.log(`\n📊 找到 ${customers.length} 个客户\n`);

    for (const customer of customers) {
      console.log(`\n客户: ${customer.name} (ID: ${customer.id})`);
      console.log(`  - 销售订单: ${customer._count.salesOrders}`);
      console.log(`  - 出库记录: ${customer._count.outboundRecords}`);
      console.log(`  - 付款记录: ${customer._count.paymentRecords}`);
      console.log(`  - 退货订单: ${customer._count.returnOrders}`);
      console.log(`  - 退款记录: ${customer._count.refundRecords}`);
      console.log(`  - 厂家发货订单: ${customer._count.factoryShipmentOrders}`);
      console.log(`  - 子客户: ${customer._count.childCustomers}`);
      console.log(`  - 产品价格记录: ${customer._count.productPrices}`);

      const hasRelations =
        customer._count.salesOrders > 0 ||
        customer._count.outboundRecords > 0 ||
        customer._count.paymentRecords > 0 ||
        customer._count.returnOrders > 0 ||
        customer._count.refundRecords > 0 ||
        customer._count.factoryShipmentOrders > 0 ||
        customer._count.childCustomers > 0 ||
        customer._count.productPrices > 0;

      if (hasRelations) {
        console.log(`  ❌ 无法删除（有关联数据）`);
      } else {
        console.log(`  ✅ 可以安全删除（无关联数据）`);
      }
    }

    // 2. 测试 CustomerProductPrice 关系
    console.log('\n\n📊 测试 CustomerProductPrice 关系');
    console.log('='.repeat(80));

    const priceRecords = await prisma.customerProductPrice.findMany({
      take: 5,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`\n找到 ${priceRecords.length} 条产品价格记录\n`);

    for (const record of priceRecords) {
      console.log(
        `  - 客户: ${record.customer.name}, 产品ID: ${record.productId}, 价格: ${record.unitPrice}`
      );
    }

    // 3. 统计信息
    console.log('\n\n📊 数据库统计');
    console.log('='.repeat(80));

    const stats = {
      totalCustomers: await prisma.customer.count(),
      customersWithOrders: await prisma.customer.count({
        where: {
          salesOrders: {
            some: {},
          },
        },
      }),
      customersWithPrices: await prisma.customer.count({
        where: {
          productPrices: {
            some: {},
          },
        },
      }),
      customersWithChildren: await prisma.customer.count({
        where: {
          childCustomers: {
            some: {},
          },
        },
      }),
    };

    console.log(`\n总客户数: ${stats.totalCustomers}`);
    console.log(`有订单的客户: ${stats.customersWithOrders}`);
    console.log(`有产品价格的客户: ${stats.customersWithPrices}`);
    console.log(`有子客户的客户: ${stats.customersWithChildren}`);

    const deletableCustomers =
      stats.totalCustomers -
      Math.max(
        stats.customersWithOrders,
        stats.customersWithPrices,
        stats.customersWithChildren
      );

    console.log(`\n✅ 可安全删除的客户数（估算）: ${deletableCustomers}`);

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ 测试完成！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testCustomerDelete().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
