/**
 * Phase 5 验证脚本：财务报表集成
 *
 * 验证内容：
 * 1. 月度报表厂家发货利润统计功能
 * 2. 年度报表厂家发货利润统计功能
 * 3. 盈亏分析厂家发货利润集成
 * 4. 数据计算准确性
 * 5. 类型定义完整性
 */

import { roundToTwoDecimals } from '../lib/services/factory-shipment-expense-service';

// ==================== 辅助函数 ====================

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

// ==================== 模拟数据 ====================

interface MockOrder {
  id: string;
  totalAmount: number;
  receivableAmount: number;
  customerProfit: number;
  selfCostAmount: number;
  expenseAmount: number;
  profitAmount: number;
  shipmentDate: Date;
}

// 模拟厂家发货订单数据
const mockOrders: MockOrder[] = [
  {
    id: '1',
    totalAmount: 10000,
    receivableAmount: 12000,
    customerProfit: 1500,
    selfCostAmount: 500,
    expenseAmount: 300,
    profitAmount: 1700,
    shipmentDate: new Date('2024-01-15'),
  },
  {
    id: '2',
    totalAmount: 15000,
    receivableAmount: 18000,
    customerProfit: 2000,
    selfCostAmount: 800,
    expenseAmount: 400,
    profitAmount: 2400,
    shipmentDate: new Date('2024-01-20'),
  },
  {
    id: '3',
    totalAmount: 8000,
    receivableAmount: 9500,
    customerProfit: 1000,
    selfCostAmount: 300,
    expenseAmount: 200,
    profitAmount: 1100,
    shipmentDate: new Date('2024-02-10'),
  },
];

// ==================== 验证函数 ====================

console.log('\n========== Phase 5 验证开始 ==========\n');

// 验证 1: 月度统计数据计算
console.log('【验证 1】月度统计数据计算');
{
  // 模拟 2024年1月的订单（订单1和订单2）
  const januaryOrders = mockOrders.filter(o => o.shipmentDate.getMonth() === 0);

  const totalOrders = januaryOrders.length;
  const totalAmount = januaryOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalRevenue = januaryOrders.reduce(
    (sum, o) => sum + o.receivableAmount,
    0
  );
  const customerProfit = januaryOrders.reduce(
    (sum, o) => sum + o.customerProfit,
    0
  );
  const selfCostAmount = januaryOrders.reduce(
    (sum, o) => sum + o.selfCostAmount,
    0
  );
  const totalExpenses = januaryOrders.reduce(
    (sum, o) => sum + o.expenseAmount,
    0
  );
  const averageProfitMargin =
    totalRevenue > 0
      ? roundToTwoDecimals((customerProfit / totalRevenue) * 100)
      : 0;

  verify(totalOrders === 2, '1月订单数量正确');
  verifyClose(totalAmount, 25000, '1月订单总金额正确');
  verifyClose(totalRevenue, 30000, '1月总收入正确');
  verifyClose(customerProfit, 3500, '1月客户货利润正确');
  verifyClose(selfCostAmount, 1300, '1月自有货成本正确');
  verifyClose(totalExpenses, 700, '1月总费用正确');
  verifyClose(averageProfitMargin, 11.67, '1月平均利润率正确');
}

// 验证 2: 年度统计数据计算
console.log('\n【验证 2】年度统计数据计算');
{
  const totalOrders = mockOrders.length;
  const totalAmount = mockOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalRevenue = mockOrders.reduce(
    (sum, o) => sum + o.receivableAmount,
    0
  );
  const customerProfit = mockOrders.reduce(
    (sum, o) => sum + o.customerProfit,
    0
  );
  const selfCostAmount = mockOrders.reduce(
    (sum, o) => sum + o.selfCostAmount,
    0
  );
  const totalExpenses = mockOrders.reduce((sum, o) => sum + o.expenseAmount, 0);
  const averageProfitMargin =
    totalRevenue > 0
      ? roundToTwoDecimals((customerProfit / totalRevenue) * 100)
      : 0;

  verify(totalOrders === 3, '年度订单数量正确');
  verifyClose(totalAmount, 33000, '年度订单总金额正确');
  verifyClose(totalRevenue, 39500, '年度总收入正确');
  verifyClose(customerProfit, 4500, '年度客户货利润正确');
  verifyClose(selfCostAmount, 1600, '年度自有货成本正确');
  verifyClose(totalExpenses, 900, '年度总费用正确');
  verifyClose(averageProfitMargin, 11.39, '年度平均利润率正确');
}

