# 销售订单模块潜在问题分析

## 🔍 深度分析结果

本文档详细记录了销售订单模块的潜在问题、性能瓶颈和改进建议。

---

## ✅ 已做得好的地方

### 1. 状态流转控制完善

**状态流转规则** (`app/api/sales-orders/[id]/route.ts`):

```typescript
const validStatusTransitions: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [], // 已完成的订单不能再变更状态
  cancelled: [], // 已取消的订单不能再变更状态
};
```

### 2. 事务保证数据一致性

所有涉及库存的操作都使用了事务。

### 3. 订单号生成机制

使用数据库序列表保证并发安全。

---

## 🚨 发现的潜在问题

### 问题1: 缺少销售订单缓存策略 ⚠️ 高

**位置**: `app/api/sales-orders/route.ts`

**问题描述**:

- 销售订单列表查询没有使用Redis缓存
- 每次请求都直接查询数据库
- 包含大量关联查询(customer, user, supplier, items, product)

**对比**: 库存和产品模块都有完善的缓存策略

**性能影响**:

```typescript
// 当前实现 - 无缓存
const [orders, total] = await Promise.all([
  prisma.salesOrder.findMany({
    where,
    include: {
      customer: {...},
      user: {...},
      supplier: {...},
      items: {
        include: {
          product: {...}
        }
      },
      _count: {...}
    }
  }),
  prisma.salesOrder.count({ where }),
]);
```

**风险**: ⚠️ 高

- 高并发时数据库压力大
- 响应时间慢
- 用户体验差

**建议修复**:

```typescript
// 使用Redis缓存
const cacheKey = buildCacheKey('sales-orders:list', queryParams);

const cached = await getOrSetJSON(
  cacheKey,
  async () => {
    const [orders, total] = await Promise.all([...]);
    return { data: orders, pagination: {...} };
  },
  cacheConfig.salesOrderTtl // 5分钟
);
```

### 问题2: 订单状态变更未使用幂等性保护 ⚠️ 严重

**位置**: `app/api/sales-orders/[id]/route.ts` (PUT方法)

**问题描述**:

- 订单状态变更没有幂等性键
- 重复请求可能导致重复扣减库存
- 没有操作记录追踪

**风险场景**:

```
1. 用户点击"确认发货"
2. 网络延迟,用户再次点击
3. 两个请求同时到达
4. 库存被扣减两次 ❌
```

**风险**: ⚠️ 严重

**建议修复**:

```typescript
// 使用幂等性包装器
import { withIdempotency } from '@/lib/utils/idempotency';

export async function PUT(request: NextRequest, { params }) {
  const body = await request.json();
  const { idempotencyKey, status, remarks } = body;

  if (!idempotencyKey) {
    return NextResponse.json(
      { success: false, error: '缺少幂等性键' },
      { status: 400 }
    );
  }

  const result = await withIdempotency(
    idempotencyKey,
    'sales_order_status_change',
    id,
    session.user.id,
    { status, remarks },
    async () => {
      // 执行状态变更逻辑
      return await updateOrderStatus(id, status, remarks);
    }
  );

  return NextResponse.json({ success: true, data: result });
}
```

### 问题3: 库存扣减未使用乐观锁 ⚠️ 严重

**位置**: `app/api/sales-orders/[id]/route.ts` (行263-276)

**问题描述**:

```typescript
// 当前实现 - 无并发保护
await tx.inventory.update({
  where: { id: inventory.id },
  data: {
    quantity: inventory.quantity - item.quantity,
    reservedQuantity: Math.max(0, Math.min(...))
  },
});
```

**风险**: ⚠️ 严重

- 并发订单可能导致超卖
- 没有使用乐观锁机制

**建议修复**:

```typescript
// 使用乐观锁
const updatedCount = await tx.inventory.updateMany({
  where: {
    id: inventory.id,
    quantity: { gte: item.quantity }, // 确保库存足够
  },
  data: {
    quantity: { decrement: item.quantity },
    reservedQuantity: Math.max(0, Math.min(...))
  },
});

if (updatedCount.count === 0) {
  throw new Error('库存不足或已被其他订单占用,请重试');
}
```

