# 瓷砖行业ERP系统业务流程完整性评估报告

**评估日期**: 2025-11-10  
**评估版本**: 基于财务核算方案设计文档 v2.0  
**评估范围**: 核心业务流程完整性与合理性

> **重要说明**: 本报告基于对现有代码库和财务核算方案设计文档v2.0的深入分析。
>
> - **色号管理**: 通过 `ProductVariant`（产品变体）实现，每个变体有独立的 `colorCode` 字段
> - **批次管理**: 批次号格式为 `{产品编码}-{日期YYYYMMDD}-{序号}`（例如：`TILE001-20251021-001`）
> - **库存记录**: 同时包含 `variantId`（色号）和 `batchNumber`（批次），实现批次+色号双重管理

---

## 📊 执行摘要

### 总体完整性评分

**综合得分**: **82/100**

| 维度     | 得分   | 说明                                 |
| -------- | ------ | ------------------------------------ |
| 入库流程 | 85/100 | 基础功能完善，缺少运费分摊和质检流程 |
| 出库流程 | 78/100 | 基础功能完善，缺少FIFO出库和样品管理 |
| 销售流程 | 80/100 | 核心功能完整，缺少信用额度控制       |
| 采购流程 | 82/100 | 流程完整，缺少运费分摊到成本         |
| 退货流程 | 70/100 | 基础功能完整，缺少批次追溯和成本调整 |
| 费用管理 | 65/100 | 费用记录完整，分摊算法不完善         |
| 库存管理 | 92/100 | 盘点流程完善，批次和变体管理完备     |

### 主要发现

#### ✅ 优势（6项）

1. **批次+色号双重管理完善** - 通过 `variantId` 和 `batchNumber` 实现批次和色号的独立管理
2. **产品变体系统完整** - `ProductVariant` 表支持色号、色名、SKU管理，支持批量创建变体
3. **库存盘点流程完整** - 盘点计划、执行、差异分析、审批调整全流程实现
4. **成本核算方法正确** - 使用加权平均法，计算逻辑准确
5. **幂等性保护完善** - 所有关键操作都有幂等性保护，避免重复提交
6. **厂家发货费用分摊** - 已实现按货值、重量、数量、归属的多种分摊方式

#### ⚠️ 关键风险（4项）

1. **运费未分摊到单位成本** - 采购运费、销售运费未计入产品成本，影响毛利计算准确性
2. **质检流程缺失** - 入库时无质检环节，破损商品无专门处理流程
3. **样品管理缺失** - 无样品出库、样品费用归集和分摊机制
4. **信用额度控制缺失** - 销售订单创建时未检查客户信用额度和欠款情况

#### 🎯 优先建议（4项）

1. **🔴 立即实施**: 实现采购运费分摊到单位成本（影响成本核算准确性）
2. **🔴 立即实施**: 实现FIFO出库逻辑（避免库存积压，符合行业惯例）
3. **🟡 近期实施**: 添加质检流程和破损处理（减少损失，提高质量）
4. **🟡 近期实施**: 实现样品管理和费用分摊（完善费用核算）

---

## 📋 详细评估表

### 1. 入库流程

| 子流程       | 实现状态    | 完整性评分 | 主要问题                                                  | 改进建议                                                          | 优先级 |
| ------------ | ----------- | ---------- | --------------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| **采购入库** | ✅ 已实现   | 85/100     | 1. 运费未分摊到成本<br>2. 无质检环节<br>3. 破损处理不完善 | 1. 实现运费分摊算法<br>2. 添加质检状态字段<br>3. 添加破损数量记录 | 🔴 高  |
| **退货入库** | ✅ 已实现   | 80/100     | 1. 成本调整逻辑不完善<br>2. 未按原批次入库                | 1. 完善退货成本计算<br>2. 记录原批次信息                          | 🟡 中  |
| **调拨入库** | 🟡 部分实现 | 60/100     | 1. 无专门的调拨单<br>2. 使用通用入库reason                | 1. 创建调拨单模型<br>2. 关联调拨出库                              | 🟢 低  |
| **盘盈入库** | ✅ 已实现   | 90/100     | 1. 成本确定方式单一                                       | 1. 提供多种成本确定方法                                           | 🟢 低  |
| **期初入库** | ✅ 已设计   | 95/100     | 1. Excel导入功能未实现                                    | 1. 开发Excel导入API<br>2. 开发前端导入界面                        | 🔴 高  |

