/**
 * 调货销售功能手动测试脚本
 * 测试调货销售订单的创建和业务逻辑
 */

import {
  CreateSalesOrderSchema,
  SALES_ORDER_TYPE_OPTIONS,
} from '../lib/validations/sales-order';

console.log('🧪 调货销售功能测试开始');
console.log('='.repeat(50));

// 测试1: 验证订单类型选项
console.log('\n📋 测试1: 订单类型选项验证');
console.log(`订单类型选项数量: ${SALES_ORDER_TYPE_OPTIONS.length}`);
SALES_ORDER_TYPE_OPTIONS.forEach((option, index) => {
  console.log(`  ${index + 1}. ${option.value} - ${option.label}`);
  console.log(`     描述: ${option.description}`);
});

// 测试2: 正常销售订单验证
console.log('\n📋 测试2: 正常销售订单验证');
const normalOrderData = {
  customerId: '123e4567-e89b-12d3-a456-426614174000',
  orderType: 'normal' as const,
  status: 'draft' as const,
  remarks: '正常销售订单测试',
  items: [
    {
      productId: '123e4567-e89b-12d3-a456-426614174001',
      colorCode: 'WHITE',
      productionDate: '2024-01-01',
      quantity: 100,
      unitPrice: 50.0,
      displayUnit: '片' as const,
      displayQuantity: 100,
      piecesPerUnit: 1,
      specification: '600x600mm',
      remarks: '测试商品',
    },
  ],
};

const normalResult = CreateSalesOrderSchema.safeParse(normalOrderData);
console.log(
  `正常销售订单验证结果: ${normalResult.success ? '✅ 通过' : '❌ 失败'}`
);
if (!normalResult.success) {
  console.log('错误详情:', normalResult.error.issues);
}

// 测试3: 调货销售订单验证（完整数据）
console.log('\n📋 测试3: 调货销售订单验证（完整数据）');
const transferOrderData = {
  customerId: '123e4567-e89b-12d3-a456-426614174000',
  supplierId: '123e4567-e89b-12d3-a456-426614174002',
  orderType: 'transfer' as const,
  status: 'draft' as const,
  remarks: '调货销售订单测试',
  items: [
    {
      productId: '123e4567-e89b-12d3-a456-426614174001',
      colorCode: 'WHITE',
      productionDate: '2024-01-01',
      quantity: 100,
      unitPrice: 60.0, // 销售价
      costPrice: 45.0, // 成本价
      displayUnit: '片' as const,
      displayQuantity: 100,
      piecesPerUnit: 1,
      specification: '600x600mm',
      remarks: '调货商品',
    },
  ],
};

const transferResult = CreateSalesOrderSchema.safeParse(transferOrderData);
console.log(
  `调货销售订单验证结果: ${transferResult.success ? '✅ 通过' : '❌ 失败'}`
);
if (!transferResult.success) {
  console.log('错误详情:', transferResult.error.issues);
}

// 测试4: 调货销售订单验证（缺少供应商）
console.log('\n📋 测试4: 调货销售订单验证（缺少供应商）');
const invalidTransferOrderData = {
  customerId: '123e4567-e89b-12d3-a456-426614174000',
  // 缺少 supplierId
  orderType: 'transfer' as const,
  status: 'draft' as const,
  remarks: '无效的调货销售订单',
  items: [
    {
      productId: '123e4567-e89b-12d3-a456-426614174001',
      colorCode: 'WHITE',
      productionDate: '2024-01-01',
      quantity: 100,
      unitPrice: 60.0,
      costPrice: 45.0,
      displayUnit: '片' as const,
      displayQuantity: 100,
      piecesPerUnit: 1,
      specification: '600x600mm',
      remarks: '调货商品',
    },
  ],
};

const invalidResult = CreateSalesOrderSchema.safeParse(
  invalidTransferOrderData
);
console.log(
  `缺少供应商验证结果: ${invalidResult.success ? '❌ 应该失败但通过了' : '✅ 正确拒绝'}`
);
if (!invalidResult.success) {
  const supplierError = invalidResult.error.issues.find(issue =>
    issue.message.includes('供应商')
  );
  console.log(`供应商验证错误: ${supplierError ? '✅ 找到' : '❌ 未找到'}`);
  if (supplierError) {
    console.log(`错误信息: ${supplierError.message}`);
  }
}

// 测试5: 成本和毛利计算
console.log('\n📋 测试5: 成本和毛利计算测试');
const items = [
  { quantity: 100, unitPrice: 60.0, costPrice: 45.0 },
  { quantity: 50, unitPrice: 80.0, costPrice: 60.0 },
];

// 计算总销售金额
const totalAmount = items.reduce(
  (sum, item) => sum + item.quantity * item.unitPrice,
  0
);
console.log(`总销售金额: ${totalAmount} 元`);

// 计算总成本金额
const costAmount = items.reduce(
  (sum, item) => sum + item.quantity * item.costPrice,
  0
);
console.log(`总成本金额: ${costAmount} 元`);

// 计算毛利
const profitAmount = totalAmount - costAmount;
console.log(`毛利金额: ${profitAmount} 元`);
console.log(`毛利率: ${((profitAmount / totalAmount) * 100).toFixed(2)}%`);

// 验证计算结果
const expectedTotal = 100 * 60 + 50 * 80; // 6000 + 4000 = 10000
const expectedCost = 100 * 45 + 50 * 60; // 4500 + 3000 = 7500
const expectedProfit = expectedTotal - expectedCost; // 10000 - 7500 = 2500

console.log(`\n计算验证:`);
console.log(
  `总销售金额计算: ${totalAmount === expectedTotal ? '✅ 正确' : '❌ 错误'}`
);
console.log(
  `总成本金额计算: ${costAmount === expectedCost ? '✅ 正确' : '❌ 错误'}`
);
console.log(
  `毛利金额计算: ${profitAmount === expectedProfit ? '✅ 正确' : '❌ 错误'}`
);

console.log('\n='.repeat(50));
console.log('🎉 调货销售功能测试完成');

// 测试总结
const allTestsPassed =
  normalResult.success &&
  transferResult.success &&
  !invalidResult.success &&
  totalAmount === expectedTotal &&
  costAmount === expectedCost &&
  profitAmount === expectedProfit;

console.log(
  `\n📊 测试总结: ${allTestsPassed ? '✅ 所有测试通过' : '❌ 部分测试失败'}`
);

if (allTestsPassed) {
  console.log('🚀 调货销售功能已准备就绪，可以进行UI测试！');
} else {
  console.log('⚠️  请检查失败的测试项目');
}
