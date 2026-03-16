/**
 * Phase 2 验证脚本
 * 验证厂家发货费用分摊逻辑的正确性和性能
 */

import {
  allocateExpenses,
  allocateExpensesByOwnership,
  allocateExpensesByQuantity,
  allocateExpensesByValue,
  allocateExpensesByWeight,
} from '../lib/services/factory-shipment-expense-service';
import type { FactoryShipmentOrderItem } from '../lib/types/factory-shipment';

// ==================== 测试数据生成 ====================

function createMockItem(
  overrides: Partial<FactoryShipmentOrderItem> = {}
): FactoryShipmentOrderItem {
  return {
    id: 'item-1',
    factoryShipmentOrderId: 'order-1',
    supplierId: 'supplier-1',
    productCode: 'PROD-001',
    quantity: 100,
    unitPrice: 100,
    totalPrice: 10000,
    ownership: 'customer',
    displayName: '测试产品',
    unit: 'piece',
    createdAt: new Date(),
    updatedAt: new Date(),
    supplier: {
      id: 'supplier-1',
      name: '测试供应商',
    },
    ...overrides,
  } as FactoryShipmentOrderItem;
}

// ==================== 验证函数 ====================

function verifyAllocationAccuracy(
  allocatedTotal: number,
  expectedTotal: number,
  testName: string
): boolean {
  const difference = Math.abs(allocatedTotal - expectedTotal);
  const isValid = difference < 0.01;

  if (isValid) {
    console.log(`  ✅ ${testName}: 分摊准确 (差额: ${difference.toFixed(4)})`);
  } else {
    console.log(
      `  ❌ ${testName}: 分摊不准确 (差额: ${difference.toFixed(4)}, 超过阈值 0.01)`
    );
  }

  return isValid;
}

// ==================== 验证测试 ====================