**代码证据**:

```typescript
// app/api/inventory/inbound/route.ts
// ✅ 入库API已实现，支持批次号、变体ID、单位成本
const inboundRecord = await executeMinimalInboundTransaction({
  productId: validatedData.productId,
  variantId: validatedData.variantId, // ✅ 支持产品变体（色号）
  quantity: validatedData.quantity,
  unitCost: validatedData.unitCost, // ✅ 支持单位成本
  reason: validatedData.reason,
  batchNumber, // ✅ 支持批次号
  userId: context.user.id,
});
```

**缺失功能**:

- ❌ **运费分摊**: 采购100箱瓷砖，单价50元，运费5000元，应分摊后成本=100元/箱，但当前只记录50元
- ❌ **质检流程**: 无质检状态（待检、合格、不合格），无质检人员、质检时间记录
- ❌ **破损处理**: 无破损数量字段，无法将破损成本分摊到完好产品

---

### 2. 出库流程

| 子流程       | 实现状态    | 完整性评分 | 主要问题                               | 改进建议                                 | 优先级 |
| ------------ | ----------- | ---------- | -------------------------------------- | ---------------------------------------- | ------ |
| **销售出库** | ✅ 已实现   | 85/100     | 1. 未实现FIFO出库                      | 1. 实现批次FIFO逻辑                      | 🔴 高  |
| **样品出库** | ❌ 未实现   | 0/100      | 1. 无样品出库类型<br>2. 无样品费用记录 | 1. 添加sample出库原因<br>2. 关联费用记录 | 🟡 中  |
| **破损出库** | 🟡 部分实现 | 50/100     | 1. 无破损审批流程<br>2. 成本核销不完整 | 1. 添加审批状态<br>2. 完善成本核销逻辑   | 🟡 中  |
| **调拨出库** | 🟡 部分实现 | 60/100     | 1. 无专门的调拨单                      | 1. 创建调拨单模型                        | 🟢 低  |
| **盘亏出库** | ✅ 已实现   | 90/100     | 1. 通过库存调整实现                    | 无                                       | -      |

**代码证据**:

```typescript
// app/api/inventory/outbound/route.ts
// ✅ 出库API已实现，但未实现FIFO逻辑
const result = await withIdempotency(
  idempotencyKey,
  'outbound',
  productId,
  user.id,
  validatedData,
  async () => await executeOutboundTransaction(validatedData, user.id)
);
```

**缺失功能**:

- ❌ **FIFO出库**: 瓷砖行业要求先进先出，避免库存积压，但当前出库未按批次时间排序
- ❌ **样品管理**: 无样品出库类型，无法统计样品成本和费用
- ❌ **变体匹配**: 出库时未严格检查变体ID（色号）是否匹配

---

### 3. 销售流程

| 子流程       | 实现状态    | 完整性评分 | 主要问题            | 改进建议                             | 优先级 |
| ------------ | ----------- | ---------- | ------------------- | ------------------------------------ | ------ |
| **销售订单** | ✅ 已实现   | 90/100     | 1. 无信用额度检查   | 1. 添加信用额度控制                  | 🟡 中  |
| **发货**     | ✅ 已实现   | 85/100     | 1. 运费处理不明确   | 1. 明确运费承担方<br>2. 记录运费金额 | 🟡 中  |
| **开票**     | 🟡 部分实现 | 70/100     | 1. 无专门的发票管理 | 1. 创建发票模型<br>2. 关联销售订单   | 🟢 低  |
| **收款**     | ✅ 已实现   | 95/100     | 1. 功能完善         | 无                                   | -      |

