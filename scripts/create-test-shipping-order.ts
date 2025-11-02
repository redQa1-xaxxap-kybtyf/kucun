/**
 * 创建测试用的厂家发货订单
 * 用于测试运输查询系统
 */

import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  console.log('\n📦 创建测试用的厂家发货订单\n');

  // 获取第一个客户和用户
  const customer = await prisma.customer.findFirst();

  const user = await prisma.user.findFirst();

  if (!customer || !user) {
    console.error('❌ 需要至少一个客户和一个用户');
    process.exit(1);
  }

  console.log(`✅ 使用客户: ${customer.name}`);
  console.log(`✅ 使用用户: ${user.name}\n`);

  // 创建测试订单
  const testOrders = [
    {
      orderNumber: `FS-TEST-${Date.now()}-1`,
      customerId: customer.id,
      userId: user.id,
      status: 'shipped',
      containerNumber: 'TCLU1234567',
      shippingCompany: 'HE YUAN SHUN 98',
      totalAmount: 10000,
      paidAmount: 0,
      remarks: '测试订单 - 用于运输查询系统测试',
    },
    {
      orderNumber: `FS-TEST-${Date.now()}-2`,
      customerId: customer.id,
      userId: user.id,
      status: 'shipped',
      containerNumber: 'MSCU9876543',
      shippingCompany: 'HE YUAN SHUN 98',
      totalAmount: 15000,
      paidAmount: 0,
      remarks: '测试订单 - 用于运输查询系统测试',
    },
    {
      orderNumber: `FS-TEST-${Date.now()}-3`,
      customerId: customer.id,
      userId: user.id,
      status: 'shipped',
      containerNumber: 'HLCU5555555',
      shippingCompany: 'HE YUAN SHUN 98',
      totalAmount: 20000,
      paidAmount: 0,
      remarks: '测试订单 - 用于运输查询系统测试',
    },
  ];

  console.log('创建测试订单...\n');

  for (const orderData of testOrders) {
    try {
      const order = await prisma.factoryShipmentOrder.create({
        data: orderData,
      });

      console.log(`✅ 创建订单: ${order.orderNumber}`);
      console.log(`   - ID: ${order.id}`);
      console.log(`   - 柜号: ${order.containerNumber}`);
      console.log(`   - 船公司: ${order.shippingCompany}`);
      console.log(`   - 状态: ${order.status}\n`);
    } catch (error) {
      console.error(`❌ 创建订单失败:`, error);
    }
  }

  console.log('✅ 测试订单创建完成！\n');
  console.log('💡 下一步:');
  console.log(
    '   1. 运行测试脚本: npx tsx scripts/test-shipping-query-system.ts'
  );
  console.log('   2. 或启动 Worker: npm run scheduler:start');
  console.log('   3. 或测试 API 端点（需要登录）\n');
}

main()
  .catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
