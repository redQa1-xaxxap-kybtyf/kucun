/**
 * 客户直发采购订单自动创建功能测试脚本
 *
 * 测试场景：
 * 1. 创建客户直发销售订单
 * 2. 验证采购订单是否自动创建
 * 3. 验证 salesOrderId 字段是否正确关联
 * 4. 验证数据验证规则
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('🧪 开始测试客户直发采购订单自动创建功能\n');

  try {
    // 准备测试数据
    console.log('📋 准备测试数据...');
    const testData = await prepareTestData();
    console.log('✅ 测试数据准备完成\n');

    // 测试1: 验证数据库结构
    await testDatabaseSchema();

    // 测试2: 创建客户直发销售订单
    await testCreateCustomerDirectShipment(testData);

    // 测试3: 验证采购订单自动创建
    await testPurchaseOrderCreation(testData);

    // 测试4: 验证数据关联
    await testDataRelationship(testData);

    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await cleanupTestData(testData);
    console.log('✅ 测试数据清理完成\n');
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    results.push({
      name: '测试执行',
      passed: false,
      message: '测试过程中发生错误',
      details: error,
    });
  } finally {
    await prisma.$disconnect();
  }

  // 输出测试结果
  printTestResults();
}

async function prepareTestData() {
  // 使用现有的客户（如果没有则创建）
  let customer = await prisma.customer.findFirst({
    where: { name: { contains: '测试' } },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: `测试客户-客户直发-${Date.now()}`,
        phone: '13800138000',
        address: '测试地址',
      },
    });
  }

  // 使用现有的供应商（如果没有则创建）
  let supplier = await prisma.supplier.findFirst({
    where: { name: { contains: '测试' } },
  });

  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: `测试供应商-客户直发-${Date.now()}`,
        phone: '13900139000',
        address: '测试地址',
      },
    });
  }

  // 使用现有的产品（如果没有则创建）
  let product = await prisma.product.findFirst({
    where: { code: { contains: 'TEST' } },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        code: `TEST-PROD-${Date.now()}`,
        name: '测试产品-客户直发',
        specification: '测试规格',
        unit: 'sheet',
      },
    });
  }

  // 获取或创建测试用户
  let user = await prisma.user.findFirst({
    where: { username: 'admin' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@test.com',
        passwordHash: 'hashed_password', // 实际应该使用哈希密码
        name: '管理员',
        role: 'admin',
      },
    });
  }

  return {
    customer,
    supplier,
    product,
    user,
    createdUser: !user, // 标记是否创建了新用户
  };
}

async function testDatabaseSchema() {
  console.log('🔍 测试1: 验证数据库结构');

  try {
    // 使用原始查询检查字段是否存在
    const result = await prisma.$queryRaw<Array<{ Field: string }>>`
      DESCRIBE purchase_orders
    `;

    const hasSalesOrderId = result.some(row => row.Field === 'sales_order_id');

    if (hasSalesOrderId) {
      results.push({
        name: '数据库结构验证',
        passed: true,
        message: 'purchase_orders 表包含 sales_order_id 字段',
      });
      console.log('  ✅ purchase_orders 表包含 sales_order_id 字段');
    } else {
      results.push({
        name: '数据库结构验证',
        passed: false,
        message: 'purchase_orders 表缺少 sales_order_id 字段',
      });
      console.log('  ❌ purchase_orders 表缺少 sales_order_id 字段');
    }
  } catch (error) {
    results.push({
      name: '数据库结构验证',
      passed: false,
      message: '数据库结构验证失败',
      details: error,
    });
    console.log('  ❌ 数据库结构验证失败:', error);
  }

  console.log('');
}

async function testCreateCustomerDirectShipment(
  testData: Awaited<ReturnType<typeof prepareTestData>>
) {
  console.log('🔍 测试2: 创建客户直发销售订单');

  try {
    const orderNumber = `SO-TEST-${Date.now()}`;

    const salesOrder = await prisma.salesOrder.create({
      data: {
        orderNumber,
        customerId: testData.customer.id,
        userId: testData.user.id,
        orderType: 'TRANSFER',
        transferMode: 'SUPPLIER_ONLY',
        supplierId: testData.supplier.id,
        status: 'confirmed',
        totalAmount: 1000,
        costAmount: 800,
        items: {
          create: [
            {
              productId: testData.product.id,
              productCode: testData.product.code,
              specification: testData.product.specification || '',
              displayUnit: testData.product.unit,
              quantity: 10,
              unitPrice: 100,
              unitCost: 80,
              subtotal: 1000,
              costSubtotal: 800,
            },
          ],
        },
      },
    });

    // 保存销售订单ID供后续测试使用
    (testData as { salesOrderId?: string }).salesOrderId = salesOrder.id;

    results.push({
      name: '创建客户直发销售订单',
      passed: true,
      message: `成功创建销售订单: ${orderNumber}`,
      details: { salesOrderId: salesOrder.id },
    });
    console.log(`  ✅ 成功创建销售订单: ${orderNumber}`);
    console.log(`     订单ID: ${salesOrder.id}`);
  } catch (error) {
    results.push({
      name: '创建客户直发销售订单',
      passed: false,
      message: '创建销售订单失败',
      details: error,
    });
    console.log('  ❌ 创建销售订单失败:', error);
  }

  console.log('');
}

async function testPurchaseOrderCreation(
  testData: Awaited<ReturnType<typeof prepareTestData>> & {
    salesOrderId?: string;
  }
) {
  console.log('🔍 测试3: 验证采购订单自动创建');

  try {
    if (!testData.salesOrderId) {
      throw new Error('销售订单ID不存在');
    }

    // 等待一小段时间，确保采购订单创建完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 查询采购订单（只需要找到一条即可）
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        salesOrderId: testData.salesOrderId,
      },
      select: {
        id: true,
        orderNumber: true,
        salesOrderId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (purchaseOrder) {
      results.push({
        name: '采购订单自动创建',
        passed: true,
        message: `成功自动创建采购订单: ${purchaseOrder.orderNumber}`,
        details: {
          purchaseOrderId: purchaseOrder.id,
          purchaseOrderNumber: purchaseOrder.orderNumber,
          salesOrderId: purchaseOrder.salesOrderId,
        },
      });
      console.log(`  ✅ 成功自动创建采购订单: ${purchaseOrder.orderNumber}`);
      console.log(`     采购订单ID: ${purchaseOrder.id}`);
      console.log(`     关联销售订单ID: ${purchaseOrder.salesOrderId}`);

      // 保存采购订单ID供后续测试使用
      (testData as { purchaseOrderId?: string }).purchaseOrderId =
        purchaseOrder.id;
    } else {
      results.push({
        name: '采购订单自动创建',
        passed: false,
        message: '未找到自动创建的采购订单',
      });
      console.log('  ❌ 未找到自动创建的采购订单');
    }
  } catch (error) {
    results.push({
      name: '采购订单自动创建',
      passed: false,
      message: '验证采购订单创建失败',
      details: error,
    });
    console.log('  ❌ 验证采购订单创建失败:', error);
  }

  console.log('');
}

async function testDataRelationship(
  testData: Awaited<ReturnType<typeof prepareTestData>> & {
    salesOrderId?: string;
    purchaseOrderId?: string;
  }
) {
  console.log('🔍 测试4: 验证数据关联');

  try {
    if (!testData.purchaseOrderId || !testData.salesOrderId) {
      throw new Error('采购订单ID或销售订单ID不存在');
    }

    // 通过采购订单查询关联的销售订单
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: testData.purchaseOrderId },
      include: {
        salesOrder: true,
      },
    });

    if (purchaseOrder?.salesOrder) {
      results.push({
        name: '数据关联验证',
        passed: true,
        message: '采购订单成功关联到销售订单',
        details: {
          purchaseOrderNumber: purchaseOrder.orderNumber,
          salesOrderNumber: purchaseOrder.salesOrder.orderNumber,
        },
      });
      console.log('  ✅ 采购订单成功关联到销售订单');
      console.log(`     采购订单: ${purchaseOrder.orderNumber}`);
      console.log(`     销售订单: ${purchaseOrder.salesOrder.orderNumber}`);
    } else {
      results.push({
        name: '数据关联验证',
        passed: false,
        message: '采购订单未关联到销售订单',
      });
      console.log('  ❌ 采购订单未关联到销售订单');
    }
  } catch (error) {
    results.push({
      name: '数据关联验证',
      passed: false,
      message: '验证数据关联失败',
      details: error,
    });
    console.log('  ❌ 验证数据关联失败:', error);
  }

  console.log('');
}

async function cleanupTestData(
  testData: Awaited<ReturnType<typeof prepareTestData>> & {
    salesOrderId?: string;
    purchaseOrderId?: string;
  }
) {
  try {
    // 删除采购订单（如果存在）
    if (testData.purchaseOrderId) {
      await prisma.purchaseOrder.delete({
        where: { id: testData.purchaseOrderId },
      });
    }

    // 删除销售订单（如果存在）
    if (testData.salesOrderId) {
      await prisma.salesOrder.delete({
        where: { id: testData.salesOrderId },
      });
    }

    // 删除测试数据
    await prisma.product.delete({ where: { id: testData.product.id } });
    await prisma.supplier.delete({ where: { id: testData.supplier.id } });
    await prisma.customer.delete({ where: { id: testData.customer.id } });
  } catch (error) {
    console.error('清理测试数据失败:', error);
  }
}

function printTestResults() {
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   详情:`, result.details);
    }
    console.log('');
  });

  console.log('='.repeat(60));
  console.log(`总计: ${total} 个测试`);
  console.log(`通过: ${passed} 个 ✅`);
  console.log(`失败: ${failed} 个 ❌`);
  console.log(`成功率: ${((passed / total) * 100).toFixed(2)}%`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查详情。');
  }
}

// 运行测试
runTests().catch(console.error);