### 问题4: 订单创建时未预留库存 ⚠️ 高

**位置**: `lib/api/handlers/sales-orders.ts` (createSalesOrder函数)

**问题描述**:

- 订单创建(draft/confirmed状态)时不预留库存
- 只在发货时才扣减库存
- 可能导致超卖

**业务流程问题**:

```
1. 客户A创建订单: 产品X 100件 (库存100件)
2. 客户B创建订单: 产品X 100件 (库存仍显示100件)
3. 两个订单都确认
4. 发货时发现库存不足 ❌
```

**风险**: ⚠️ 高

**建议修复**:

```typescript
// 订单确认时预留库存
if (status === 'confirmed') {
  for (const item of order.items) {
    const inventory = await tx.inventory.findFirst({
      where: {
        productId: item.productId,
        variantId: item.variantId,
        batchNumber: item.batchNumber,
      },
    });

    if (!inventory) {
      throw new Error(`产品 ${item.product.name} 库存记录不存在`);
    }

    const availableQuantity = inventory.quantity - inventory.reservedQuantity;
    if (availableQuantity < item.quantity) {
      throw new Error(`产品 ${item.product.name} 可用库存不足`);
    }

    // 增加预留量
    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        reservedQuantity: { increment: item.quantity },
      },
    });
  }
}
```

### 问题5: 订单取消时预留库存释放不完整 ⚠️ 中等

**位置**: `app/api/sales-orders/[id]/route.ts` (行294-342)

**问题描述**:

```typescript
// 当前实现
if (shouldReleaseReservedInventory) {
  // 释放预留库存的逻辑
  for (const item of existingOrder.items) {
    const inventory = await tx.inventory.findFirst({...});
    if (inventory && inventory.reservedQuantity > 0) {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedQuantity: Math.max(
            0,
            inventory.reservedQuantity - item.quantity
          ),
        },
      });
    }
  }
}
```

**问题**:

- 只在`confirmed`状态取消时释放预留
- 如果订单在`shipped`状态取消,不会恢复库存
- 缺少操作记录

**风险**: ⚠️ 中等

**建议**: 完善所有状态的取消逻辑

### 问题6: 订单列表查询性能问题 ⚠️ 高

**位置**: `lib/api/handlers/sales-orders.ts` (getSalesOrders函数)

**问题描述**:

```typescript
// 每个订单都包含完整的items和product信息
include: {
  customer: {...},
  user: {...},
  supplier: {...},
  items: {
    include: {
      product: {...}
    }
  },
  _count: {...}
}
```

**性能问题**:

- N+1查询问题
- 列表页不需要完整的items详情
- 数据传输量大

**建议优化**:

```typescript
// 列表页只返回汇总信息
select: {
  id: true,
  orderNumber: true,
  customerId: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  customer: {
    select: { id: true, name: true }
  },
  _count: {
    select: { items: true }
  }
}

// 详情页才返回完整items
```

### 问题7: 缺少订单操作审计日志 ⚠️ 中等

**问题描述**:

- 订单状态变更没有审计记录
- 无法追溯谁在什么时间做了什么操作
- 出问题时难以排查

**建议**:
创建`SalesOrderAuditLog`表:

```prisma
model SalesOrderAuditLog {
  id            String   @id @default(uuid())
  salesOrderId  String   @map("sales_order_id")
  operationType String   @map("operation_type") // create, update_status, cancel, etc.
  oldStatus     String?  @map("old_status")
  newStatus     String?  @map("new_status")
  operatorId    String   @map("operator_id")
  remarks       String?
  createdAt     DateTime @default(now()) @map("created_at")

  salesOrder SalesOrder @relation(fields: [salesOrderId], references: [id])
  operator   User       @relation(fields: [operatorId], references: [id])

  @@index([salesOrderId])
  @@index([operatorId])
  @@index([createdAt])
  @@map("sales_order_audit_logs")
}
```

### 问题8: 订单项目缺少变体和批次信息 ⚠️ 中等

**位置**: `prisma/schema.prisma` (SalesOrderItem模型)

