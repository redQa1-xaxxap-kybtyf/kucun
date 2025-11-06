/**
 * Phase 4 验证脚本：自有货成本记录
 *
 * 验证内容：
 * 1. 加权平均成本计算正确性
 * 2. 原库存为0时的成本计算
 * 3. 多次入库的成本累积
 * 4. 精度处理
 * 5. 边界情况
 */

import { roundToTwoDecimals } from '../lib/services/factory-shipment-expense-service';

// ==================== 辅助函数（从 factory-shipments.ts 复制） ====================

/**
 * 计算加权平均成本
 *
 * 公式: 新单位成本 = (原库存金额 + 新入库金额) / (原库存数量 + 新入库数量)
 *
 * @param currentStock - 当前库存数量
 * @param currentUnitCost - 当前单位成本
 * @param inboundQuantity - 入库数量
 * @param inboundUnitCost - 入库单位成本
 * @returns 新的单位成本
 */
function calculateWeightedAverageCost(
  currentStock: number,
  currentUnitCost: number,
  inboundQuantity: number,
  inboundUnitCost: number
): number {
  const currentValue = currentStock * currentUnitCost;
  const inboundValue = inboundQuantity * inboundUnitCost;
  const totalQuantity = currentStock + inboundQuantity;

  return totalQuantity > 0
    ? roundToTwoDecimals((currentValue + inboundValue) / totalQuantity)
    : inboundUnitCost;
}

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

console.log('\n========== Phase 4 验证开始 ==========\n');

// 验证 1: 基本加权平均成本计算
console.log('【验证 1】基本加权平均成本计算');
{
  // 原库存: 100件 @ 10元/件 = 1000元
  // 新入库: 50件 @ 12元/件 = 600元
  // 新成本: (1000 + 600) / (100 + 50) = 1600 / 150 = 10.67元/件
  const result = calculateWeightedAverageCost(100, 10, 50, 12);
  verifyClose(result, 10.67, '加权平均成本计算正确');
}

// 验证 2: 原库存为0时的成本计算
console.log('\n【验证 2】原库存为0时的成本计算');
{
  // 原库存: 0件 @ 0元/件
  // 新入库: 100件 @ 15元/件
  // 新成本: 15元/件（直接使用入库成本）
  const result = calculateWeightedAverageCost(0, 0, 100, 15);
  verifyClose(result, 15, '原库存为0时成本正确');
}

// 验证 3: 多次入库的成本累积
console.log('\n【验证 3】多次入库的成本累积');
{
  // 第一次入库: 100件 @ 10元/件
  let stock = 100;
  let unitCost = 10;

  // 第二次入库: 50件 @ 12元/件
  unitCost = calculateWeightedAverageCost(stock, unitCost, 50, 12);
  stock += 50;
  verifyClose(unitCost, 10.67, '第二次入库后成本正确');

  // 第三次入库: 30件 @ 15元/件
  unitCost = calculateWeightedAverageCost(stock, unitCost, 30, 15);
  stock += 30;
  // (150 * 10.67 + 30 * 15) / 180 = (1600.5 + 450) / 180 = 11.39
  verifyClose(unitCost, 11.39, '第三次入库后成本正确');
}

// 验证 4: 入库成本高于原成本
console.log('\n【验证 4】入库成本高于原成本');
{
  // 原库存: 100件 @ 10元/件
  // 新入库: 100件 @ 20元/件
  // 新成本: (1000 + 2000) / 200 = 15元/件
  const result = calculateWeightedAverageCost(100, 10, 100, 20);
  verifyClose(result, 15, '入库成本高于原成本时计算正确');
}

// 验证 5: 入库成本低于原成本
console.log('\n【验证 5】入库成本低于原成本');
{
  // 原库存: 100件 @ 20元/件
  // 新入库: 100件 @ 10元/件
  // 新成本: (2000 + 1000) / 200 = 15元/件
  const result = calculateWeightedAverageCost(100, 20, 100, 10);
  verifyClose(result, 15, '入库成本低于原成本时计算正确');
}

// 验证 6: 小数量入库
console.log('\n【验证 6】小数量入库');
{
  // 原库存: 1000件 @ 10元/件
  // 新入库: 1件 @ 15元/件
  // 新成本: (10000 + 15) / 1001 = 10.01元/件
  const result = calculateWeightedAverageCost(1000, 10, 1, 15);
  verifyClose(result, 10.01, '小数量入库时成本变化正确');
}

// 验证 7: 大数量入库
console.log('\n【验证 7】大数量入库');
{
  // 原库存: 10件 @ 10元/件
  // 新入库: 1000件 @ 15元/件
  // 新成本: (100 + 15000) / 1010 = 14.95元/件
  const result = calculateWeightedAverageCost(10, 10, 1000, 15);
  verifyClose(result, 14.95, '大数量入库时成本变化正确');
}

