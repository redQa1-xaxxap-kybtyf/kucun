/**
 * Phase 3 验证脚本：客户货利润计算
 *
 * 验证内容：
 * 1. 利润计算公式正确性
 * 2. 利润率计算正确性
 * 3. 单位成本计算正确性
 * 4. 与费用分摊服务的集成
 * 5. 边界情况处理
 */

import { allocateExpenses } from '../lib/services/factory-shipment-expense-service';
import {
  allocateReceivableAmount,
  calculateItemProfit,
  calculateOrderProfit,
  calculateSelfItemCost,
  extractItemUpdates,
} from '../lib/services/factory-shipment-profit-service';
import type { FactoryShipmentOrderItem } from '../lib/types/factory-shipment';

// ==================== 测试数据 ====================

const createMockItem = (
  overrides: Partial<FactoryShipmentOrderItem> = {}
): FactoryShipmentOrderItem => ({
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
});

// ==================== 验证函数 ====================

function verify(condition: boolean, message: string): void {
  if (condition) {
    console.log(`✅ ${message}`);
  } else {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

function verifyClose(
  actual: number,
  expected: number,
  message: string,
  tolerance = 0.01
): void {
  const diff = Math.abs(actual - expected);
  if (diff < tolerance) {
    console.log(`✅ ${message} (实际: ${actual}, 期望: ${expected})`);
  } else {
    console.error(
      `❌ ${message} (实际: ${actual}, 期望: ${expected}, 差额: ${diff})`
    );
    process.exit(1);
  }
}

// ==================== 验证测试 ====================

console.log('\n========== Phase 3 验证开始 ==========\n');

// 验证 1: 利润计算公式正确性
console.log('【验证 1】利润计算公式正确性');
{
  const item = createMockItem({
    id: '1',
    quantity: 100,
    unitPrice: 100,
    totalPrice: 10000,
  });

  const result = calculateItemProfit(item, 12000, 500);

  // 利润 = 12000 - 10000 - 500 = 1500
  verifyClose(result.profitAmount, 1500, '利润金额计算正确');
  verifyClose(result.revenue, 12000, '收入金额正确');
  verifyClose(result.cost, 10000, '成本金额正确');
  verifyClose(result.allocatedExpense, 500, '分摊费用正确');
}

// 验证 2: 利润率计算正确性
console.log('\n【验证 2】利润率计算正确性');
{
  const item = createMockItem({
    id: '1',
    quantity: 100,
    unitPrice: 100,
    totalPrice: 10000,
  });

  const result = calculateItemProfit(item, 12000, 500);

  // 利润率 = (1500 / 12000) * 100 = 12.5%
  verifyClose(result.profitMargin, 12.5, '利润率计算正确');
}

// 验证 3: 单位成本计算正确性
console.log('\n【验证 3】单位成本计算正确性');
{
  const item = createMockItem({
    id: '1',
    quantity: 100,
    unitPrice: 100,
    totalPrice: 10000,
  });

  const result = calculateItemProfit(item, 12000, 500);

  // 单位成本 = 100 + 500/100 = 105
  verifyClose(result.unitCost, 105, '单位成本计算正确');
}

// 验证 4: 自有货成本计算
console.log('\n【验证 4】自有货成本计算');
{
  const item = createMockItem({
    id: '1',
    quantity: 100,
    unitPrice: 100,
  });

  const unitCost = calculateSelfItemCost(item, 500);

  // 单位成本 = 100 + 500/100 = 105
  verifyClose(unitCost, 105, '自有货单位成本计算正确');
}

// 验证 5: 应收金额分配
console.log('\n【验证 5】应收金额分配');
{
  const items = [
    createMockItem({ id: '1', ownership: 'customer', totalPrice: 10000 }),
    createMockItem({ id: '2', ownership: 'customer', totalPrice: 5000 }),
  ];

  const allocations = allocateReceivableAmount(items, 18000);

  // item1: 18000 * (10000/15000) = 12000
  // item2: 18000 * (5000/15000) = 6000
  verifyClose(allocations.get('1') || 0, 12000, '明细1应收金额分配正确');
  verifyClose(allocations.get('2') || 0, 6000, '明细2应收金额分配正确');

  const total = Array.from(allocations.values()).reduce((sum, v) => sum + v, 0);
  verifyClose(total, 18000, '应收金额分配总额正确');
}

// 验证 6: 订单总利润计算（客户货和自有货混合）
console.log('\n【验证 6】订单总利润计算（客户货和自有货混合）');
{
  const items = [
    createMockItem({
      id: '1',
      ownership: 'customer',
      quantity: 100,
      unitPrice: 100,
      totalPrice: 10000,
    }),
    createMockItem({
      id: '2',
      ownership: 'customer',
      quantity: 50,
      unitPrice: 100,
      totalPrice: 5000,
    }),
    createMockItem({
      id: '3',
      ownership: 'self',
      quantity: 30,
      unitPrice: 100,
      totalPrice: 3000,
    }),
  ];

  const expenseAllocations = new Map([
    ['1', 600],
    ['2', 300],
    ['3', 100],
  ]);

  const result = calculateOrderProfit(items, 18000, expenseAllocations);

  // 客户货总收入: 18000
  // 客户货总成本: 10000 + 5000 = 15000
  // 客户货总费用: 600 + 300 = 900
  // 客户货总利润: 18000 - 15000 - 900 = 2100
  // 自有货总成本: 3000 + 100 = 3100
  verifyClose(result.customerProfit, 2100, '客户货总利润正确');
  verifyClose(result.totalRevenue, 18000, '客户货总收入正确');
  verifyClose(result.totalCost, 15000, '客户货总成本正确');
  verifyClose(result.selfCostAmount, 3100, '自有货总成本正确');
  verifyClose(result.totalExpenses, 1000, '总费用正确');
  verify(result.itemResults.length === 2, '客户货明细数量正确（2个）');
}

// 验证 7: 与费用分摊服务集成
console.log('\n【验证 7】与费用分摊服务集成');
{
  const items = [
    createMockItem({
      id: '1',
      ownership: 'customer',
      totalPrice: 10000,
      weight: 100,
    }),
    createMockItem({
      id: '2',
      ownership: 'customer',
      totalPrice: 5000,
      weight: 50,
    }),
  ];

  // 使用 Phase 2 的费用分摊服务
  const expenseAllocation = allocateExpenses(items, 1500, {
    method: 'by_value',
  });

  verify(expenseAllocation.results.length === 2, '费用分摊结果数量正确');
  verifyClose(expenseAllocation.allocatedTotal, 1500, '费用分摊总额正确');

  // 将分摊结果转换为 Map
  const expenseMap = new Map(
    expenseAllocation.results.map(r => [r.itemId, r.allocatedAmount])
  );

  // 计算利润
  const profitResult = calculateOrderProfit(items, 18000, expenseMap);

  verify(profitResult.customerProfit > 0, '利润计算成功');
  verify(profitResult.itemResults.length === 2, '利润明细数量正确');
}

// 验证 8: 明细更新数据提取
console.log('\n【验证 8】明细更新数据提取');
{
  const items = [
    createMockItem({
      id: '1',
      ownership: 'customer',
      quantity: 100,
      unitPrice: 100,
      totalPrice: 10000,
    }),
    createMockItem({
      id: '2',
      ownership: 'self',
      quantity: 50,
      unitPrice: 100,
      totalPrice: 5000,
    }),
  ];

  const expenseAllocations = new Map([
    ['1', 600],
    ['2', 300],
  ]);

  const profitSummary = calculateOrderProfit(items, 12000, expenseAllocations);
  const updates = extractItemUpdates(profitSummary, items, expenseAllocations);

  verify(updates.length === 2, '更新数据数量正确');

  const customerUpdate = updates.find(u => u.itemId === '1');
  verify(customerUpdate !== undefined, '客户货更新数据存在');
  if (customerUpdate) {
    verify(customerUpdate.profitAmount > 0, '客户货利润金额 > 0');
    verify(customerUpdate.profitMargin > 0, '客户货利润率 > 0');
  }

  const selfUpdate = updates.find(u => u.itemId === '2');
  verify(selfUpdate !== undefined, '自有货更新数据存在');
  if (selfUpdate) {
    verify(selfUpdate.profitAmount === 0, '自有货利润金额 = 0');
    verify(selfUpdate.profitMargin === 0, '自有货利润率 = 0');
    verify(selfUpdate.unitCost > 100, '自有货单位成本包含分摊费用');
  }
}

// 验证 9: 边界情况 - 负利润（亏损）
console.log('\n【验证 9】边界情况 - 负利润（亏损）');
{
  const item = createMockItem({
    id: '1',
    quantity: 100,
    unitPrice: 100,
    totalPrice: 10000,
  });

  const result = calculateItemProfit(item, 9000, 500);

  // 利润 = 9000 - 10000 - 500 = -1500
  verifyClose(result.profitAmount, -1500, '负利润计算正确');
  verify(result.profitMargin < 0, '负利润率正确');
}

// 验证 10: 边界情况 - 应收金额为0
console.log('\n【验证 10】边界情况 - 应收金额为0');
{
  const item = createMockItem({
    id: '1',
    quantity: 100,
    unitPrice: 100,
    totalPrice: 10000,
  });

  const result = calculateItemProfit(item, 0, 500);

  verifyClose(result.profitAmount, -10500, '应收为0时利润计算正确');
  verify(result.profitMargin === 0, '应收为0时利润率为0');
}

// 验证 11: 精度处理
console.log('\n【验证 11】精度处理');
{
  const item = createMockItem({
    id: '1',
    quantity: 3,
    unitPrice: 10.33,
    totalPrice: 30.99,
  });

  const result = calculateItemProfit(item, 40, 1.5);

  verify(
    result.profitAmount.toString().split('.')[1]?.length <= 2,
    '利润金额精度 <= 2位小数'
  );
  verify(
    result.profitMargin.toString().split('.')[1]?.length <= 2,
    '利润率精度 <= 2位小数'
  );
  verify(
    result.unitCost.toString().split('.')[1]?.length <= 2,
    '单位成本精度 <= 2位小数'
  );
}

console.log('\n========== ✅ Phase 3 验证全部通过！ ==========\n');