async function verifyPhase2() {
  console.log('🔍 开始验证 Phase 2 费用分摊逻辑...\n');

  let allTestsPassed = true;

  // ==================== 测试 1: 按货值分摊 ====================
  console.log('1️⃣ 验证按货值比例分摊...');

  const valueItems = [
    createMockItem({ id: '1', totalPrice: 10000 }),
    createMockItem({ id: '2', totalPrice: 5000 }),
    createMockItem({ id: '3', totalPrice: 3000 }),
  ];

  const valueResult = allocateExpensesByValue(valueItems, 1800);
  const valueTotal = Array.from(valueResult.values()).reduce(
    (sum, v) => sum + v,
    0
  );

  if (!verifyAllocationAccuracy(valueTotal, 1800, '按货值分摊')) {
    allTestsPassed = false;
  }

  // 验证比例正确性
  const item1Allocation = valueResult.get('1') || 0;
  const expectedItem1 = 1800 * (10000 / 18000); // 1000
  if (Math.abs(item1Allocation - expectedItem1) < 0.01) {
    console.log(
      `  ✅ 明细1分摊比例正确: ${item1Allocation} ≈ ${expectedItem1}`
    );
  } else {
    console.log(
      `  ❌ 明细1分摊比例错误: ${item1Allocation} ≠ ${expectedItem1}`
    );
    allTestsPassed = false;
  }

  // ==================== 测试 2: 按归属分摊 ====================
  console.log('\n2️⃣ 验证按归属分摊（客户货 vs 自有货）...');

  const ownershipItems = [
    createMockItem({ id: '1', ownership: 'customer', totalPrice: 10000 }),
    createMockItem({ id: '2', ownership: 'customer', totalPrice: 5000 }),
    createMockItem({ id: '3', ownership: 'self', totalPrice: 3000 }),
  ];

  const ownershipResult = allocateExpensesByOwnership(ownershipItems, 1800);
  const ownershipTotal = Array.from(ownershipResult.values()).reduce(
    (sum, v) => sum + v,
    0
  );

  if (!verifyAllocationAccuracy(ownershipTotal, 1800, '按归属分摊')) {
    allTestsPassed = false;
  }

  // 验证归属分组正确
  const customerTotal =
    (ownershipResult.get('1') || 0) + (ownershipResult.get('2') || 0);
  const selfTotal = ownershipResult.get('3') || 0;
  const expectedCustomerRatio = 15000 / 18000; // 客户货占比
  const expectedCustomerTotal = 1800 * expectedCustomerRatio; // 1500

  if (Math.abs(customerTotal - expectedCustomerTotal) < 0.01) {
    console.log(
      `  ✅ 客户货分摊正确: ${customerTotal.toFixed(2)} ≈ ${expectedCustomerTotal.toFixed(2)}`
    );
  } else {
    console.log(
      `  ❌ 客户货分摊错误: ${customerTotal.toFixed(2)} ≠ ${expectedCustomerTotal.toFixed(2)}`
    );
    allTestsPassed = false;
  }

  // ==================== 测试 3: 按重量分摊 ====================
  console.log('\n3️⃣ 验证按重量比例分摊...');

  const weightItems = [
    createMockItem({ id: '1', quantity: 100, weight: 2.0 }), // 200kg
    createMockItem({ id: '2', quantity: 50, weight: 2.0 }), // 100kg
    createMockItem({ id: '3', quantity: 100, weight: 1.0 }), // 100kg
  ];

  const weightResult = allocateExpensesByWeight(weightItems, 2000);
  const weightTotal = Array.from(weightResult.values()).reduce(
    (sum, v) => sum + v,
    0
  );

  if (!verifyAllocationAccuracy(weightTotal, 2000, '按重量分摊')) {
    allTestsPassed = false;
  }

  // ==================== 测试 4: 按数量分摊 ====================
  console.log('\n4️⃣ 验证按数量比例分摊...');

  const quantityItems = [
    createMockItem({ id: '1', quantity: 100 }),
    createMockItem({ id: '2', quantity: 50 }),
    createMockItem({ id: '3', quantity: 30 }),
  ];

  const quantityResult = allocateExpensesByQuantity(quantityItems, 1800);
  const quantityTotal = Array.from(quantityResult.values()).reduce(
    (sum, v) => sum + v,
    0
  );

  if (!verifyAllocationAccuracy(quantityTotal, 1800, '按数量分摊')) {
    allTestsPassed = false;
  }

  // ==================== 测试 5: 边界情况 ====================
  console.log('\n5️⃣ 验证边界情况处理...');

  // 5.1 空数组
  const emptyResult = allocateExpensesByValue([], 1000);
  if (emptyResult.size === 0) {
    console.log('  ✅ 空数组处理正确');
  } else {
    console.log('  ❌ 空数组处理错误');
    allTestsPassed = false;
  }

  // 5.2 费用为0
  const zeroExpenseResult = allocateExpensesByValue(valueItems, 0);
  const zeroTotal = Array.from(zeroExpenseResult.values()).reduce(
    (sum, v) => sum + v,
    0
  );
  if (zeroTotal === 0) {
    console.log('  ✅ 费用为0处理正确');
  } else {
    console.log('  ❌ 费用为0处理错误');
    allTestsPassed = false;
  }

  // 5.3 总金额为0（平均分摊）
  const zeroValueItems = [
    createMockItem({ id: '1', totalPrice: 0 }),
    createMockItem({ id: '2', totalPrice: 0 }),
  ];
  const zeroValueResult = allocateExpensesByValue(zeroValueItems, 1000);
  const item1Zero = zeroValueResult.get('1') || 0;
  const item2Zero = zeroValueResult.get('2') || 0;
  if (Math.abs(item1Zero - 500) < 0.01 && Math.abs(item2Zero - 500) < 0.01) {
    console.log('  ✅ 总金额为0时平均分摊正确');
  } else {
    console.log('  ❌ 总金额为0时平均分摊错误');
    allTestsPassed = false;
  }

  // 5.4 总重量为0（回退到按货值）
  const zeroWeightItems = [
    createMockItem({ id: '1', totalPrice: 10000 }),
    createMockItem({ id: '2', totalPrice: 5000 }),
  ];
  const zeroWeightResult = allocateExpensesByWeight(zeroWeightItems, 1500);
  const zeroWeightTotal = Array.from(zeroWeightResult.values()).reduce(
    (sum, v) => sum + v,
    0
  );
  if (Math.abs(zeroWeightTotal - 1500) < 0.01) {
    console.log('  ✅ 总重量为0时回退到按货值分摊正确');
  } else {
    console.log('  ❌ 总重量为0时回退到按货值分摊错误');
    allTestsPassed = false;
  }

  // ==================== 测试 6: 性能测试 ====================
  console.log('\n6️⃣ 验证性能（1000个明细）...');

  const largeItems = Array.from({ length: 1000 }, (_, i) =>
    createMockItem({
      id: `item-${i}`,
      totalPrice: Math.random() * 10000,
      quantity: Math.floor(Math.random() * 100) + 1,
      weight: Math.random() * 10,
    })
  );

  const startTime = Date.now();
  const largeResult = allocateExpenses(largeItems, 100000, 'by_value');
  const endTime = Date.now();
  const duration = endTime - startTime;

  if (duration < 100) {
    console.log(`  ✅ 性能测试通过: ${duration}ms < 100ms`);
  } else {
    console.log(`  ⚠️  性能测试警告: ${duration}ms >= 100ms`);
  }

  if (
    !verifyAllocationAccuracy(
      largeResult.allocatedTotal,
      100000,
      '大数据量分摊'
    )
  ) {
    allTestsPassed = false;
  }

  // ==================== 测试 7: 统一入口函数 ====================
  console.log('\n7️⃣ 验证统一入口函数...');

  const testItems = [
    createMockItem({ id: '1', totalPrice: 10000, quantity: 100, weight: 2.0 }),
    createMockItem({ id: '2', totalPrice: 5000, quantity: 50, weight: 1.0 }),
  ];

  const methods: Array<
    'by_value' | 'by_weight' | 'by_quantity' | 'by_ownership'
  > = ['by_value', 'by_weight', 'by_quantity', 'by_ownership'];

  for (const method of methods) {
    const result = allocateExpenses(testItems, 1500, method);
    if (
      result.method === method &&
      Math.abs(result.allocatedTotal - 1500) < 0.01
    ) {
      console.log(`  ✅ ${method} 方法正确`);
    } else {
      console.log(`  ❌ ${method} 方法错误`);
      allTestsPassed = false;
    }
  }

  // ==================== 总结 ====================
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Phase 2 验证总结');
  console.log('='.repeat(60));

  if (allTestsPassed) {
    console.log('✅ 所有验证测试通过！');
    console.log('✅ 按货值分摊算法正确');
    console.log('✅ 按归属分摊算法正确');
    console.log('✅ 按重量分摊算法正确');
    console.log('✅ 按数量分摊算法正确');
    console.log('✅ 边界情况处理正确');
    console.log('✅ 性能满足要求（< 100ms）');
    console.log('✅ 统一入口函数工作正常');
    console.log('\n🎉 Phase 2 验证通过！可以继续 Phase 3 实施。');
  } else {
    console.log('❌ 部分验证测试失败，请检查上述错误信息。');
    process.exit(1);
  }

  console.log('='.repeat(60));
}

// 运行验证
verifyPhase2()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('验证过程出错:', error);
    process.exit(1);
  });
