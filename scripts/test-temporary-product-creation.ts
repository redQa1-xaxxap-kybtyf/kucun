/**
 * 测试临时产品创建功能
 *
 * 用途：模拟创建调货销售订单,测试临时产品是否正确保存
 *
 * 运行方式：
 * npx tsx scripts/test-temporary-product-creation.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('🧪 开始测试临时产品创建功能...\n');

  // 1. 获取测试数据
  console.log('📊 步骤 1: 获取测试数据');

  const customer = await prisma.customer.findFirst();

  if (!customer) {
    console.error('❌ 没有找到客户,无法测试');
    return;
  }
  console.log(`✅ 找到客户: ${customer.name} (${customer.id})`);

  const supplier = await prisma.supplier.findFirst();

  if (!supplier) {
    console.error('❌ 没有找到供应商,无法测试');
    return;
  }
  console.log(`✅ 找到供应商: ${supplier.name} (${supplier.id})`);

  const user = await prisma.user.findFirst();

  if (!user) {
    console.error('❌ 没有找到用户,无法测试');
    return;
  }
  console.log(`✅ 找到用户: ${user.name} (${user.id})`);

  // 2. 准备测试数据
  console.log('\n📊 步骤 2: 准备测试订单数据');

  const testOrderData = {
    customerId: customer.id,
    supplierId: supplier.id,
    userId: user.id,
    orderType: 'TRANSFER' as const,
    transferMode: 'SUPPLIER_ONLY' as const,
    status: 'draft' as const,
    items: [
      {
        isManualProduct: true,
        productCode: `TEST-${Date.now()}`,
        manualProductName: '测试临时产品',
        manualSpecification: '300*600',
        manualWeight: 15.5,
        manualUnit: '片',
        piecesPerUnit: 10,
        quantity: 100,
        unitPrice: 25.5,
        unitCost: 20.0,
        transferQuantity: 100,
      },
    ],
  };

  console.log('测试订单数据:', JSON.stringify(testOrderData, null, 2));

  // 3. 调用创建订单 API
  console.log('\n📊 步骤 3: 调用创建订单逻辑');

  try {
    // 导入创建订单函数
    const { createSalesOrder } = await import(
      '@/lib/api/handlers/sales-orders/create'
    );

    console.log('开始创建订单...');
    const result = await createSalesOrder(testOrderData, user.id);

    console.log('\n✅ 订单创建成功!');
    console.log('订单号:', result.orderNumber);
    console.log('订单ID:', result.id);
    console.log('订单项数量:', result.items?.length || 0);

    // 4. 验证临时产品是否创建
    console.log('\n📊 步骤 4: 验证临时产品是否创建');

    const orderItems = await prisma.salesOrderItem.findMany({
      where: {
        salesOrderId: result.id,
      },
      select: {
        id: true,
        isManualProduct: true,
        productCode: true,
        manualProductName: true,
        temporaryProductId: true,
        temporaryProduct: {
          select: {
            id: true,
            code: true,
            name: true,
            usageCount: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: 1000,
    });

    console.log(`订单项数量: ${orderItems.length}`);

    orderItems.forEach((item, index) => {
      console.log(`\n订单项 ${index + 1}:`);
      console.log(`  isManualProduct: ${item.isManualProduct}`);
      console.log(`  productCode: ${item.productCode}`);
      console.log(`  manualProductName: ${item.manualProductName}`);
      console.log(
        `  temporaryProductId: ${item.temporaryProductId || '❌ NULL'}`
      );

      if (item.temporaryProduct) {
        console.log(`  ✅ 临时产品已创建:`);
        console.log(`     ID: ${item.temporaryProduct.id}`);
        console.log(`     编码: ${item.temporaryProduct.code}`);
        console.log(`     名称: ${item.temporaryProduct.name}`);
        console.log(`     使用次数: ${item.temporaryProduct.usageCount}`);
      } else if (item.isManualProduct) {
        console.log(`  ❌ 临时产品未创建（这是问题！）`);
      }
    });

    // 5. 检查临时产品表
    console.log('\n📊 步骤 5: 检查临时产品表');

    const tempProducts = await prisma.temporaryProduct.findMany({
      where: {
        supplierId: supplier.id,
      },
      select: {
        code: true,
        name: true,
        usageCount: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    console.log(
      `供应商 ${supplier.name} 的临时产品数量: ${tempProducts.length}`
    );
    tempProducts.forEach((tp, index) => {
      console.log(
        `  ${index + 1}. [${tp.code}] ${tp.name} (使用次数: ${tp.usageCount})`
      );
    });

    // 6. 清理测试数据
    console.log('\n📊 步骤 6: 清理测试数据');
    console.log('是否删除测试订单? (手动删除)');
    console.log(`订单ID: ${result.id}`);
    console.log(`订单号: ${result.orderNumber}`);
  } catch (error) {
    console.error('\n❌ 创建订单失败:', error);
    if (error instanceof Error) {
      console.error('错误信息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }

  console.log('\n✅ 测试完成！');
}

main()
  .catch(error => {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