**代码证据**:

```typescript
// app/actions/sales-orders.ts
// ✅ 销售订单创建已实现，支持费用项
const order = await tx.salesOrder.create({
  data: {
    orderNumber,
    customerId: data.customerId,
    totalAmount,
    costAmount,
    profitAmount,
    items: { create: data.items.map(item => ({...})) },
  },
});

// ✅ 已实现库存扣减
if (data.status === 'confirmed') {
  for (const item of data.items) {
    await tx.inventory.updateMany({
      where: { productId: item.productId },
      data: { quantity: { decrement: item.quantity } },
    });
  }
}
```

**缺失功能**:

- ❌ **信用额度控制**: 创建订单时未检查客户欠款和信用额度，存在坏账风险
- ❌ **运费管理**: 销售运费未单独记录，无法区分客户承担还是公司承担

---

### 4. 采购流程

| 子流程       | 实现状态    | 完整性评分 | 主要问题                             | 改进建议                               | 优先级 |
| ------------ | ----------- | ---------- | ------------------------------------ | -------------------------------------- | ------ |
| **采购申请** | ❌ 未实现   | 0/100      | 1. 无采购申请单<br>2. 无库存预警触发 | 1. 创建采购申请模型<br>2. 实现库存预警 | 🟢 低  |
| **采购订单** | ✅ 已实现   | 90/100     | 1. 功能完善                          | 无                                     | -      |
| **收货**     | ✅ 已实现   | 85/100     | 1. 运费未分摊到成本                  | 1. 实现运费分摊算法                    | 🔴 高  |
| **对账**     | 🟡 部分实现 | 70/100     | 1. 无专门的对账功能                  | 1. 开发对账界面<br>2. 支持批量对账     | 🟡 中  |
| **付款**     | ✅ 已实现   | 95/100     | 1. 功能完善                          | 无                                     | -      |

**代码证据**:

```typescript
// app/actions/purchase-orders.ts
// ✅ 采购订单创建已实现，支持费用项
const order = await tx.purchaseOrder.create({
  data: {
    orderNumber,
    supplierId: data.supplierId,
    totalAmount,
    expenseAmount, // ✅ 支持费用金额
    items: { create: items.map(item => ({...})) },
  },
});
```

**缺失功能**:

- ❌ **运费分摊到成本**: 采购费用已记录，但未分摊到入库单位成本，导致成本核算不准确
- ❌ **采购申请**: 无采购申请单，无法追溯采购需求来源
- ❌ **库存预警**: 无自动预警机制，无法及时发现缺货

---

### 5. 退货流程

| 子流程       | 实现状态  | 完整性评分 | 主要问题                                                    | 改进建议                                                      | 优先级 |
| ------------ | --------- | ---------- | ----------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| **销售退货** | ✅ 已实现 | 75/100     | 1. 未按原批次入库<br>2. 成本调整不完善<br>3. 运费处理不明确 | 1. 记录原批次信息<br>2. 完善成本调整逻辑<br>3. 明确运费承担方 | 🟡 中  |
| **采购退货** | ❌ 未实现 | 0/100      | 1. 无采购退货功能                                           | 1. 创建采购退货模型<br>2. 实现退货出库<br>3. 应付冲减         | 🟡 中  |

**代码证据**:

```typescript
// app/actions/return-orders.ts
// ✅ 销售退货已实现
const result = await createReturnOrderTx(
  tx,
  {
    salesOrderId: data.salesOrderId,
    customerId: data.customerId,
    type: data.type,
    processType: data.processType, // refund | exchange
    items: data.items,
  },
  returnNumber,
  totalAmount
);

// ✅ 退货完成时自动入库
if (data.status === 'completed') {
  inboundResults = await applyCompletionEffects(
    tx,
    {
      returnNumber: returnOrder.returnNumber,
      items: returnOrder.items,
    },
    session.user.id
  );
}
```

