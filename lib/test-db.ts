import { getDatabaseStats, prisma, testDatabaseConnection } from './db';

const PREVIEW_TAKE = 50;

async function testDatabase() {
  console.log('🧪 开始数据库测试...');

  try {
    // 1. 测试数据库连接
    console.log('\n1. 测试数据库连接...');
    const connected = await testDatabaseConnection();
    if (!connected) {
      throw new Error('数据库连接失败');
    }

    // 2. 获取数据库统计信息
    console.log('\n2. 获取数据库统计信息...');
    const stats = await getDatabaseStats();
    if (stats) {
      console.log('📊 数据库统计:');
      console.log(`   用户数量: ${stats.users}`);
      console.log(`   客户数量: ${stats.customers}`);
      console.log(`   产品数量: ${stats.products}`);
      console.log(`   销售单数量: ${stats.salesOrders}`);
      console.log(`   库存记录数量: ${stats.inventory}`);
    }

    // 3. 测试用户查询
    console.log('\n3. 测试用户查询...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
      take: PREVIEW_TAKE,
    });
    console.log(`✅ 查询到 ${users.length} 个用户:`);
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
    });

    // 4. 测试产品查询
    console.log('\n4. 测试产品查询...');
    const products = await prisma.product.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        unit: true,
        piecesPerUnit: true,
        status: true,
      },
      take: PREVIEW_TAKE,
    });
    console.log(`✅ 查询到 ${products.length} 个产品:`);
    products.forEach(product => {
      console.log(
        `   - ${product.code}: ${product.name} (${product.specification})`
      );
    });

    // 5. 测试客户查询
    console.log('\n5. 测试客户查询...');
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
      },
      take: PREVIEW_TAKE,
    });
    console.log(`✅ 查询到 ${customers.length} 个客户:`);
    customers.forEach(customer => {
      console.log(`   - ${customer.name} (${customer.phone})`);
    });

    // 6. 测试库存查询
    console.log('\n6. 测试库存查询...');
    const inventory = await prisma.inventory.findMany({
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
        reservedQuantity: true,
        product: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      take: PREVIEW_TAKE,
    });
    console.log(`✅ 查询到 ${inventory.length} 条库存记录:`);
    inventory.forEach(item => {
      console.log(
        `   - ${item.product.code}: ${item.variantId ? '有变体' : '无变体'} - 数量: ${item.quantity}`
      );
    });

    // 7. 测试入库记录查询
    console.log('\n7. 测试入库记录查询...');
    const inboundRecords = await prisma.inboundRecord.findMany({
      select: {
        id: true,
        recordNumber: true,
        productId: true,
        quantity: true,
        product: {
          select: {
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
      take: PREVIEW_TAKE,
    });
    console.log(`✅ 查询到 ${inboundRecords.length} 条入库记录:`);
    inboundRecords.forEach(record => {
      console.log(
        `   - ${record.recordNumber}: ${record.product.code} - 数量: ${record.quantity} (${record.user.name})`
      );
    });

    // 8. 测试复杂查询 - 产品库存汇总
    console.log('\n8. 测试复杂查询 - 产品库存汇总...');
    const productInventory = await prisma.product.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        inventory: {
          select: {
            quantity: true,
            reservedQuantity: true,
          },
        },
      },
      take: PREVIEW_TAKE,
    });
    console.log('📦 产品库存汇总:');
    productInventory.forEach(product => {
      const totalQuantity = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0
      );
      const totalReserved = product.inventory.reduce(
        (sum, inv) => sum + inv.reservedQuantity,
        0
      );
      const availableQuantity = totalQuantity - totalReserved;
      console.log(
        `   - ${product.code}: 总库存 ${totalQuantity}, 可用 ${availableQuantity}, 预留 ${totalReserved}`
      );
    });

    console.log('\n🎉 数据库测试完成！所有功能正常。');
  } catch (error) {
    console.error('\n❌ 数据库测试失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件，执行测试
if (
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  (require as any).main === module
) {
  testDatabase()
    .then(() => {
      console.log('\n✅ 测试成功完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 测试失败:', error);
      process.exit(1);
    });
}

export { testDatabase };
