/**
 * 库存预警功能测试脚本
 * 用于验证库存预警修复是否正常工作
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInventoryAlerts() {
  console.log('=== 库存预警功能测试 ===\n');

  try {
    // 1. 检查环境变量配置
    console.log('1. 环境变量配置检查:');
    const defaultMinQuantity =
      process.env.INVENTORY_DEFAULT_MIN_QUANTITY || '10';
    const criticalMinQuantity =
      process.env.INVENTORY_CRITICAL_MIN_QUANTITY || '5';
    console.log(`   默认最小库存阈值: ${defaultMinQuantity}`);
    console.log(`   紧急库存阈值: ${criticalMinQuantity}`);
    console.log('');

    // 2. 创建测试产品（如果不存在）
    console.log('2. 创建测试数据:');

    // 测试产品 1: 低库存产品（总库存 = 8，低于默认阈值 10）
    let testProduct1 = await prisma.product.findFirst({
      where: { code: 'TEST-LOW-STOCK-001' },
    });

    if (!testProduct1) {
      testProduct1 = await prisma.product.create({
        data: {
          code: 'TEST-LOW-STOCK-001',
          name: '测试低库存产品',
          specification: '用于测试库存预警功能',
          unit: 'sheet',
          status: 'active',
        },
      });
      console.log(
        `   ✅ 创建测试产品 1: ${testProduct1.name} (${testProduct1.code})`
      );

      // 创建库存记录
      await prisma.inventory.create({
        data: {
          productId: testProduct1.id,
          quantity: 8,
          reservedQuantity: 0,
          location: '测试仓库A',
        },
      });
      console.log(`   ✅ 创建库存记录: 数量 = 8, 预留 = 0, 可用 = 8`);
    } else {
      console.log(
        `   ℹ️  测试产品 1 已存在: ${testProduct1.name} (${testProduct1.code})`
      );
    }

    // 测试产品 2: 紧急低库存产品（总库存 = 3，低于紧急阈值 5）
    let testProduct2 = await prisma.product.findFirst({
      where: { code: 'TEST-CRITICAL-STOCK-001' },
    });

    if (!testProduct2) {
      testProduct2 = await prisma.product.create({
        data: {
          code: 'TEST-CRITICAL-STOCK-001',
          name: '测试紧急低库存产品',
          specification: '用于测试紧急库存预警',
          unit: 'sheet',
          status: 'active',
        },
      });
      console.log(
        `   ✅ 创建测试产品 2: ${testProduct2.name} (${testProduct2.code})`
      );

      await prisma.inventory.create({
        data: {
          productId: testProduct2.id,
          quantity: 3,
          reservedQuantity: 0,
          location: '测试仓库B',
        },
      });
      console.log(`   ✅ 创建库存记录: 数量 = 3, 预留 = 0, 可用 = 3`);
    } else {
      console.log(
        `   ℹ️  测试产品 2 已存在: ${testProduct2.name} (${testProduct2.code})`
      );
    }

    // 测试产品 3: 多批次低库存产品（总库存 = 9，但分散在多个批次）
    let testProduct3 = await prisma.product.findFirst({
      where: { code: 'TEST-MULTI-BATCH-001' },
    });

    if (!testProduct3) {
      testProduct3 = await prisma.product.create({
        data: {
          code: 'TEST-MULTI-BATCH-001',
          name: '测试多批次低库存产品',
          specification: '用于测试多批次库存计算',
          unit: 'sheet',
          status: 'active',
        },
      });
      console.log(
        `   ✅ 创建测试产品 3: ${testProduct3.name} (${testProduct3.code})`
      );

      // 创建多个批次的库存记录
      await prisma.inventory.createMany({
        data: [
          {
            productId: testProduct3.id,
            quantity: 3,
            reservedQuantity: 0,
            batchNumber: 'BATCH-001',
            location: '测试仓库C-1',
          },
          {
            productId: testProduct3.id,
            quantity: 4,
            reservedQuantity: 0,
            batchNumber: 'BATCH-002',
            location: '测试仓库C-2',
          },
          {
            productId: testProduct3.id,
            quantity: 2,
            reservedQuantity: 0,
            batchNumber: 'BATCH-003',
            location: '测试仓库C-3',
          },
        ],
      });
      console.log(`   ✅ 创建 3 个批次库存记录: 总库存 = 3 + 4 + 2 = 9`);
    } else {
      console.log(
        `   ℹ️  测试产品 3 已存在: ${testProduct3.name} (${testProduct3.code})`
      );
    }

    console.log('');

    // 3. 查询低库存产品（使用修复后的逻辑）
    console.log('3. 查询低库存产品（修复后的逻辑）:');
    const threshold = parseInt(defaultMinQuantity, 10);

    const allActiveProducts = await prisma.product.findMany({
      where: {
        status: 'active',
        code: {
          startsWith: 'TEST-',
        },
      },
      include: {
        inventory: {
          select: {
            quantity: true,
            reservedQuantity: true,
            batchNumber: true,
            location: true,
          },
        },
      },
    });

    const lowStockProducts = allActiveProducts
      .map(product => {
        const { totalStock, reservedStock } = product.inventory.reduce(
          (acc, inv) => ({
            totalStock: acc.totalStock + inv.quantity,
            reservedStock: acc.reservedStock + inv.reservedQuantity,
          }),
          { totalStock: 0, reservedStock: 0 }
        );
        const availableStock = totalStock - reservedStock;

        return {
          ...product,
          totalStock,
          reservedStock,
          availableStock,
        };
      })
      .filter(product => product.availableStock <= threshold);

    console.log(`   阈值: ${threshold}`);
    console.log(`   找到 ${lowStockProducts.length} 个低库存产品:\n`);

    lowStockProducts.forEach((product, index) => {
      const severity =
        product.availableStock <= parseInt(criticalMinQuantity, 10)
          ? '🔴 紧急'
          : '🟡 警告';
      console.log(
        `   ${index + 1}. ${severity} ${product.name} (${product.code})`
      );
      console.log(`      总库存: ${product.totalStock}`);
      console.log(`      预留: ${product.reservedStock}`);
      console.log(`      可用: ${product.availableStock}`);
      console.log(`      批次数: ${product.inventory.length}`);
      if (product.inventory.length > 1) {
        product.inventory.forEach(inv => {
          console.log(
            `        - ${inv.batchNumber || '无批次'}: 数量 ${inv.quantity}, 位置 ${inv.location || '未知'}`
          );
        });
      }
      console.log('');
    });

    // 4. 测试 API 端点（如果服务器正在运行）
    console.log('4. 测试 API 端点:');
    try {
      const response = await fetch(
        'http://localhost:3000/api/inventory/alerts'
      );
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ API 调用成功`);
        console.log(`   返回预警数量: ${result.data?.length || 0}`);
        console.log(`   Critical: ${result.summary?.critical || 0}`);
        console.log(`   Warning: ${result.summary?.warning || 0}`);
      } else {
        console.log(
          `   ⚠️  API 调用失败: ${response.status} ${response.statusText}`
        );
      }
    } catch (_error) {
      console.log(`   ℹ️  无法连接到开发服务器（可能未启动）`);
      console.log(`   提示: 运行 'npm run dev' 启动服务器后再测试 API`);
    }

    console.log('');
    console.log('=== 测试完成 ===');
    console.log('');
    console.log('📝 验证步骤:');
    console.log('1. 启动开发服务器: npm run dev');
    console.log('2. 访问仪表盘: http://localhost:3000/dashboard');
    console.log('3. 检查"库存预警"卡片是否显示测试产品');
    console.log('4. 访问库存预警页面: http://localhost:3000/inventory/alerts');
    console.log('5. 验证预警级别是否正确（紧急/警告）');
    console.log('');
    console.log('🧹 清理测试数据:');
    console.log('运行以下命令删除测试产品:');
    console.log(`DELETE FROM products WHERE code LIKE 'TEST-%';`);
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInventoryAlerts();