**缺失功能**:

- ❌ **原批次追溯**: 退货时未记录原销售订单的批次号和变体ID，无法按原批次入库
- ❌ **成本调整**: 退货入库时使用当前成本，而非原销售成本，影响毛利计算
- ❌ **采购退货**: 完全缺失采购退货功能，无法处理质量问题退货

---

### 6. 费用管理流程

| 子流程       | 实现状态    | 完整性评分 | 主要问题                                 | 改进建议                                    | 优先级 |
| ------------ | ----------- | ---------- | ---------------------------------------- | ------------------------------------------- | ------ |
| **运费管理** | 🟡 部分实现 | 60/100     | 1. 运费未分摊到成本<br>2. 运费类型不明确 | 1. 实现运费分摊算法<br>2. 区分采购/销售运费 | 🔴 高  |
| **样品费用** | ❌ 未实现   | 0/100      | 1. 无样品费用归集<br>2. 无样品费用分摊   | 1. 创建样品费用类型<br>2. 实现费用分摊      | 🟡 中  |
| **破损费用** | 🟡 部分实现 | 50/100     | 1. 破损成本核销不完整                    | 1. 完善破损成本核销                         | 🟡 中  |
| **其他费用** | ✅ 已实现   | 85/100     | 1. 费用记录完善                          | 无                                          | -      |

**代码证据**:

```typescript
// lib/services/factory-shipment-expense-service.ts
// ✅ 厂家发货费用分摊已实现（按货值、重量、数量、归属）
export function allocateExpensesByValue(
  items: FactoryShipmentOrderItem[],
  totalExpenses: number
): Map<string, number> {
  const totalValue = calculateTotalValue(items);
  items.forEach(item => {
    const ratio = item.totalPrice / totalValue;
    const allocated = roundToTwoDecimals(totalExpenses * ratio);
    allocations.set(item.id, allocated);
  });
  return adjustAllocationForRoundingError(allocations, totalExpenses);
}
```

**缺失功能**:

- ❌ **采购运费分摊**: 厂家发货有费用分摊，但采购入库的运费未分摊到单位成本
- ❌ **样品费用管理**: 无样品费用归集和分摊机制
- ❌ **月末费用分摊**: 无定期费用分摊功能（如仓储费、管理费）

---

### 7. 库存管理流程

| 子流程               | 实现状态  | 完整性评分 | 主要问题                             | 改进建议                                 | 优先级 |
| -------------------- | --------- | ---------- | ------------------------------------ | ---------------------------------------- | ------ |
| **库存盘点**         | ✅ 已实现 | 95/100     | 1. 功能完善                          | 无                                       | -      |
| **批次管理**         | ✅ 已实现 | 90/100     | 1. 批次FIFO未实现                    | 1. 实现FIFO出库逻辑                      | 🔴 高  |
| **变体管理（色号）** | ✅ 已实现 | 95/100     | 1. 功能完善                          | 无                                       | -      |
| **库存预警**         | ❌ 未实现 | 0/100      | 1. 无库存上下限设置<br>2. 无自动预警 | 1. 添加库存上下限字段<br>2. 实现预警机制 | 🟡 中  |

**代码证据**:

```typescript
// lib/services/inventory-count-service.ts
// ✅ 库存盘点流程完整
export async function createInventoryCount(
  data: CreateInventoryCountRequest,
  userId: string
): Promise<InventoryCount> {
  const count = await prisma.$transaction(async tx => {
    const countNumber = await generateCountNumber(tx);
    const createdCount = await tx.inventoryCount.create({
      data: {
        countNumber,
        countName: data.countName,
        countType: data.countType,
        status: 'draft',
        planDate: new Date(data.planDate),
        // ...
      },
    });
    return createdCount;
  });
  return count;
}
```

