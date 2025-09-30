# 产品与库存交互潜在问题分析

## 🔍 深度分析结果

本文档详细记录了产品和库存之间交互的潜在问题、风险点和改进建议。

---

## ✅ 已做得好的地方

### 1. 删除保护机制完善

**产品删除** (`lib/api/handlers/products.ts`):

```typescript
// 检查是否有关联数据
const hasRelatedData =
  product._count.inventory > 0 ||
  product._count.salesOrderItems > 0 ||
  product._count.inboundRecords > 0;

if (hasRelatedData) {
  throw new Error('该产品存在关联的库存、销售订单或入库记录，无法删除');
}
```

**产品变体删除** (`app/api/product-variants/[id]/route.ts`):

```typescript
// 检查是否有库存记录
const hasInventory = existingVariant.inventory.some(inv => inv.quantity > 0);
if (hasInventory) {
  return NextResponse.json(
    { success: false, error: '该变体仍有库存，无法删除' },
    { status: 400 }
  );
}
```

### 2. 级联删除配置正确

**Prisma Schema**:

```prisma
model ProductVariant {
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}
```

### 3. 事务保证数据一致性

所有涉及产品和库存的操作都使用了事务。

---

## 🚨 发现的潜在问题

### 问题1: 产品状态变更未影响库存操作

**位置**: 产品状态管理

**问题描述**:

- 产品状态有`active`和`inactive`
- 但是`inactive`产品仍然可以进行库存操作(入库/出库/调整)
- 没有状态检查机制

**风险**: ⚠️ 中等

- 已停用产品仍可操作库存
- 可能导致业务混乱

**建议修复**:

```typescript
// 在入库/出库/调整前检查产品状态
async function validateProductStatus(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { status: true, name: true },
  });

  if (!product) {
    throw new Error('产品不存在');
  }

  if (product.status !== 'active') {
    throw new Error(`产品"${product.name}"已停用,无法进行库存操作`);
  }
}
```

### 问题2: 产品变体状态未检查

**位置**: 库存操作API

**问题描述**:

- 产品变体也有`active`/`inactive`状态
- 但库存操作时未检查变体状态
- `inactive`变体仍可入库出库

**风险**: ⚠️ 中等

**建议修复**:

```typescript
async function validateVariantStatus(variantId: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { status: true, colorCode: true },
  });

  if (!variant) {
    throw new Error('产品变体不存在');
  }

  if (variant.status !== 'active') {
    throw new Error(`变体"${variant.colorCode}"已停用,无法进行库存操作`);
  }
}
```

### 问题3: 产品删除检查不够全面

**位置**: `lib/api/handlers/products.ts` (行202-209)

**问题描述**:

```typescript
const hasRelatedData =
  product._count.inventory > 0 ||
  product._count.salesOrderItems > 0 ||
  product._count.inboundRecords > 0;
```

**缺少的检查**:

- ❌ 未检查`outboundRecords`(出库记录)
- ❌ 未检查`inventoryAdjustments`(库存调整记录)
- ❌ 未检查`batchSpecifications`(批次规格)
- ❌ 未检查`factoryShipmentOrderItems`(工厂发货单)
- ❌ 未检查`returnOrderItems`(退货单)

**风险**: ⚠️ 高

- 可能删除有历史记录的产品
- 导致数据完整性问题

**建议修复**:

```typescript
const hasRelatedData =
  product._count.inventory > 0 ||
  product._count.salesOrderItems > 0 ||
  product._count.inboundRecords > 0 ||
  product._count.outboundRecords > 0 ||
  product._count.inventoryAdjustments > 0 ||
  product._count.batchSpecifications > 0 ||
  product._count.factoryShipmentOrderItems > 0 ||
  product._count.returnOrderItems > 0;

if (hasRelatedData) {
  throw new Error('该产品存在关联记录,无法删除。如需停用请修改产品状态。');
}
```

### 问题4: 产品变体删除检查不完整

**位置**: `app/api/product-variants/[id]/route.ts` (行344-353)

**问题描述**:

```typescript
const hasInventory = existingVariant.inventory.some(inv => inv.quantity > 0);
```

**缺少的检查**:

- ❌ 未检查`inboundRecords`
- ❌ 未检查`outboundRecords`
- ❌ 未检查`inventoryAdjustments`
- ❌ 只检查了`quantity > 0`,未检查`reservedQuantity`

**风险**: ⚠️ 高

**建议修复**:

```typescript
// 检查库存(包括预留量)
const hasInventory = existingVariant.inventory.some(
  inv => inv.quantity > 0 || inv.reservedQuantity > 0
);

// 检查历史记录
const hasRecords = await prisma.$transaction([
  prisma.inboundRecord.count({ where: { variantId: id } }),
  prisma.outboundRecord.count({ where: { variantId: id } }),
  prisma.inventoryAdjustment.count({ where: { variantId: id } }),
]);

const totalRecords = hasRecords.reduce((sum, count) => sum + count, 0);

if (hasInventory || totalRecords > 0) {
  throw new Error('该变体有库存或历史记录,无法删除');
}
```

### 问题5: 缺少产品-库存一致性检查

**问题描述**:

- 没有定期检查产品和库存数据一致性的机制
- 可能出现孤儿库存记录(产品已删除但库存仍存在)
- 可能出现库存记录的productId指向不存在的产品

**风险**: ⚠️ 中等

**建议**:
创建数据一致性检查工具:

