/**
 * 设置完整的测试数据
 * 包括用户、客户和厂家发货订单
 */

import 'dotenv/config';
import { hash } from 'bcryptjs';

import { prisma } from '../lib/db';

async function main() {
  console.log('\n🔧 开始设置测试数据\n');
  console.log('='.repeat(60));

  // 步骤 1: 检查现有数据
  console.log('\n📍 步骤 1: 检查现有数据');

  const userCount = await prisma.user.count();
  const customerCount = await prisma.customer.count();
  const orderCount = await prisma.factoryShipmentOrder.count({
    where: {
      OR: [
        { containerNumber: { not: null } },
        { shippingCompany: { not: null } },
      ],
    },
  });

  console.log(`   - 用户数量: ${userCount}`);
  console.log(`   - 客户数量: ${customerCount}`);
  console.log(`   - 包含运输信息的订单: ${orderCount}`);

  // 步骤 2: 创建测试用户（如果不存在）
  console.log('\n📍 步骤 2: 创建测试用户');

  let testUser = await prisma.user.findFirst({
    where: { email: 'test@example.com' },
  });

  if (!testUser) {
    const passwordHash = await hash('test123456', 10);
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        name: '测试用户',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    console.log(`   ✅ 创建测试用户: ${testUser.name} (${testUser.email})`);
  } else {
    console.log(`   ℹ️  测试用户已存在: ${testUser.name} (${testUser.email})`);
  }

  // 步骤 3: 创建测试客户（如果不存在）
  console.log('\n📍 步骤 3: 创建测试客户');

  let testCustomer = await prisma.customer.findFirst({
    where: { name: '测试客户公司' },
  });

  if (!testCustomer) {
    testCustomer = await prisma.customer.create({
      data: {
        name: '测试客户公司',
        role: 'customer',
        phone: '13800138000',
        address: '测试地址 123 号',
      },
    });
    console.log(`   ✅ 创建测试客户: ${testCustomer.name}`);
  } else {
    console.log(`   ℹ️  测试客户已存在: ${testCustomer.name}`);
  }

  // 步骤 4: 创建测试订单
  console.log('\n📍 步骤 4: 创建测试厂家发货订单');

  const testOrders = [
    {
      orderNumber: `FS-TEST-${Date.now()}-1`,
      customerId: testCustomer.id,
      userId: testUser.id,
      status: 'shipped',
      containerNumber: 'TCLU1234567',
      shippingCompany: 'HE YUAN SHUN 98',
      totalAmount: 10000,
      paidAmount: 0,
      remarks: '测试订单 1 - 用于运输查询系统端到端测试',
    },
    {
      orderNumber: `FS-TEST-${Date.now()}-2`,
      customerId: testCustomer.id,
      userId: testUser.id,
      status: 'shipped',
      containerNumber: 'MSCU9876543',
      shippingCompany: 'HE YUAN SHUN 98',
      totalAmount: 15000,
      paidAmount: 0,
      remarks: '测试订单 2 - 用于运输查询系统端到端测试',
    },
    {
      orderNumber: `FS-TEST-${Date.now()}-3`,
      customerId: testCustomer.id,
      userId: testUser.id,
      status: 'shipped',
      containerNumber: 'HLCU5555555',
      shippingCompany: 'HE YUAN SHUN 98',
      totalAmount: 20000,
      paidAmount: 0,
      remarks: '测试订单 3 - 用于运输查询系统端到端测试',
    },
  ];

  const createdOrders = [];

  for (const orderData of testOrders) {
    try {
      const order = await prisma.factoryShipmentOrder.create({
        data: orderData,
      });

      createdOrders.push(order);

      console.log(`   ✅ 创建订单: ${order.orderNumber}`);
      console.log(`      - ID: ${order.id}`);
      console.log(`      - 柜号: ${order.containerNumber}`);
      console.log(`      - 船公司: ${order.shippingCompany}`);
      console.log(`      - 状态: ${order.status}`);
    } catch (error) {
      console.error(`   ❌ 创建订单失败:`, error);
    }
  }

  // 步骤 5: 总结
  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 测试数据设置完成\n');

  console.log('✅ 创建的资源:');
  console.log(`   - 测试用户: ${testUser.name} (${testUser.email})`);
  console.log(`   - 测试客户: ${testCustomer.name}`);
  console.log(`   - 测试订单: ${createdOrders.length} 个`);

  console.log('\n📦 订单详情:');
  createdOrders.forEach((order, index) => {
    console.log(`   ${index + 1}. ${order.orderNumber}`);
    console.log(`      ID: ${order.id}`);
    console.log(`      柜号: ${order.containerNumber}`);
    console.log(`      船公司: ${order.shippingCompany}`);
  });

  console.log('\n💡 下一步:');
  console.log(
    '   1. 运行测试脚本: npx tsx scripts/test-shipping-query-system.ts'
  );
  console.log('   2. 或启动 Worker: npm run scheduler:start');
  console.log(
    '   3. 或测试 API 端点（需要登录）: http://localhost:3001/settings/shipping-query'
  );

  console.log('\n✅ 测试数据设置完成！\n');

  return {
    user: testUser,
    customer: testCustomer,
    orders: createdOrders,
  };
}

main()
  .then(result => {
    console.log(`\n🎉 成功创建 ${result.orders.length} 个测试订单！`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 设置测试数据失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