**数据库证据**:

```prisma
// prisma/schema.prisma
model Inventory {
  id               String   @id @default(uuid())
  productId        String   @map("product_id")
  variantId        String?  @map("variant_id")  // ✅ 支持产品变体（色号）
  batchNumber      String?  @map("batch_number") // ✅ 支持批次号
  quantity         Int      @default(0)
  reservedQuantity Int      @default(0)
  unitCost         Float?   @map("unit_cost")    // ✅ 支持单位成本
  location         String?

  // ❌ 缺少库存上下限字段
}

model ProductVariant {
  id         String   @id @default(uuid())
  productId  String   @map("product_id")
  colorCode  String   @map("color_code")  // ✅ 色号
  colorName  String?  @map("color_name")  // ✅ 色名
  colorValue String?  @map("color_value") // ✅ 色值
  sku        String   @unique             // ✅ SKU
  status     String   @default("active")
  // ✅ 支持批量创建变体
}
```

**优势功能**:

- ✅ **批次+变体双重管理**: `Inventory` 表同时包含 `variantId` 和 `batchNumber`，实现批次和色号的独立管理
- ✅ **产品变体系统**: `ProductVariant` 表支持色号、色名、色值、SKU管理
- ✅ **批量创建变体**: 支持批量创建产品变体，提高效率
- ✅ **库存盘点完整**: 盘点计划、执行、差异分析、审批调整全流程实现

**缺失功能**:

- ❌ **FIFO出库**: 出库时未按批次时间排序，可能导致库存积压
- ❌ **库存预警**: 无库存上下限设置，无法自动预警缺货或积压

---

## 📝 缺失功能清单（按优先级排序）

### 🔴 立即实施（1-2周内完成）

#### 1. 采购运费分摊到单位成本

**业务价值**: 确保成本核算准确，影响毛利计算和定价决策

**实施方案**:

```typescript
// 1. 扩展InboundRecord表
model InboundRecord {
  // ... 现有字段
  freightAmount Float? @map("freight_amount") // 分摊的运费金额
  freightRatio  Float? @map("freight_ratio")  // 运费分摊比例
}

// 2. 实现运费分摊算法
export function allocateFreightToCost(
  purchasePrice: number,
  quantity: number,
  totalFreight: number,
  totalQuantity: number
): number {
  const freightPerUnit = totalFreight / totalQuantity;
  return purchasePrice + freightPerUnit;
}

// 3. 入库时计算分摊后成本
const unitCostWithFreight = allocateFreightToCost(
  item.unitPrice,
  item.quantity,
  purchaseOrder.freightAmount,
  purchaseOrder.totalQuantity
);
```

**工作量**: 3-4天

---

#### 2. 实现FIFO出库逻辑

**业务价值**: 避免库存积压，减少损失，符合瓷砖行业惯例

**实施方案**:

```typescript
// 1. 出库时按批次时间排序
export async function selectInventoryForOutbound(
  productId: string,
  variantId: string | undefined,
  requiredQuantity: number
): Promise<InventoryAllocation[]> {
  const inventories = await prisma.inventory.findMany({
    where: {
      productId,
      variantId,
      quantity: { gt: 0 },
    },
    orderBy: [
      { createdAt: 'asc' }, // FIFO: 先进先出
      { batchNumber: 'asc' },
    ],
  });

  // 分配库存
  const allocations: InventoryAllocation[] = [];
  let remaining = requiredQuantity;

  for (const inv of inventories) {
    if (remaining <= 0) break;

    const allocated = Math.min(inv.quantity, remaining);
    allocations.push({
      inventoryId: inv.id,
      batchNumber: inv.batchNumber,
      variantId: inv.variantId,
      quantity: allocated,
      unitCost: inv.unitCost,
    });

    remaining -= allocated;
  }

  if (remaining > 0) {
    throw new Error(`库存不足，还需${remaining}件`);
  }

  return allocations;
}
```

