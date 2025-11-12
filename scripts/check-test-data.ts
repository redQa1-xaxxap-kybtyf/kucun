import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestData() {
  try {
    console.log('🔍 检查测试基础数据...\n');

    // 检查供应商
    const suppliers = await prisma.supplier.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        supplierCode: true,
      },
    });
    console.log(`✅ 供应商数量: ${suppliers.length}`);
    if (suppliers.length > 0) {
      console.log('   示例供应商:');
      suppliers.forEach(s =>
        console.log(`   - ${s.name} (${s.supplierCode || 'N/A'})`)
      );
    }
    console.log();

    // 检查产品
    const products = await prisma.product.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        code: true,
        specification: true,
      },
    });
    console.log(`✅ 产品数量: ${products.length}`);
    if (products.length > 0) {
      console.log('   示例产品:');
      products.forEach(p =>
        console.log(`   - ${p.name} (${p.code}) - ${p.specification || 'N/A'}`)
      );
    }
    console.log();

    // 检查客户
    const customers = await prisma.customer.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });
    console.log(`✅ 客户数量: ${customers.length}`);
    if (customers.length > 0) {
      console.log('   示例客户:');
      customers.forEach(c =>
        console.log(`   - ${c.name} (${c.phone || 'N/A'})`)
      );
    }
    console.log();

    // 检查现有厂家发货订单
    const orders = await prisma.factoryShipmentOrder.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        customerProfit: true,
        expenseAmount: true,
        createdAt: true,
      },
    });
    console.log(`✅ 现有厂家发货订单数量: ${orders.length}`);
    if (orders.length > 0) {
      console.log('   最近的订单:');
      orders.forEach(o =>
        console.log(
          `   - ${o.orderNumber} (${o.status}) - 总额: ¥${o.totalAmount.toFixed(2)}, 利润: ¥${(o.customerProfit || 0).toFixed(2)}`
        )
      );
    }
    console.log();

    // 总结
    console.log('📊 测试数据总结:');
    console.log(`   供应商: ${suppliers.length > 0 ? '✅ 可用' : '❌ 缺少'}`);
    console.log(`   产品: ${products.length > 0 ? '✅ 可用' : '❌ 缺少'}`);
    console.log(`   客户: ${customers.length > 0 ? '✅ 可用' : '❌ 缺少'}`);
    console.log();

    if (
      suppliers.length === 0 ||
      products.length === 0 ||
      customers.length === 0
    ) {
      console.log('⚠️  警告: 缺少测试基础数据，需要先创建测试数据');
      console.log(
        '   建议: 使用 Prisma Studio (http://localhost:5555) 手动创建'
      );
    } else {
      console.log('✅ 测试环境准备就绪，可以开始测试！');
    }
  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestData();
