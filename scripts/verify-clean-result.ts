/**
 * 验证数据清理结果
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 验证数据清理结果...\n');

  try {
    // 检查业务数据（应该为 0）
    console.log('📊 业务数据统计（应该全部为 0）:');
    console.log('='.repeat(60));

    const businessData = {
      inventory: await prisma.inventory.count(),
      inboundRecords: await prisma.inboundRecord.count(),
      outboundRecords: await prisma.outboundRecord.count(),
      inventoryAdjustments: await prisma.inventoryAdjustment.count(),
      batchSpecifications: await prisma.batchSpecification.count(),
      salesOrders: await prisma.salesOrder.count(),
      salesOrderItems: await prisma.salesOrderItem.count(),
      purchaseOrders: await prisma.purchaseOrder.count(),
      returnOrders: await prisma.returnOrder.count(),
      factoryShipmentOrders: await prisma.factoryShipmentOrder.count(),
      paymentRecords: await prisma.paymentRecord.count(),
      paymentOutRecords: await prisma.paymentOutRecord.count(),
      payableRecords: await prisma.payableRecord.count(),
      refundRecords: await prisma.refundRecord.count(),
      expenseRecords: await prisma.expenseRecord.count(),
      accountStatements: await prisma.accountStatement.count(),
      statementTransactions: await prisma.statementTransaction.count(),
    };

    let hasBusinessData = false;
    for (const [key, value] of Object.entries(businessData)) {
      const status = value === 0 ? '✅' : '❌';
      console.log(`   ${status} ${key}: ${value}`);
      if (value > 0) hasBusinessData = true;
    }

    console.log('='.repeat(60));

    if (hasBusinessData) {
      console.log('\n⚠️  警告: 仍有业务数据未清理！');
    } else {
      console.log('\n✅ 所有业务数据已清理完成！');
    }

    // 检查基础数据（应该保留）
    console.log('\n📚 基础数据统计（应该保留）:');
    console.log('='.repeat(60));

    const baseData = {
      users: await prisma.user.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      products: await prisma.product.count(),
      productVariants: await prisma.productVariant.count(),
      categories: await prisma.category.count(),
    };

    for (const [key, value] of Object.entries(baseData)) {
      console.log(`   ${key}: ${value}`);
    }

    console.log('='.repeat(60));

    // 显示保留的用户
    console.log('\n👥 保留的用户:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (users.length === 0) {
      console.log('   ⚠️  警告: 没有用户！');
    } else {
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (@${user.username})`);
        console.log(`      角色: ${user.role}, 状态: ${user.status}`);
        console.log(`      邮箱: ${user.email}`);
      });
    }

    // 显示保留的客户
    console.log('\n👤 保留的客户:');
    const customers = await prisma.customer.findMany({
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
      },
    });

    if (customers.length === 0) {
      console.log('   ⚠️  没有客户数据');
    } else {
      customers.forEach((customer, index) => {
        console.log(`   ${index + 1}. ${customer.name}`);
        console.log(`      电话: ${customer.phone || '—'}`);
        console.log(`      地址: ${customer.address || '—'}`);
      });
    }

    // 显示保留的供应商
    console.log('\n🏭 保留的供应商:');
    const suppliers = await prisma.supplier.findMany({
      take: 10,
      select: {
        id: true,
        name: true,
        supplierCode: true,
        phone: true,
        address: true,
      },
    });

    if (suppliers.length === 0) {
      console.log('   ⚠️  没有供应商数据');
    } else {
      suppliers.forEach((supplier, index) => {
        console.log(
          `   ${index + 1}. ${supplier.name} (${supplier.supplierCode || '—'})`
        );
        console.log(`      电话: ${supplier.phone || '—'}`);
        console.log(`      地址: ${supplier.address || '—'}`);
      });
    }

    // 显示保留的产品
    console.log('\n📦 保留的产品:');
    const products = await prisma.product.findMany({
      take: 10,
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        specification: true,
        status: true,
      },
    });

    if (products.length === 0) {
      console.log('   ⚠️  没有产品数据');
    } else {
      products.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} (${product.code})`);
        console.log(`      规格: ${product.specification || '—'}`);
        console.log(`      单位: ${product.unit}, 状态: ${product.status}`);
      });
    }

    console.log('\n✨ 验证完成！');
    console.log('\n💡 下一步操作:');
    console.log('   1. 生成测试数据: npm run db:seed');
    console.log('   2. 启动开发服务器: npm run dev');
    console.log('   3. 清除 Redis 缓存（可选）: 重启开发服务器会自动清除');
  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    throw error;
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