**工作量**: 4-5天

---

### 🟡 近期实施（1-2个月内完成）

#### 3. 添加质检流程

**业务价值**: 提高产品质量，减少损失

**实施方案**:

```typescript
// 1. 扩展InboundRecord表
model InboundRecord {
  // ... 现有字段
  qualityStatus    String? @map("quality_status") // pending | passed | failed
  qualityCheckerId String? @map("quality_checker_id")
  qualityCheckedAt DateTime? @map("quality_checked_at")
  qualityRemarks   String? @map("quality_remarks")
  damagedQuantity  Float? @map("damaged_quantity") // 破损数量
  goodQuantity     Float? @map("good_quantity")    // 完好数量
}

// 2. 质检API
POST /api/inventory/inbound/:id/quality-check
{
  "status": "passed" | "failed",
  "damagedQuantity": 5,
  "remarks": "5箱破损"
}

// 3. 破损成本分摊
const unitCostWithDamage = totalCost / goodQuantity;
```

**工作量**: 6-8天

---

#### 4. 实现样品管理

**业务价值**: 完善费用核算，准确计算样品成本

**实施方案**:

```typescript
// 1. 添加样品出库类型
export type OutboundReason =
  | 'sales'
  | 'sample' // 新增：样品出库
  | 'damage'
  | 'transfer'
  | 'other';

// 2. 创建样品费用记录
await prisma.expenseRecord.create({
  data: {
    expenseType: 'sample',
    expenseName: '样品成本',
    expenseAmount: sampleCost,
    relatedType: 'outbound',
    relatedId: outboundRecord.id,
  },
});

// 3. 月末样品费用分摊
export async function allocateSampleExpenses(
  startDate: Date,
  endDate: Date
): Promise<void> {
  // 查询期间样品费用
  const sampleExpenses = await prisma.expenseRecord.findMany({
    where: {
      expenseType: 'sample',
      expenseDate: { gte: startDate, lte: endDate },
    },
  });

  // 分摊到销售订单
  // ...
}
```

**工作量**: 5-6天

---

#### 5. 添加信用额度控制

**业务价值**: 降低坏账风险，提高资金安全

**实施方案**:

```typescript
// 1. 扩展Customer表
model Customer {
  // ... 现有字段
  creditLimit     Float? @map("credit_limit")      // 信用额度
  creditUsed      Float  @default(0) @map("credit_used") // 已用额度
  creditAvailable Float? @map("credit_available")  // 可用额度
}

// 2. 创建销售订单时检查
export async function checkCreditLimit(
  customerId: string,
  orderAmount: number
): Promise<{ allowed: boolean; message?: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { creditLimit: true, creditUsed: true },
  });

  if (!customer.creditLimit) {
    return { allowed: true }; // 无限额
  }

  const available = customer.creditLimit - customer.creditUsed;
  if (orderAmount > available) {
    return {
      allowed: false,
      message: `超出信用额度，可用额度：${available}元`,
    };
  }

  return { allowed: true };
}
```

**工作量**: 4-5天

---

#### 6. 实现采购退货功能

**业务价值**: 完善采购流程，处理质量问题

**实施方案**:

```typescript
// 1. 创建采购退货模型
model PurchaseReturnOrder {
  id                String   @id @default(uuid())
  returnNumber      String   @unique
  purchaseOrderId   String
  supplierId        String
  returnType        String   // quality_issue | wrong_product | other
  status            String   // draft | approved | completed
  totalAmount       Float
  refundAmount      Float
  items             PurchaseReturnOrderItem[]
  // ...
}

// 2. 退货出库
await executeOutboundTransaction({
  productId: item.productId,
  quantity: item.returnQuantity,
  reason: 'purchase_return',
  // ...
});

// 3. 应付冲减
await prisma.payableRecord.update({
  where: { purchaseOrderId },
  data: {
    payableAmount: { decrement: refundAmount },
    remainingAmount: { decrement: refundAmount },
  },
});
```