// 验证 8: 精度处理（四舍五入到2位小数）
console.log('\n【验证 8】精度处理');
{
  // 原库存: 100件 @ 10.33元/件
  // 新入库: 50件 @ 12.67元/件
  // 新成本: (1033 + 633.5) / 150 = 11.11元/件
  const result = calculateWeightedAverageCost(100, 10.33, 50, 12.67);
  verifyClose(result, 11.11, '精度处理正确（四舍五入到2位小数）');

  // 验证结果确实是2位小数
  const decimalPlaces = result.toString().split('.')[1]?.length || 0;
  verify(decimalPlaces <= 2, '结果精度 <= 2位小数');
}

// 验证 9: 极小金额
console.log('\n【验证 9】极小金额');
{
  // 原库存: 1件 @ 0.01元/件
  // 新入库: 1件 @ 0.02元/件
  // 新成本: (0.01 + 0.02) / 2 = 0.015 ≈ 0.02元/件
  const result = calculateWeightedAverageCost(1, 0.01, 1, 0.02);
  verifyClose(result, 0.02, '极小金额处理正确');
}

// 验证 10: 极大金额
console.log('\n【验证 10】极大金额');
{
  // 原库存: 10000件 @ 10000元/件
  // 新入库: 5000件 @ 15000元/件
  // 新成本: (100000000 + 75000000) / 15000 = 11666.67元/件
  const result = calculateWeightedAverageCost(10000, 10000, 5000, 15000);
  verifyClose(result, 11666.67, '极大金额处理正确');
}

// 验证 11: 入库成本为0
console.log('\n【验证 11】入库成本为0');
{
  // 原库存: 100件 @ 10元/件
  // 新入库: 50件 @ 0元/件（免费获得）
  // 新成本: (1000 + 0) / 150 = 6.67元/件
  const result = calculateWeightedAverageCost(100, 10, 50, 0);
  verifyClose(result, 6.67, '入库成本为0时计算正确');
}

// 验证 12: 原成本为0但有库存
console.log('\n【验证 12】原成本为0但有库存');
{
  // 原库存: 100件 @ 0元/件（可能是初始化数据）
  // 新入库: 50件 @ 12元/件
  // 新成本: (0 + 600) / 150 = 4元/件
  const result = calculateWeightedAverageCost(100, 0, 50, 12);
  verifyClose(result, 4, '原成本为0但有库存时计算正确');
}

// 验证 13: 入库数量为0（边界情况）
console.log('\n【验证 13】入库数量为0（边界情况）');
{
  // 原库存: 100件 @ 10元/件
  // 新入库: 0件 @ 15元/件
  // 新成本: 应保持原成本 10元/件
  const result = calculateWeightedAverageCost(100, 10, 0, 15);
  verifyClose(result, 10, '入库数量为0时成本不变');
}

// 验证 14: 原库存和入库数量都为0
console.log('\n【验证 14】原库存和入库数量都为0');
{
  // 原库存: 0件 @ 0元/件
  // 新入库: 0件 @ 15元/件
  // 新成本: 应返回入库成本 15元/件
  const result = calculateWeightedAverageCost(0, 0, 0, 15);
  verifyClose(result, 15, '原库存和入库数量都为0时返回入库成本');
}

// 验证 15: 实际业务场景模拟
console.log('\n【验证 15】实际业务场景模拟');
{
  // 场景：某产品的库存成本变化
  let stock = 0;
  let unitCost = 0;

  // 第1批入库：200件 @ 100元/件（采购价）
  unitCost = calculateWeightedAverageCost(stock, unitCost, 200, 100);
  stock += 200;
  verifyClose(unitCost, 100, '第1批入库成本正确');

  // 第2批入库：150件 @ 105元/件（采购价 + 分摊费用）
  unitCost = calculateWeightedAverageCost(stock, unitCost, 150, 105);
  stock += 150;
  // (200 * 100 + 150 * 105) / 350 = (20000 + 15750) / 350 = 102.14
  verifyClose(unitCost, 102.14, '第2批入库成本正确');

  // 第3批入库：100件 @ 110元/件（采购价上涨 + 分摊费用）
  unitCost = calculateWeightedAverageCost(stock, unitCost, 100, 110);
  stock += 100;
  // (350 * 102.14 + 100 * 110) / 450 = (35749 + 11000) / 450 = 103.89
  verifyClose(unitCost, 103.89, '第3批入库成本正确');

  verify(stock === 450, '库存数量累积正确');
}

console.log('\n========== ✅ Phase 4 验证全部通过！ ==========\n');
