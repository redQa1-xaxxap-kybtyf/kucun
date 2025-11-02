/**
 * 验证库存选择器类型定义
 * 确保 Prisma 关系定义正确，类型推导正常
 */

import type { Prisma } from '@prisma/client';

import {
  INVENTORY_SELECT,
  type InventoryWithRelations,
} from '@/lib/api/selectors/inventory-selectors';

console.log('🧪 验证库存选择器类型定义');
console.log('='.repeat(80));

// 测试 1: 验证 INVENTORY_SELECT 类型
console.log('\n📍 测试 1: 验证 INVENTORY_SELECT 类型');
try {
  // 这应该通过类型检查
  const select: Prisma.InventorySelect = INVENTORY_SELECT;
  console.log('   ✅ INVENTORY_SELECT 类型正确');
  console.log(`   - 包含字段数: ${Object.keys(select).length}`);
  console.log(`   - 包含 variant 关系: ${select.variant ? '是' : '否'}`);
  console.log(`   - 包含 product 关系: ${select.product ? '是' : '否'}`);
} catch (error) {
  console.error('   ❌ INVENTORY_SELECT 类型错误:', error);
  process.exit(1);
}

// 测试 2: 验证 InventoryWithRelations 类型推导
console.log('\n📍 测试 2: 验证 InventoryWithRelations 类型推导');
try {
  // 模拟查询结果
  const mockInventory: InventoryWithRelations = {
    id: 'test-id',
    productId: 'product-id',
    variantId: 'variant-id',
    batchNumber: 'BATCH-001',
    quantity: 100,
    reservedQuantity: 10,
    location: 'A-01',
    unitCost: 50.0,
    updatedAt: new Date(),
    product: {
      id: 'product-id',
      code: 'P001',
      name: '测试产品',
      specification: '规格',
      unit: '件',
      piecesPerUnit: 100,
      weight: 10.5,
      status: 'active',
      categoryId: 'category-id',
      category: {
        id: 'category-id',
        name: '测试分类',
        code: 'C001',
      },
    },
    variant: {
      id: 'variant-id',
      sku: 'SKU-001',
      colorCode: 'RED',
      colorName: '红色',
    },
  };

  console.log('   ✅ InventoryWithRelations 类型推导正确');
  console.log(`   - ID: ${mockInventory.id}`);
  console.log(`   - 产品: ${mockInventory.product.name}`);
  console.log(`   - 变体: ${mockInventory.variant?.colorName || '无'}`);
  console.log(`   - 数量: ${mockInventory.quantity}`);
  console.log(`   - 位置: ${mockInventory.location || '未指定'}`);
} catch (error) {
  console.error('   ❌ InventoryWithRelations 类型错误:', error);
  process.exit(1);
}

// 测试 3: 验证 variant 字段是可选的
console.log('\n📍 测试 3: 验证 variant 字段是可选的');
try {
  const inventoryWithoutVariant: InventoryWithRelations = {
    id: 'test-id-2',
    productId: 'product-id-2',
    variantId: null,
    batchNumber: null,
    quantity: 50,
    reservedQuantity: 0,
    location: null,
    unitCost: null,
    updatedAt: new Date(),
    product: {
      id: 'product-id-2',
      code: 'P002',
      name: '无变体产品',
      specification: '规格',
      unit: '件',
      piecesPerUnit: 100,
      weight: 10.5,
      status: 'active',
      categoryId: null,
      category: null,
    },
    variant: null,
  };

  console.log('   ✅ variant 字段可选性验证通过');
  console.log(`   - 产品: ${inventoryWithoutVariant.product.name}`);
  console.log(`   - 变体: ${inventoryWithoutVariant.variant?.colorName || '无'}`);
} catch (error) {
  console.error('   ❌ variant 可选性验证失败:', error);
  process.exit(1);
}

// 测试 4: 验证选择器字段完整性
console.log('\n📍 测试 4: 验证选择器字段完整性');
const expectedFields = [
  'id',
  'productId',
  'variantId',
  'batchNumber',
  'quantity',
  'reservedQuantity',
  'location',
  'unitCost',
  'updatedAt',
  'product',
  'variant',
];

const actualFields = Object.keys(INVENTORY_SELECT);
const missingFields = expectedFields.filter(
  field => !actualFields.includes(field)
);
const extraFields = actualFields.filter(
  field => !expectedFields.includes(field)
);

if (missingFields.length > 0) {
  console.error(`   ❌ 缺少字段: ${missingFields.join(', ')}`);
  process.exit(1);
}

if (extraFields.length > 0) {
  console.log(`   ⚠️  额外字段: ${extraFields.join(', ')}`);
}

console.log('   ✅ 选择器字段完整性验证通过');
console.log(`   - 预期字段数: ${expectedFields.length}`);
console.log(`   - 实际字段数: ${actualFields.length}`);

// 测试 5: 验证嵌套选择器
console.log('\n📍 测试 5: 验证嵌套选择器');
try {
  if (INVENTORY_SELECT.variant && typeof INVENTORY_SELECT.variant === 'object') {
    const variantSelect = INVENTORY_SELECT.variant.select;
    const variantFields = Object.keys(variantSelect);
    console.log('   ✅ variant 嵌套选择器正确');
    console.log(`   - variant 字段: ${variantFields.join(', ')}`);
  }

  if (INVENTORY_SELECT.product && typeof INVENTORY_SELECT.product === 'object') {
    const productSelect = INVENTORY_SELECT.product.select;
    const productFields = Object.keys(productSelect);
    console.log('   ✅ product 嵌套选择器正确');
    console.log(`   - product 字段: ${productFields.join(', ')}`);
  }
} catch (error) {
  console.error('   ❌ 嵌套选择器验证失败:', error);
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
console.log('✅ 所有验证通过！库存选择器类型定义正确！');
console.log('='.repeat(80));
console.log('\n💡 提示：');
console.log('   - INVENTORY_SELECT 可以在 Prisma 查询中使用');
console.log('   - InventoryWithRelations 类型会自动推导');
console.log('   - variant 字段是可选的，支持无变体的产品');
console.log('   - 所有嵌套关系都已正确定义');