**工作量**: 8-10天

---

### 🟢 未来优化（3-6个月内完成）

#### 7. 库存预警机制

**实施方案**:

```typescript
// 1. 扩展Product表
model Product {
  // ... 现有字段
  minStock Int? @map("min_stock") // 最小库存
  maxStock Int? @map("max_stock") // 最大库存
}

// 2. 定时任务检查库存
export async function checkInventoryAlerts(): Promise<InventoryAlert[]> {
  const alerts: InventoryAlert[] = [];

  const products = await prisma.product.findMany({
    where: { minStock: { not: null } },
    include: { inventory: true },
  });

  for (const product of products) {
    const totalStock = product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);

    if (totalStock < product.minStock) {
      alerts.push({
        type: 'low_stock',
        productId: product.id,
        productName: product.name,
        currentStock: totalStock,
        minStock: product.minStock,
      });
    }
  }

  return alerts;
}
```

**工作量**: 5-6天

---

#### 8. 多仓库管理

**实施方案**:

```typescript
// 1. 创建仓库模型
model Warehouse {
  id        String @id @default(uuid())
  code      String @unique
  name      String
  address   String?
  status    String @default("active")
  inventory Inventory[]
}

// 2. 扩展Inventory表
model Inventory {
  // ... 现有字段
  warehouseId String? @map("warehouse_id")
  warehouse   Warehouse? @relation(fields: [warehouseId], references: [id])
}

// 3. 仓库间调拨
model TransferOrder {
  id              String @id @default(uuid())
  transferNumber  String @unique
  fromWarehouseId String
  toWarehouseId   String
  status          String
  items           TransferOrderItem[]
}
```

**工作量**: 10-12天

---

## 🛣️ 实施路线图

### 第一阶段：核心功能完善（2周）

**目标**: 修复影响成本核算准确性的关键问题

| 任务                  | 工作量 | 负责人   | 交付物           |
| --------------------- | ------ | -------- | ---------------- |
| 1. 采购运费分摊到成本 | 3-4天  | 后端开发 | API + 数据库迁移 |
| 2. 实现FIFO出库逻辑   | 4-5天  | 后端开发 | API + 单元测试   |

**验收标准**:

- ✅ 采购入库时运费自动分摊到单位成本
- ✅ 销售出库按批次时间FIFO
- ✅ 所有单元测试通过

---

### 第二阶段：质量与风险控制（4周）

**目标**: 提高产品质量，降低业务风险

| 任务                | 工作量 | 负责人   | 交付物         |
| ------------------- | ------ | -------- | -------------- |
| 3. 添加质检流程     | 6-8天  | 全栈开发 | API + 前端界面 |
| 4. 实现样品管理     | 5-6天  | 全栈开发 | API + 前端界面 |
| 5. 添加信用额度控制 | 4-5天  | 后端开发 | API + 业务规则 |
| 6. 实现采购退货功能 | 8-10天 | 全栈开发 | 完整流程       |

**验收标准**:

- ✅ 入库时支持质检流程
- ✅ 样品出库和费用分摊完整
- ✅ 销售订单创建时检查信用额度
- ✅ 采购退货流程完整

---

### 第三阶段：系统优化（6周）

**目标**: 提升系统易用性和智能化水平

| 任务            | 工作量  | 负责人   | 交付物   |
| --------------- | ------- | -------- | -------- |
| 7. 库存预警机制 | 5-6天   | 全栈开发 | 预警系统 |
| 8. 多仓库管理   | 10-12天 | 全栈开发 | 完整功能 |
| 9. 报表优化     | 8-10天  | 全栈开发 | 报表系统 |

---

## 📊 技术债务评估

### 高优先级技术债务