**问题描述**:

```prisma
model SalesOrderItem {
  productId      String?    @map("product_id")
  colorCode      String?    @map("color_code")
  // ❌ 缺少 variantId
  // ❌ 缺少 batchNumber
}
```

**影响**:

- 无法准确追踪销售的是哪个变体
- 无法追踪销售的是哪个批次
- 库存扣减时需要额外查询

**建议修复**:

```prisma
model SalesOrderItem {
  productId      String?    @map("product_id")
  variantId      String?    @map("variant_id")
  batchNumber    String?    @map("batch_number")
  colorCode      String?    @map("color_code")

  variant ProductVariant? @relation(fields: [variantId], references: [id])
}
```

### 问题9: 调货销售应付款创建时机不一致 ⚠️ 中等

**位置**:

- `lib/api/handlers/sales-orders.ts` (创建时生成)
- `app/api/sales-orders/[id]/route.ts` (确认时生成)

**问题描述**:

- 两个地方都有创建应付款的逻辑
- 可能导致重复创建
- 逻辑不统一

**建议**: 统一在订单确认时创建应付款

### 问题10: 缺少订单金额计算验证 ⚠️ 中等

**位置**: `lib/api/handlers/sales-orders.ts` (createSalesOrder函数)

**问题描述**:

```typescript
// 前端传入的金额直接使用,未验证
for (const item of validatedData.items) {
  totalAmount += item.subtotal || 0;
  costAmount += (item.unitCost || 0) * item.quantity;
}
```

**风险**:

- 前端可能被篡改
- 金额计算错误
- 财务数据不准确

**建议修复**:

```typescript
// 服务器端重新计算并验证
for (const item of validatedData.items) {
  const calculatedSubtotal = item.unitPrice * item.quantity;

  if (Math.abs(calculatedSubtotal - item.subtotal) > 0.01) {
    throw new Error(`订单项金额计算错误: ${item.productId}`);
  }

  totalAmount += calculatedSubtotal;
}
```

---

## 📋 改进优先级

### 立即修复(1周内) - 严重

1. ✅ 订单状态变更幂等性保护(问题2)
2. ✅ 库存扣减乐观锁(问题3)
3. ✅ 订单确认时预留库存(问题4)

### 短期改进(1个月内) - 高优先级

4. 销售订单缓存策略(问题1)
5. 订单列表查询优化(问题6)
6. 订单金额计算验证(问题10)

### 中期改进(3个月内) - 中优先级

7. 订单操作审计日志(问题7)
8. 订单项目添加变体和批次(问题8)
9. 统一应付款创建逻辑(问题9)
10. 完善订单取消逻辑(问题5)

---

## 🎯 性能优化建议

### 1. 实现销售订单缓存

```typescript
// lib/cache/sales-order-cache.ts
export async function getCachedSalesOrders(
  params: SalesOrderQueryParams
): Promise<PaginatedResponse<SalesOrder> | null> {
  const cacheKey = buildCacheKey('sales-orders:list', params);
  return getOrSetJSON(
    cacheKey,
    async () => {
      return await getSalesOrders(params);
    },
    cacheConfig.salesOrderTtl
  );
}

export async function invalidateSalesOrderCache(orderId?: string) {
  if (orderId) {
    await invalidateNamespace(`sales-orders:detail:${orderId}`);
  }
  await invalidateNamespace('sales-orders:list:*');
}
```

### 2. 优化列表查询

```typescript
// 使用select代替include,减少数据传输
select: {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  customer: {
    select: { id: true, name: true }
  },
  _count: {
    select: { items: true }
  }
}
```

### 3. 添加数据库索引

```prisma
model SalesOrder {
  @@index([status, createdAt(sort: Desc)])
  @@index([customerId, status])
  @@index([orderType, status])
}
```

---

## 📚 相关文档

- [库存潜在问题分析](./inventory-potential-issues.md)
- [产品库存交互问题](./product-inventory-interaction-issues.md)
- [性能优化文档](./performance-optimization.md)

---

**创建时间**: 2025-09-30
**审查人**: AI Agent
**下次审查**: 2025-10-30