```typescript
// lib/utils/data-integrity-check.ts
export async function checkProductInventoryIntegrity() {
  // 1. 检查孤儿库存记录
  const orphanInventories = await prisma.$queryRaw`
    SELECT i.id, i.product_id
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE p.id IS NULL
  `;

  // 2. 检查孤儿变体库存
  const orphanVariantInventories = await prisma.$queryRaw`
    SELECT i.id, i.variant_id
    FROM inventory i
    WHERE i.variant_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_variants pv
      WHERE pv.id = i.variant_id
    )
  `;

  return {
    orphanInventories,
    orphanVariantInventories,
  };
}
```

### 问题6: 产品更新时未考虑库存影响

**位置**: 产品更新API

**问题描述**:

- 产品的`unit`(单位)和`piecesPerUnit`(每件片数)可以随意修改
- 但已有库存记录的数量单位可能不一致
- 没有警告或限制机制

**示例场景**:

1. 产品A: unit="piece", piecesPerUnit=100
2. 已有库存: 10件 = 1000片
3. 修改为: unit="sheet", piecesPerUnit=1
4. 库存数量含义完全改变!

**风险**: ⚠️ 严重

**建议修复**:

```typescript
// 在产品更新时检查
if (updateData.unit || updateData.piecesPerUnit) {
  const hasInventory = await prisma.inventory.count({
    where: {
      productId: id,
      quantity: { gt: 0 },
    },
  });

  if (hasInventory > 0) {
    throw new Error(
      '该产品已有库存记录,无法修改单位或每件片数。' +
        '如需修改,请先清空库存或联系管理员。'
    );
  }
}
```

### 问题7: 批量删除产品时的性能问题

**位置**: `app/api/products/batch/route.ts`

**问题描述**:

```typescript
const existingProducts = await prisma.product.findMany({
  where: { id: { in: ids } },
  include: {
    _count: {
      select: {
        variants: true,
        inventory: true,
        salesOrderItems: true,
        inboundRecords: true,
      },
    },
  },
});
```

**问题**:

- 批量操作时,每个产品都要查询关联计数
- 如果产品数量多(如100个),性能较差
- 没有批量大小限制

**风险**: ⚠️ 中等

**建议**:

```typescript
// 1. 限制批量大小
if (ids.length > 50) {
  return NextResponse.json(
    { success: false, error: '单次最多删除50个产品' },
    { status: 400 }
  );
}

// 2. 使用更高效的查询
const relatedCounts = await prisma.$queryRaw`
  SELECT
    p.id,
    COUNT(DISTINCT i.id) as inventory_count,
    COUNT(DISTINCT soi.id) as sales_order_items_count,
    COUNT(DISTINCT ir.id) as inbound_records_count
  FROM products p
  LEFT JOIN inventory i ON p.id = i.product_id
  LEFT JOIN sales_order_items soi ON p.id = soi.product_id
  LEFT JOIN inbound_records ir ON p.id = ir.product_id
  WHERE p.id IN (${Prisma.join(ids)})
  GROUP BY p.id
`;
```

### 问题8: 缺少库存操作的产品验证

**位置**: 入库/出库/调整API

**问题描述**:

- 入库时只验证产品是否存在
- 未验证产品和变体的匹配关系
- 可能出现变体ID属于其他产品的情况

**风险**: ⚠️ 中等

**建议修复**:

```typescript
async function validateProductVariantMatch(
  productId: string,
  variantId?: string
) {
  if (!variantId) return;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  });

  if (!variant) {
    throw new Error('产品变体不存在');
  }

  if (variant.productId !== productId) {
    throw new Error('产品变体不属于指定产品');
  }
}
```

---

## 📋 改进优先级

### 立即修复(1周内)

1. ✅ 产品删除检查补全(问题3)
2. ✅ 产品变体删除检查补全(问题4)
3. ✅ 产品更新时的单位检查(问题6)

### 短期改进(1个月内)

4. 产品/变体状态检查(问题1、2)
5. 产品-变体匹配验证(问题8)
6. 批量删除性能优化(问题7)

### 中期改进(3个月内)

7. 数据一致性检查工具(问题5)
8. 定期数据清理任务

---

## 🎯 建议的修复方案

### 方案1: 创建统一的验证工具

```typescript
// lib/utils/product-inventory-validators.ts

export class ProductInventoryValidator {
  // 验证产品状态
  static async validateProductStatus(productId: string): Promise<void> {
    // 实现...
  }

  // 验证变体状态
  static async validateVariantStatus(variantId: string): Promise<void> {
    // 实现...
  }

  // 验证产品-变体匹配
  static async validateProductVariantMatch(
    productId: string,
    variantId?: string
  ): Promise<void> {
    // 实现...
  }

  // 检查产品是否可删除
  static async canDeleteProduct(productId: string): Promise<{
    canDelete: boolean;
    reason?: string;
    relatedCounts: Record<string, number>;
  }> {
    // 实现...
  }

  // 检查变体是否可删除
  static async canDeleteVariant(variantId: string): Promise<{
    canDelete: boolean;
    reason?: string;
  }> {
    // 实现...
  }
}
```

### 方案2: 添加数据库约束

```prisma
// 确保外键约束正确
model Inventory {
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  variant ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Restrict)
}
```

### 方案3: 创建定期检查任务

```typescript
// lib/tasks/data-integrity-check.ts

export async function runDataIntegrityCheck() {
  const issues = await checkProductInventoryIntegrity();

  if (issues.orphanInventories.length > 0) {
    // 记录日志或发送告警
    console.error('发现孤儿库存记录:', issues.orphanInventories);
  }

  return issues;
}

// 可以通过cron job定期执行
```

---

## 📚 相关文档

- [库存潜在问题分析](./inventory-potential-issues.md)
- [性能优化文档](./performance-optimization.md)
- [ESLint规范指南](../.augment/rules/ESLint规范遵循指南.md)

---

**创建时间**: 2025-09-30
**审查人**: AI Agent
**下次审查**: 2025-10-30