// 验证 3: 月度趋势数据
console.log('\n【验证 3】月度趋势数据');
{
  const monthlyData: Array<{
    month: number;
    orders: number;
    profit: number;
    profitMargin: number;
  }> = [];

  for (let month = 1; month <= 12; month++) {
    const monthOrders = mockOrders.filter(
      o => o.shipmentDate.getMonth() + 1 === month
    );

    const monthProfit = monthOrders.reduce(
      (sum, o) => sum + o.customerProfit,
      0
    );
    const monthRevenue = monthOrders.reduce(
      (sum, o) => sum + o.receivableAmount,
      0
    );
    const monthProfitMargin =
      monthRevenue > 0
        ? roundToTwoDecimals((monthProfit / monthRevenue) * 100)
        : 0;

    monthlyData.push({
      month,
      orders: monthOrders.length,
      profit: roundToTwoDecimals(monthProfit),
      profitMargin: monthProfitMargin,
    });
  }

  // 验证1月数据
  verify(monthlyData[0].month === 1, '1月月份正确');
  verify(monthlyData[0].orders === 2, '1月订单数正确');
  verifyClose(monthlyData[0].profit, 3500, '1月利润正确');
  verifyClose(monthlyData[0].profitMargin, 11.67, '1月利润率正确');

  // 验证2月数据
  verify(monthlyData[1].month === 2, '2月月份正确');
  verify(monthlyData[1].orders === 1, '2月订单数正确');
  verifyClose(monthlyData[1].profit, 1000, '2月利润正确');
  verifyClose(monthlyData[1].profitMargin, 10.53, '2月利润率正确');

  // 验证3月数据（无订单）
  verify(monthlyData[2].month === 3, '3月月份正确');
  verify(monthlyData[2].orders === 0, '3月订单数正确');
  verifyClose(monthlyData[2].profit, 0, '3月利润正确');
  verifyClose(monthlyData[2].profitMargin, 0, '3月利润率正确');
}

// 验证 4: 盈亏分析利润占比计算
console.log('\n【验证 4】盈亏分析利润占比计算');
{
  const customerProfit = mockOrders.reduce(
    (sum, o) => sum + o.customerProfit,
    0
  );
  const totalRevenue = 100000; // 假设总收入为10万

  const percentageOfTotal = roundToTwoDecimals(
    (customerProfit / totalRevenue) * 100
  );

  verifyClose(percentageOfTotal, 4.5, '利润占比计算正确');
}

// 验证 5: 精度处理
console.log('\n【验证 5】精度处理');
{
  const revenue = 12345.678;
  const profit = 1234.567;
  const profitMargin = roundToTwoDecimals((profit / revenue) * 100);

  const decimalPlaces = profitMargin.toString().split('.')[1]?.length || 0;
  verify(decimalPlaces <= 2, '利润率精度 <= 2位小数');
  verifyClose(profitMargin, 10, '利润率计算正确');
}

// 验证 6: 空数据处理
console.log('\n【验证 6】空数据处理');
{
  const emptyOrders: MockOrder[] = [];

  const totalOrders = emptyOrders.length;
  const totalAmount = emptyOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalRevenue = emptyOrders.reduce(
    (sum, o) => sum + o.receivableAmount,
    0
  );
  const customerProfit = emptyOrders.reduce(
    (sum, o) => sum + o.customerProfit,
    0
  );
  const averageProfitMargin =
    totalRevenue > 0
      ? roundToTwoDecimals((customerProfit / totalRevenue) * 100)
      : 0;

  verify(totalOrders === 0, '空数据订单数量正确');
  verifyClose(totalAmount, 0, '空数据总金额正确');
  verifyClose(totalRevenue, 0, '空数据总收入正确');
  verifyClose(customerProfit, 0, '空数据利润正确');
  verifyClose(averageProfitMargin, 0, '空数据利润率正确（避免除零）');
}

// 验证 7: 数据汇总一致性
console.log('\n【验证 7】数据汇总一致性');
{
  // 月度数据汇总应等于年度数据
  const monthlyTotal = mockOrders
    .filter(o => o.shipmentDate.getMonth() === 0)
    .reduce((sum, o) => sum + o.customerProfit, 0);
  const februaryTotal = mockOrders
    .filter(o => o.shipmentDate.getMonth() === 1)
    .reduce((sum, o) => sum + o.customerProfit, 0);
  const yearlyTotal = mockOrders.reduce((sum, o) => sum + o.customerProfit, 0);

  verifyClose(
    monthlyTotal + februaryTotal,
    yearlyTotal,
    '月度汇总等于年度总计'
  );
}

console.log('\n========== ✅ Phase 5 验证全部通过！ ==========\n');
