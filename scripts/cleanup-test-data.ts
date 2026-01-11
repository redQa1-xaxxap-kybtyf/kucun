/**
 * 清理测试数据
 * 删除之前创建的测试订单和相关数据
 */

import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  console.log('\n🧹 开始清理测试数据\n');
  console.log('='.repeat(60));

  // 步骤 1: 删除测试订单的查询记录
  console.log('\n📍 步骤 1: 删除测试订单的查询记录');

  const testOrderWhere = {
    orderNumber: {
      startsWith: 'FS-TEST-',
    },
  } as const;

  const testOrderCount = await prisma.factoryShipmentOrder.count({
    where: testOrderWhere,
  });

  console.log(`找到 ${testOrderCount} 个测试订单`);

  if (testOrderCount > 0) {
    const deletedQueries = await prisma.shippingQuery.deleteMany({
      where: {
        factoryShipmentOrder: {
          is: testOrderWhere,
        },
      },
    });

    console.log(`✅ 删除了 ${deletedQueries.count} 条查询记录`);
  }

  // 步骤 2: 删除测试订单明细
  console.log('\n📍 步骤 2: 删除测试订单明细');

  if (testOrderCount > 0) {
    const deletedItems = await prisma.factoryShipmentOrderItem.deleteMany({
      where: {
        factoryShipmentOrder: testOrderWhere,
      },
    });

    console.log(`✅ 删除了 ${deletedItems.count} 条订单明细`);
  }

  // 步骤 3: 删除测试订单
  console.log('\n📍 步骤 3: 删除测试订单');

  const deletedOrders = await prisma.factoryShipmentOrder.deleteMany({
    where: testOrderWhere,
  });

  console.log(`✅ 删除了 ${deletedOrders.count} 个测试订单`);

  // 步骤 4: 删除测试客户
  console.log('\n📍 步骤 4: 删除测试客户');

  const deletedCustomers = await prisma.customer.deleteMany({
    where: {
      name: '测试客户公司',
    },
  });

  console.log(`✅ 删除了 ${deletedCustomers.count} 个测试客户`);

  // 步骤 5: 删除测试用户
  console.log('\n📍 步骤 5: 删除测试用户');

  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: 'test@example.com',
    },
  });

  console.log(`✅ 删除了 ${deletedUsers.count} 个测试用户`);

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 测试数据清理完成！\n');
}

main()
  .catch(error => {
    console.error('\n❌ 清理失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
