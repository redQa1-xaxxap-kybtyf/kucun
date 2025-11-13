# 客户直发业务场景分析报告

> 分析时间: 2025-01-13
> 分析目标: 客户直发（供应商直接发货给客户）业务场景的自动采购记录创建功能

---

## 📋 目录

- [1. 当前系统实现分析](#1-当前系统实现分析)
- [2. 业务需求分析](#2-业务需求分析)
- [3. 技术实施方案](#3-技术实施方案)
- [4. 实施步骤](#4-实施步骤)
- [5. 风险评估](#5-风险评估)

---

## 1. 当前系统实现分析

### 1.1 已实现的功能 ✅

#### 应付账款自动创建

**文件**: `lib/api/handlers/sales-orders/payable.ts`

系统已经实现了客户直发订单的应付账款自动创建功能：

```typescript
export const maybeCreatePayable = async (
  tx: Tx,
  data: CreateInput,
  costAmount: number,
  userId: string,
  salesOrder: { id: string; orderNumber: string }
) => {
  // ✅ 触发条件
  if (
    data.orderType !== 'TRANSFER' || // 必须是调货订单
    !data.supplierId || // 必须有供应商
    costAmount <= 0 || // 成本金额必须大于0
    data.status !== 'confirmed' // 订单状态必须是已确认
  ) {
    return;
  }

  // ✅ 创建应付账款记录
  await tx.payableRecord.create({
    data: {
      payableNumber: `PAY-${Date.now()}-${salesOrder.id.slice(-6)}`,
      supplierId: data.supplierId,
      userId,
      sourceType: 'sales_order', // 来源类型：销售订单
      sourceId: salesOrder.id,
      sourceNumber: salesOrder.orderNumber,
      payableAmount: costAmount, // 应付金额 = 成本金额
      remainingAmount: costAmount,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后到期
      status: 'pending',
      paymentTerms: '30天',
      description: `调货销售订单 ${salesOrder.orderNumber} 自动生成应付款`,
    },
  });
};
```

**调用位置**: `lib/api/handlers/sales-orders/create.ts:196-199`

```typescript
await maybeCreatePayable(tx, validatedData, financials.costAmount, userId, {
  id: salesOrder.id,
  orderNumber: salesOrder.orderNumber,
});
```

#### 库存预留逻辑

**文件**: `lib/api/handlers/sales-orders/inventory.ts`

系统已经正确处理了客户直发订单的库存预留逻辑：

```typescript
export const shouldReserveInventory = (
  data: CreateInput,
  transferMode: CreateInput['transferMode']
) =>
  data.status === 'confirmed' &&
  (data.orderType !== 'TRANSFER' || transferMode === 'MIXED');
// ✅ 客户直发订单 (TRANSFER + SUPPLIER_ONLY) 不预留库存
// ✅ 混合模式 (TRANSFER + MIXED) 预留本地库存部分
```

### 1.2 缺失的功能 ❌

#### ❌ 采购订单自动创建

**问题**: 当前系统在创建客户直发销售订单时，**没有自动创建对应的采购订单**。

**影响**:

1. **成本追溯困难**: 无法通过采购订单追溯成本来源
2. **供应商管理缺失**: 无法统计供应商的采购数据
3. **入库流程缺失**: 虽然客户直发不需要入库，但缺少采购记录会导致业务流程不完整
4. **财务对账困难**: 只有应付账款，没有采购订单，对账时缺少依据

#### ❌ 采购订单与销售订单的关联

**问题**: 数据库模型中，`PurchaseOrder` 和 `SalesOrder` 之间**没有直接的关联关系**。

**当前数据模型**:

```prisma
model PurchaseOrder {
  id              String   @id @default(uuid())
  orderNumber     String   @unique
  supplierId      String
  userId          String
  status          String   @default("draft")
  totalAmount     Float    @default(0)
  // ... 其他字段

  // ❌ 缺少 salesOrderId 字段
  // ❌ 无法关联到销售订单
}
```

**建议**: 需要添加 `salesOrderId` 字段来关联销售订单。

---

## 2. 业务需求分析

### 2.1 客户直发业务定义

**业务性质**: 销售 + 采购行为
**物流路径**: 供应商/工厂 → 客户（不经过我们的仓库）
**库存影响**: ❌ 不影响本地库存（不需要入库记录）
**订单类型**: `orderType = 'TRANSFER'` + `transferMode = 'SUPPLIER_ONLY'`

### 2.2 采购记录需求

#### 触发时机

**推荐**: 销售订单**确认时**（`status = 'confirmed'`）自动创建采购订单

**理由**:

- ✅ 订单确认表示客户已下单，需要向供应商采购
- ✅ 与应付账款创建时机一致（都在订单确认时）
- ✅ 避免草稿订单创建无效的采购记录

#### 数据来源

| 采购订单字段  | 数据来源                | 说明                          |
| ------------- | ----------------------- | ----------------------------- |
| `supplierId`  | `salesOrder.supplierId` | 销售订单的供应商ID            |
| `userId`      | `salesOrder.userId`     | 销售订单的创建人              |
| `status`      | `'confirmed'`           | 采购订单状态：已确认          |
| `totalAmount` | `salesOrder.costAmount` | 采购总金额 = 销售订单成本金额 |
| `orderDate`   | `new Date()`            | 采购订单日期 = 当前时间       |
| `remarks`     | 自动生成                | 关联销售订单信息              |

| 采购订单明细字段 | 数据来源                       | 说明               |
| ---------------- | ------------------------------ | ------------------ |
| `productId`      | `salesOrderItem.productId`     | 产品ID             |
| `supplierId`     | `salesOrderItem.supplierId`    | 明细级别的供应商ID |
| `productCode`    | `salesOrderItem.productCode`   | 产品编码           |
| `displayName`    | `salesOrderItem.displayName`   | 产品名称           |
| `specification`  | `salesOrderItem.specification` | 规格               |
| `unit`           | `salesOrderItem.unit`          | 单位               |
| `quantity`       | `salesOrderItem.quantity`      | 数量               |
| `unitPrice`      | `salesOrderItem.unitCost`      | 单价 = 成本价      |
| `totalPrice`     | `quantity × unitCost`          | 总价               |
| `batchNumber`    | `salesOrderItem.batchNumber`   | 批次号             |

#### 状态管理

**采购订单状态流转**:

```
confirmed (已确认) → shipped (已发货) → completed (已完成)
```

**初始状态**: `'confirmed'`（已确认）

**理由**:

- 客户直发订单确认后，采购订单也应该是确认状态
- 不需要经过草稿状态，因为是自动创建的
- 后续可以手动更新为 `shipped` 或 `completed`

### 2.3 数据验证需求

#### 必填字段验证

客户直发订单（`orderType = 'TRANSFER'` + `transferMode = 'SUPPLIER_ONLY'`）的必填字段：

1. **订单级别**:
   - ✅ `supplierId`: 供应商ID（必填）
   - ✅ `costAmount`: 成本金额（必填，且 > 0）

2. **明细级别**:
   - ✅ `supplierId`: 每个明细的供应商ID（必填）
   - ✅ `unitCost`: 每个明细的单位成本（必填，且 > 0）
   - ✅ `quantity`: 数量（必填，且 > 0）

#### 数据一致性验证

1. **供应商一致性**:
   - 订单级别的 `supplierId` 应该与所有明细的 `supplierId` 一致
   - 或者允许明细级别有不同的供应商（需要业务确认）

2. **成本金额一致性**:
   - `salesOrder.costAmount` 应该等于所有明细的 `costSubtotal` 之和
   - `costSubtotal = quantity × unitCost`

---

## 3. 技术实施方案

### 3.1 方案概述

**核心思路**: 在销售订单确认时，自动创建对应的采购订单和采购订单明细。

**实施位置**: `lib/api/handlers/sales-orders/create.ts`

**触发条件**:

```typescript
if (
  validatedData.orderType === 'TRANSFER' &&
  transferMode === 'SUPPLIER_ONLY' &&
  validatedData.status === 'confirmed' &&
  validatedData.supplierId &&
  financials.costAmount > 0
) {
  await createPurchaseOrderForTransfer(tx, validatedData, salesOrder, userId);
}
```

### 3.2 数据库模型修改（可选）

**建议**: 在 `PurchaseOrder` 模型中添加 `salesOrderId` 字段，用于关联销售订单。

```prisma
model PurchaseOrder {
  // ... 现有字段

  salesOrderId String? @map("sales_order_id") @db.Char(36)

  // 关系定义
  salesOrder SalesOrder? @relation(fields: [salesOrderId], references: [id], onDelete: SetNull, onUpdate: Cascade)

  @@index([salesOrderId], map: "idx_purchase_orders_sales_order")
}

model SalesOrder {
  // ... 现有字段

  // 关系定义
  purchaseOrders PurchaseOrder[]
}
```

**注意**: 这需要数据库迁移，可以作为后续优化项。

### 3.3 核心函数实现

#### 函数签名

```typescript
async function createPurchaseOrderForTransfer(
  tx: Tx,
  salesOrderData: CreateInput,
  salesOrder: { id: string; orderNumber: string },
  userId: string
): Promise<void>;
```

#### 实现逻辑

```typescript
import { generatePurchaseOrderNumber } from '@/lib/services/simple-order-number-generator';

async function createPurchaseOrderForTransfer(
  tx: Tx,
  salesOrderData: CreateInput,
  salesOrder: { id: string; orderNumber: string },
  userId: string
) {
  // 1. 生成采购订单号
  const orderNumber = await generatePurchaseOrderNumber(tx);

  // 2. 构建采购订单明细
  const items = salesOrderData.items.map(item => ({
    productId: item.productId,
    supplierId: item.supplierId || salesOrderData.supplierId!,
    productCode: item.productCode || '',
    displayName: item.displayName || item.manualProductName || '',
    specification: item.specification || item.manualSpecification,
    unit: item.unit || item.manualUnit || 'sheet',
    weight: item.weight || item.manualWeight,
    piecesPerUnit: item.piecesPerUnit,
    quantity: item.quantity,
    unitPrice: item.unitCost || 0,
    totalPrice: (item.quantity || 0) * (item.unitCost || 0),
    batchNumber: item.batchNumber,
    isManualProduct: item.isManualProduct,
    manualProductName: item.manualProductName,
    manualSpecification: item.manualSpecification,
    manualWeight: item.manualWeight,
    manualUnit: item.manualUnit,
    remarks: `关联销售订单: ${salesOrder.orderNumber}`,
  }));

  // 3. 创建采购订单
  await tx.purchaseOrder.create({
    data: {
      orderNumber,
      supplierId: salesOrderData.supplierId!,
      userId,
      status: 'confirmed',
      totalAmount: salesOrderData.costAmount || 0,
      orderDate: new Date(),
      remarks: `客户直发订单自动生成\n关联销售订单: ${salesOrder.orderNumber}\n客户: ${salesOrderData.customerId}`,
      items: {
        create: items,
      },
    },
  });
}
```

### 3.4 错误处理

```typescript
try {
  await createPurchaseOrderForTransfer(tx, validatedData, salesOrder, userId);
} catch (error) {
  logger.error('sales-orders', '创建采购订单失败', error, {
    salesOrderId: salesOrder.id,
    salesOrderNumber: salesOrder.orderNumber,
  });
  // ❌ 不要抛出错误，避免影响销售订单创建
  // ✅ 记录日志，后续可以手动补创建
}
```

**注意**: 采购订单创建失败不应该影响销售订单的创建，因为应付账款已经创建了。

---

## 4. 实施步骤

### 步骤1: 创建采购订单生成函数 ✅

**文件**: `lib/api/handlers/sales-orders/purchase-order.ts`（新建）

**内容**: 实现 `createPurchaseOrderForTransfer` 函数

**预估工作量**: 2小时

### 步骤2: 集成到销售订单创建流程 ✅

**文件**: `lib/api/handlers/sales-orders/create.ts`

**修改位置**: 在 `maybeCreatePayable` 之后调用

**预估工作量**: 1小时

### 步骤3: 添加数据验证 ✅

**文件**: `lib/validations/sales-order.ts`

**验证规则**:

- 客户直发订单必须有 `supplierId`
- 客户直发订单的每个明细必须有 `unitCost`

**预估工作量**: 1小时

### 步骤4: 测试验证 ✅

**测试场景**:

1. 创建客户直发订单（`TRANSFER` + `SUPPLIER_ONLY`）
2. 验证采购订单是否自动创建
3. 验证采购订单明细是否正确
4. 验证应付账款是否正确创建

**预估工作量**: 2小时

### 步骤5: 数据库迁移（可选）✅

**文件**: `prisma/migrations/xxx_add_sales_order_id_to_purchase_orders.sql`

**内容**: 添加 `salesOrderId` 字段到 `PurchaseOrder` 表

**预估工作量**: 1小时

---

## 5. 风险评估

### 5.1 技术风险

| 风险             | 影响 | 概率 | 缓解措施                                 |
| ---------------- | ---- | ---- | ---------------------------------------- |
| 采购订单创建失败 | 中   | 低   | 使用 try-catch，不影响销售订单创建       |
| 数据不一致       | 高   | 低   | 使用数据库事务，确保原子性               |
| 性能影响         | 低   | 低   | 采购订单创建在同一事务中，性能影响可忽略 |

### 5.2 业务风险

| 风险             | 影响 | 概率 | 缓解措施                         |
| ---------------- | ---- | ---- | -------------------------------- |
| 供应商信息缺失   | 高   | 中   | 添加前端验证，确保必填字段       |
| 成本信息不准确   | 高   | 中   | 添加数据验证，确保成本金额一致性 |
| 重复创建采购订单 | 中   | 低   | 检查是否已存在关联的采购订单     |

---

## 6. 总结

### 6.1 当前状态

- ✅ **应付账款**: 已实现自动创建
- ✅ **库存预留**: 已正确处理（客户直发不预留库存）
- ❌ **采购订单**: 未实现自动创建

### 6.2 推荐方案

**短期方案**（1天）:

1. 创建 `createPurchaseOrderForTransfer` 函数
2. 集成到销售订单创建流程
3. 添加基本的数据验证
4. 测试验证

**长期方案**（2-3天）:

1. 添加 `salesOrderId` 字段到 `PurchaseOrder` 模型
2. 完善数据验证规则
3. 添加采购订单状态同步逻辑
4. 完善错误处理和日志记录

### 6.3 预期收益

- ✅ **成本追溯**: 可以通过采购订单追溯成本来源
- ✅ **供应商管理**: 可以统计供应商的采购数据
- ✅ **财务对账**: 有采购订单作为对账依据
- ✅ **业务完整性**: 销售和采购流程完整闭环

---

**最后更新**: 2025-01-13
**维护者**: Augment Agent
**版本**: 1.0.0