1. **运费未分摊到成本** - 需要修改入库逻辑和数据库schema
2. **出库逻辑未实现FIFO** - 需要重构出库算法
3. **无质检流程** - 需要扩展数据模型

### 中优先级技术债务

1. **无样品管理** - 需要新增业务模块
2. **无信用额度控制** - 需要扩展客户模型
3. **无采购退货** - 需要新增退货模型

---

## ✅ 总结与建议

### 系统优势

1. **核心流程完整** - 入库、出库、销售、采购、退货基础流程已实现
2. **成本核算正确** - 使用加权平均法，计算逻辑准确
3. **库存盘点完善** - 盘点流程完整，支持差异分析和审批
4. **批次+变体管理完备** - 通过 `variantId` 和 `batchNumber` 实现批次和色号的独立管理
5. **产品变体系统完整** - 支持色号、色名、SKU管理，支持批量创建变体
6. **代码质量高** - 幂等性保护、事务处理、错误处理完善

### 关键改进点

1. **🔴 立即修复**: 运费分摊、FIFO出库（影响成本核算和库存管理）
2. **🟡 近期完善**: 质检流程、样品管理、信用额度控制（提高质量和降低风险）
3. **🟢 长期优化**: 库存预警、多仓库管理（提升系统智能化水平）

### 实施建议

1. **优先级排序**: 按业务价值和实施难度排序，先易后难
2. **迭代开发**: 每2周一个迭代，快速交付可用功能
3. **充分测试**: 每个功能都要有单元测试和集成测试
4. **用户培训**: 新功能上线前培训用户，确保正确使用
5. **持续优化**: 根据用户反馈持续改进

### 瓷砖行业特性支持情况

| 特性                  | 实现状态    | 说明                                                |
| --------------------- | ----------- | --------------------------------------------------- |
| **批次管理**          | ✅ 已实现   | 批次号自动生成，格式：`{产品编码}-{日期}-{序号}`    |
| **色号管理**          | ✅ 已实现   | 通过 `ProductVariant` 表管理，支持色号、色名、色值  |
| **批次+色号双重管理** | ✅ 已实现   | `Inventory` 表同时包含 `variantId` 和 `batchNumber` |
| **运费分摊**          | ❌ 未实现   | 需要实现运费分摊到单位成本算法                      |
| **破损处理**          | 🟡 部分实现 | 有破损出库，但无质检和成本分摊                      |
| **FIFO出库**          | ❌ 未实现   | 需要实现按批次时间排序的出库逻辑                    |
| **库存周转管理**      | 🟡 部分实现 | 有库存盘点，但无预警机制                            |

---

**报告完成日期**: 2025-11-10
**下次评估日期**: 2026-01-10（第一阶段完成后）

---

## 附录：关键代码位置

### 批次管理

- 批次号生成器: `lib/api/batch-number-generator.ts`
- 批次规格: `prisma/schema.prisma` - `BatchSpecification` 模型

### 变体管理（色号）

- 产品变体模型: `prisma/schema.prisma` - `ProductVariant` 模型
- 变体创建API: `app/api/product-variants/route.ts`
- 批量创建变体: `app/api/product-variants/batch/route.ts`
- 变体映射工具: `lib/utils/inventory-variant-mapper.ts`

### 入库流程

- 入库API: `app/api/inventory/inbound/route.ts`
- 入库事务: `lib/api/minimal-inbound-transaction.ts`
- 入库验证: `lib/validations/inbound.ts`

### 出库流程

- 出库API: `app/api/inventory/outbound/route.ts`
- 出库事务: `lib/api/outbound-transaction.ts`

### 成本核算

- 加权平均成本: `lib/utils/cost-calculation.ts`
- 费用分摊: `lib/services/factory-shipment-expense-service.ts`

### 库存盘点

- 盘点服务: `lib/services/inventory-count-service.ts`
- 盘点API: `app/api/inventory/counts/route.ts`
