# 三大核心业务模块利润计算逻辑分析报告

> 分析日期: 2025-01-20
> 分析范围: 客户直发业务、仓库进货业务、销售订单业务

## 目录

1. [执行摘要](#执行摘要)
2. [客户直发业务（厂家发货）](#客户直发业务厂家发货)
3. [仓库进货业务（采购入库）](#仓库进货业务采购入库)
4. [销售订单业务](#销售订单业务)
5. [数据流完整性分析](#数据流完整性分析)
6. [边界情况测试](#边界情况测试)
7. [发现的问题和风险](#发现的问题和风险)
8. [修正建议和优化方案](#修正建议和优化方案)
9. [测试用例](#测试用例)

---

## 执行摘要

### 总体评估

| 业务模块     | 公式正确性 | 成本核算 | 数据一致性 | 边界处理    | 总体评分 |
| ------------ | ---------- | -------- | ---------- | ----------- | -------- |
| 客户直发业务 | ✅ 正确    | ✅ 完整  | ✅ 一致    | ⚠️ 部分处理 | **A**    |
| 仓库进货业务 | ✅ 正确    | ✅ 完整  | ✅ 一致    | ⚠️ 部分处理 | **A-**   |
| 销售订单业务 | ✅ 正确    | ✅ 完整  | ✅ 一致    | ⚠️ 部分处理 | **A**    |

### 关键发现

1. **✅ 优势**: 利润计算公式数学正确，符合业务逻辑
2. **✅ 优势**: 成本核算在仓库层采用 FIFO 成本队列，销售出库成本按先进先出计算
3. **⚠️ 注意**: 退货场景的利润调整逻辑需要完善
4. **⚠️ 注意**: 部分边界情况（零数量、负利润）需要增强处理

---

## 客户直发业务（厂家发货）

### 1. 业务流程

```
供应商工厂 → 客户
           └── 利润 = 应收金额 - 采购成本 - 分摊费用
```

### 2. 利润计算公式

**核心公式** (来源: `lib/services/factory-shipment-profit-service.ts`)

```typescript
// 单个明细利润计算
利润金额 = 应收金额 - 采购成本 - 分摊费用
利润率 = (利润金额 / 应收金额) × 100%
单位成本 = 进货单价 + 分摊费用 / 实际片数

// 其中：
采购成本 = 进货单价 × 实际片数
实际片数 = 单位是"件" ? 数量 × 每件片数 : 数量
```

**公式正确性验证**: ✅ **数学正确**

| 输入                              | 计算过程       | 期望结果   | 验证 |
| --------------------------------- | -------------- | ---------- | ---- |
| 应收=1000, 采购成本=700, 费用=100 | 1000-700-100   | 利润=200   | ✅   |
| 利润=200, 应收=1000               | (200/1000)×100 | 利润率=20% | ✅   |
| 进货单价=7, 费用=100, 数量=100    | 7+100/100      | 单位成本=8 | ✅   |

### 3. 成本构成要素

| 成本要素                      | 是否包含 | 来源     | 说明             |
| ----------------------------- | -------- | -------- | ---------------- |
| 采购单价 (unitCost/unitPrice) | ✅       | 订单明细 | 优先使用unitCost |
| 运输费用                      | ✅       | FeeItems | 按比例分摊       |
| 仓储费用                      | ✅       | FeeItems | 按比例分摊       |
| 其他费用                      | ✅       | FeeItems | 按比例分摊       |

### 4. 费用分摊逻辑

**分摊方式**: 按进货金额比例分摊

```typescript
// lib/services/factory-shipment-expense-service.ts
明细分摊费用 = 总费用 × (明细进货金额 / 订单总进货金额)
```

**分摊正确性**: ✅ **合理**

- 使用进货金额比例，体现成本分配公平性
- 支持尾差处理，确保分摊总额等于总费用

### 5. 单位转换处理

**特别注意**: 系统正确处理了"件→片"的单位转换

```typescript
function getActualQuantityInPieces(item) {
  if (item.unit === '件' && item.piecesPerUnit > 0) {
    return item.quantity * item.piecesPerUnit;
  }
  return item.quantity;
}
```

---

## 仓库进货业务（采购入库）

### 1. 业务流程

```
供应商 → [采购订单] → 入库 → 仓库
                       └── 成本 = 采购单价 + 分摊费用/数量
```

### 2. 成本计算公式（采购入库 + 仓库库存）

**采购入库单位成本** (来源: `lib/services/purchase-order-cost-service.ts`)

```typescript
入库单位成本 = 采购单价 + 分摊费用 / 数量;
```

采购入库时，会将「含费用的入库单位成本」写入入库记录，并通过 `executeMinimalInboundTransaction`：

- 写入 `inboundRecord.unitCost / totalCost`
- 使用 `addToFIFOQueue(...)` 将本批次加入 FIFO 成本队列
- 更新 `inventory.quantity`，`inventory.unitCost` 仅作为最近批次成本的缓存

**库存成本核算方式**

- 仓库层面的真实成本结构由 **FIFO 队列** (`inventoryCostQueue`) 维护，每次入库都会追加一个批次（数量 + unitCost）。
- 发货/出库时，通过 `consumeFIFOQueue` 按先进先出顺序消耗批次，得到本次出库的真实成本：

```typescript
const fifoCost = await consumeFIFOQueue(productId, variantId, outboundQty, tx);
出库总成本 = fifoCost.totalCost;
出库平均单价 = fifoCost.averageUnitCost;
```

**加权平均成本工具函数** (来源: `lib/utils/cost-calculation.ts`)

`calculateWeightedAverageCost` 仍保留，用于某些统计/辅助场景（例如报表上的平均库存成本），但不再作为销售出库成本的主口径：

```typescript
新单位成本 = (原库存金额 + 入库金额) / (原库存数量 + 入库数量)
// 其中：
原库存金额 = 原库存数量 × 原单位成本
入库金额 = 入库数量 × 入库单位成本
```

### 3. 费用分摊逻辑

**分摊方式**: 按数量比例分摊

```typescript
// lib/services/purchase-order-cost-service.ts
明细分摊费用 = 总费用 × (明细数量 / 订单总数量)
单位成本含费用 = 采购单价 + 总费用 / 总数量
```

**分摊方法对比**:

| 分摊方法   | 厂家发货 | 采购入库 | 说明                             |
| ---------- | -------- | -------- | -------------------------------- |
| 按金额比例 | ✅ 使用  | -        | 高价值商品承担更多费用           |
| 按数量比例 | -        | ✅ 使用  | 每件商品均摊费用（采购入库费用） |

**合理性**:

- 采购入库费用按数量均摊，用于得到「含费用的入库单价」，再进入 FIFO 队列。
- 销售出库成本不再直接使用“仓库加权平均价”，而是按 FIFO 队列逐批计算。

### 4. 入库成本确定时机

```typescript
// 入库时的成本来源优先级
const inboundUnitCost = resolveInboundUnitCost({
  unitCostWithExpense, // 1. 含费用的单位成本（最优先）
  unitPrice, // 2. 采购单价
  fallback, // 3. 默认值
});
```

---

## 销售订单业务

### 1. 业务流程

```
仓库库存 → [销售订单] → 发货 → 客户
                        └── 利润 = 销售金额 - 出库成本 - 分摊费用
```

### 2. 利润计算公式

**发货时利润计算** (来源: `lib/api/handlers/sales-order-status.ts`)

```typescript
// 单个订单项
基础成本 = 库存单位成本 × 数量
分摊费用 = 公司承担费用按销售金额比例分摊
总成本 = 基础成本 + 分摊费用
单位成本(含费用) = 总成本 / 数量
利润金额 = 销售小计 - 总成本
利润率 = (利润金额 / 销售小计) × 100%

// 订单级别
订单总成本 = Σ(各明细总成本)
订单利润 = 商品金额 - 订单总成本
```

**公式正确性验证**: ✅ **数学正确**

| 输入                             | 计算         | 期望结果   | 验证 |
| -------------------------------- | ------------ | ---------- | ---- |
| 销售=1000, 库存成本=600, 费用=50 | 1000-600-50  | 利润=350   | ✅   |
| 利润=350, 销售=1000              | 350/1000×100 | 利润率=35% | ✅   |

### 3. 成本来源

| 成本类型     | 来源                    | 优先级 | 说明                                    |
| ------------ | ----------------------- | ------ | --------------------------------------- |
| 库存成本     | Inventory.unitCost      | 1      | 最近一批入库成本（缓存，用于展示/参考） |
| 订单明细成本 | SalesOrderItem.unitCost | 2      | 创建时指定 / 发货时按 FIFO 成本回写     |
| 默认值       | 0                       | 3      | 兜底                                    |

```typescript
const baseUnitCost = item.unitCost ?? inventory.unitCost ?? undefined;
```

### 4. 费用处理

**费用分摊方式**: 按销售金额比例

```typescript
// 只分摊公司承担的费用
const companyExpenseAmount = feeItems
  .filter(fee => fee.paidBy === 'company')
  .reduce((sum, fee) => sum + fee.feeAmount, 0);

// 按销售小计比例分摊
const ratio = item.subtotal / totalSalesAmount;
const allocatedExpense = totalExpense * ratio;
```

**费用承担方区分**:

- `customer`: 客户承担，不影响利润
- `company`: 公司承担，计入成本

### 5. 数据更新完整性 ✅

发货时更新的字段:

| 表             | 字段             | 更新时机  | 说明             |
| -------------- | ---------------- | --------- | ---------------- |
| SalesOrderItem | allocatedExpense | ✅ 发货时 | 分摊费用         |
| SalesOrderItem | costSubtotal     | ✅ 发货时 | 总成本           |
| SalesOrderItem | unitCost         | ✅ 发货时 | 单位成本(含费用) |
| SalesOrderItem | profitAmount     | ✅ 发货时 | 利润金额         |
| SalesOrderItem | profitMargin     | ✅ 发货时 | 利润率           |
| SalesOrder     | costAmount       | ✅ 发货时 | 订单总成本       |
| SalesOrder     | profitAmount     | ✅ 发货时 | 订单总利润       |
| SalesOrder     | expenseAmount    | ✅ 发货时 | 公司承担费用     |
| OutboundRecord | unitCost         | ✅ 发货时 | 出库成本         |
| OutboundRecord | totalCost        | ✅ 发货时 | 出库总成本       |

---

## 数据流完整性分析

### 1. 采购到销售的完整数据流

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   采购订单      │ --> │   入库记录   │ --> │   库存      │ --> │  销售订单   │
│ PurchaseOrder   │     │ InboundRecord│     │  Inventory  │     │ SalesOrder  │
└─────────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
      │                       │                    │                    │
      │ unitPrice             │ unitCost           │ unitCost           │ unitCost
      │ expenseAmount         │ totalCost          │                    │ costSubtotal
      │                       │                    │                    │ profitAmount
      ▼                       ▼                    ▼                    ▼
  费用分摊 ──────────────> 成本累加 ──────────> 加权平均 ──────────> 利润计算
```

### 2. 数据传递验证

| 环节      | 上游数据                                    | 下游数据                         | 传递正确性 |
| --------- | ------------------------------------------- | -------------------------------- | ---------- |
| 采购→入库 | unitPrice + allocatedExpense                | inboundRecord.unitCost（含费用） | ✅         |
| 入库→库存 | inboundRecord.unitCost                      | inventoryCostQueue（FIFO 批次）  | ✅         |
| 库存→出库 | inventoryCostQueue                          | outboundRecord.unitCost          | ✅         |
| 出库→订单 | outboundRecord.totalCost + allocatedExpense | salesOrderItem.costSubtotal      | ✅         |

### 3. 费用分摊一致性

| 业务     | 分摊基准               | 分摊时机    | 更新目标                       |
| -------- | ---------------------- | ----------- | ------------------------------ |
| 厂家发货 | 进货金额（按金额比例） | 确认/完成时 | FactoryShipmentOrderItem       |
| 采购入库 | 数量                   | 到货确认时  | PurchaseOrderItem              |
| 销售发货 | 成本金额（成本优先）   | 发货时      | SalesOrderItem, OutboundRecord |

### 4. 费用来源与报表口径

当前实现中，「费用」的录入与取数已经统一到以 `expenseRecord` 为台账唯一真源：

| 业务场景 | 录入层字段                              | 台账表 (`expenseRecord.relatedType`) | 报表取数来源                                     | 说明                                            |
| -------- | --------------------------------------- | ------------------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| 销售订单 | `SalesOrder.feeItems` + `expenseAmount` | `'sales_order'`                      | 盈亏分析 / 年度报表 / 月度报表 → `expenseRecord` | feeItems 用于录入和订单详情展示，报表不直接汇总 |
| 厂家直发 | `FactoryShipmentOrder.feeItems`         | `'factory_shipment'`                 | 盈亏分析中的期间费用 → `expenseRecord`           | 厂家利润明细中仍展示订单上的 `expenseAmount`    |
| 采购入库 | 采购单费用项                            | `'purchase_order'`                   | 费用分析 / 供应商维度 → `expenseRecord`          | 对利润表而言主要计入存货成本，而非当期费用      |

关键约束：

- 所有期间费用类报表（`profit-loss-service.ts`、`annual-report-service.ts`、`monthly-report-service.ts`）只从 `expenseRecord` 读取金额，不再直接汇总 `feeItems` 或 `SalesOrder.expenseAmount`。
- 销售订单和厂家发货在创建时，通过 `ensureCompanyExpenses` 自动把 `paidBy === 'company'` 的费用写入 `expenseRecord`，确保录入层与台账可对账。
- 为辅助历史数据排查，新增脚本 `scripts/check-expense-consistency.ts`，用于对比某时间段内：
  - feeItems 中公司承担费用合计；
  - `salesOrder.expenseAmount`；
  - `expenseRecord`（`relatedType = 'sales_order'`）汇总金额；
    发现差异后可据此修正缺失或多余的费用记录，保证报表口径与业务录入一致。

---

## 边界情况测试

### 1. 处理正确的边界情况 ✅

| 边界情况 | 处理方式     | 代码位置                                   |
| -------- | ------------ | ------------------------------------------ |
| 零数量   | 返回原单价   | `actualQuantity > 0 ? ... : purchasePrice` |
| 零收入   | 利润率返回0  | `revenue > 0 ? ... : 0`                    |
| 空库存   | 使用默认成本 | `inventory?.unitCost \|\| 0`               |
| 尾差分摊 | 最后一项承担 | 分摊算法中处理                             |

### 2. 需要关注的边界情况 ⚠️

| 边界情况   | 当前处理         | 风险         | 建议             |
| ---------- | ---------------- | ------------ | ---------------- |
| 负利润     | 正常计算         | 可能显示负值 | 添加预警机制     |
| 成本为null | 视为0            | 利润被高估   | 强制要求成本     |
| 部分退货   | 未调整原订单利润 | 利润不准确   | 实现退货利润调整 |
| 费用后补   | 需手动重算       | 数据不一致   | 添加自动重算     |

### 3. 退货场景分析 ⚠️

**当前退货处理**:

```typescript
// app/actions/return-orders.utils.ts
// 退货完成时入库
if (damaged === 0 && quantity > 0) {
  await executeMinimalInboundTransaction({
    productId: item.productId,
    quantity,
    unitCost: inventory?.unitCost || 0, // ⚠️ 使用当前库存成本
    reason: 'return_inbound',
  });
}
```

**问题**:

1. ❌ 未记录原销售订单的批次号
2. ❌ 使用当前库存成本而非原销售成本
3. ❌ 未调整原销售订单的利润

---

## 发现的问题和风险

### 问题1: 退货利润未调整 🔴 高风险

**问题描述**: 退货完成后，原销售订单的利润未相应调整

**影响**:

- 利润报表数据不准确
- 毛利率计算偏高

**当前代码**:

```typescript
// 退货入库时只增加库存，未调整原订单
await executeMinimalInboundTransaction({ ... });
// ❌ 缺少: 调整原订单利润
```

### 问题2: 退货成本计算不准确 🟡 中风险

**问题描述**: 退货入库使用当前库存成本，而非原销售时的出库成本

**影响**:

- 库存成本被扭曲
- 加权平均成本计算不准

**建议修复**:

```typescript
// 应该使用原销售订单的出库成本
const originalOutbound = await tx.outboundRecord.findFirst({
  where: { salesOrderId: returnOrder.salesOrderId, productId: item.productId },
});
const returnUnitCost = originalOutbound?.unitCost || inventory?.unitCost || 0;
```

### 问题3: 费用变更后利润未重算 🟡 中风险

**问题描述**: 如果订单发货后修改费用，利润不会自动更新

**影响**:

- 利润数据与费用不一致
- 需要手动触发重算

---

## 修正建议和优化方案

### 优先级1: 修复退货利润调整 (高优先级)

```typescript
// 建议在退货完成时添加
async function adjustSalesOrderProfitOnReturn(
  tx: Tx,
  returnOrder: ReturnOrder
) {
  // 1. 计算退货金额
  const returnAmount = returnOrder.refundAmount;

  // 2. 获取原订单
  const salesOrder = await tx.salesOrder.findUnique({
    where: { id: returnOrder.salesOrderId },
  });

  // 3. 计算退货成本（按比例）
  const returnCost =
    (returnAmount / salesOrder.itemsAmount) * salesOrder.costAmount;

  // 4. 调整原订单利润
  await tx.salesOrder.update({
    where: { id: returnOrder.salesOrderId },
    data: {
      profitAmount: salesOrder.profitAmount - (returnAmount - returnCost),
    },
  });
}
```

### 优先级2: 使用原销售成本入库 (中优先级)

```typescript
// 修改退货入库逻辑
const originalOutbound = await tx.outboundRecord.findFirst({
  where: {
    salesOrderId: returnOrder.salesOrderId,
    productId: item.productId,
  },
  select: { unitCost: true, batchNumber: true },
});

await executeMinimalInboundTransaction({
  productId: item.productId,
  quantity,
  unitCost: originalOutbound?.unitCost || inventory?.unitCost || 0,
  batchNumber: originalOutbound?.batchNumber || '',
  reason: 'return_inbound',
});
```

### 优先级3: 添加费用变更自动重算 (低优先级)

```typescript
// 在费用更新时触发重算
async function onFeeItemUpdate(salesOrderId: string) {
  // 重新计算并更新订单利润
  await recalculateOrderProfit(salesOrderId);
}
```

---

## 测试用例

### 测试用例1: 厂家发货利润计算

```typescript
describe('厂家发货利润计算', () => {
  test('客户货利润计算正确', () => {
    const item = {
      id: '1',
      unitCost: 10, // 进货单价
      unitPrice: 15, // 销售单价
      quantity: 100, // 数量
      unit: '片',
      ownership: 'customer',
    };

    const receivableAmount = 1500; // 应收金额
    const allocatedExpense = 200; // 分摊费用

    const result = calculateItemProfit(
      item,
      receivableAmount,
      allocatedExpense
    );

    // 采购成本 = 10 × 100 = 1000
    // 利润 = 1500 - 1000 - 200 = 300
    // 利润率 = 300 / 1500 × 100 = 20%
    // 单位成本 = 10 + 200/100 = 12

    expect(result.profitAmount).toBe(300);
    expect(result.profitMargin).toBe(20);
    expect(result.unitCost).toBe(12);
  });

  test('件转片数量计算正确', () => {
    const item = {
      id: '1',
      unitCost: 100,
      quantity: 10, // 10件
      unit: '件',
      piecesPerUnit: 5, // 每件5片
      ownership: 'customer',
    };

    const receivableAmount = 6000;
    const allocatedExpense = 500;

    const result = calculateItemProfit(
      item,
      receivableAmount,
      allocatedExpense
    );

    // 实际片数 = 10 × 5 = 50
    // 采购成本 = 100 × 50 = 5000
    // 利润 = 6000 - 5000 - 500 = 500

    expect(result.profitAmount).toBe(500);
  });
});
```

### 测试用例2: 加权平均成本计算

```typescript
describe('加权平均成本计算', () => {
  test('初次入库成本正确', () => {
    const result = calculateWeightedAverageCost(0, 0, 100, 10);
    expect(result).toBe(10);
  });

  test('二次入库成本正确', () => {
    // 原库存: 100片 × 10元 = 1000元
    // 入库: 50片 × 12元 = 600元
    // 新成本: (1000 + 600) / (100 + 50) = 10.67元
    const result = calculateWeightedAverageCost(100, 10, 50, 12);
    expect(result).toBeCloseTo(10.67, 2);
  });

  test('零库存入库正确', () => {
    const result = calculateWeightedAverageCost(0, 0, 0, 0);
    expect(result).toBe(0);
  });
});
```

### 测试用例3: 销售订单利润计算

```typescript
describe('销售订单利润计算', () => {
  test('发货时利润计算正确', () => {
    const salesOrderItem = {
      id: '1',
      productId: 'prod-1',
      quantity: 100,
      unitPrice: 15,
      subtotal: 1500,
    };

    const inventoryUnitCost = 10; // 库存成本
    const allocatedExpense = 50; // 分摊费用

    // 基础成本 = 10 × 100 = 1000
    // 总成本 = 1000 + 50 = 1050
    // 单位成本(含费用) = 1050 / 100 = 10.5
    // 利润 = 1500 - 1050 = 450
    // 利润率 = 450 / 1500 × 100 = 30%

    const totalCost =
      inventoryUnitCost * salesOrderItem.quantity + allocatedExpense;
    const unitCostWithExpense = totalCost / salesOrderItem.quantity;
    const profitAmount = salesOrderItem.subtotal - totalCost;
    const profitMargin = (profitAmount / salesOrderItem.subtotal) * 100;

    expect(totalCost).toBe(1050);
    expect(unitCostWithExpense).toBe(10.5);
    expect(profitAmount).toBe(450);
    expect(profitMargin).toBe(30);
  });

  test('公司承担费用正确分摊', () => {
    const feeItems = [
      { feeAmount: 100, paidBy: 'company' },
      { feeAmount: 50, paidBy: 'customer' },
    ];

    const companyExpense = feeItems
      .filter(f => f.paidBy === 'company')
      .reduce((sum, f) => sum + f.feeAmount, 0);

    // 只有公司承担的100元计入成本
    expect(companyExpense).toBe(100);
  });
});
```

### 测试用例4: 边界情况

```typescript
describe('边界情况', () => {
  test('零收入时利润率为0', () => {
    const item = {
      id: '1',
      unitCost: 10,
      quantity: 100,
      ownership: 'customer',
    };
    const result = calculateItemProfit(item, 0, 0);
    expect(result.profitMargin).toBe(0);
  });

  test('零数量时返回原单价', () => {
    const item = { id: '1', unitCost: 10, quantity: 0, ownership: 'customer' };
    const result = calculateItemProfit(item, 0, 100);
    expect(result.unitCost).toBe(10);
  });

  test('负利润正确计算', () => {
    const item = {
      id: '1',
      unitCost: 15,
      quantity: 100,
      ownership: 'customer',
    };
    const receivable = 1000; // 应收
    const expense = 200; // 费用
    // 成本 = 15 × 100 = 1500
    // 利润 = 1000 - 1500 - 200 = -700

    const result = calculateItemProfit(item, receivable, expense);
    expect(result.profitAmount).toBe(-700);
    expect(result.profitMargin).toBe(-70); // -700/1000 × 100
  });
});
```

---

## 总结

### 整体评价

| 维度       | 评分   | 说明                                     |
| ---------- | ------ | ---------------------------------------- |
| 公式正确性 | **A**  | 数学公式正确，符合会计准则               |
| 成本核算   | **A**  | 仓库层使用 FIFO 成本队列，销售按先进先出 |
| 数据一致性 | **A**  | 发货时完整更新所有相关字段               |
| 边界处理   | **B+** | 大部分边界正确处理，退货场景需完善       |
| 代码质量   | **A**  | 服务拆分合理，职责单一                   |

### 待改进项

| 优先级 | 改进项       | 预估工作量 |
| ------ | ------------ | ---------- |
| 🔴 高  | 退货利润调整 | 2-3天      |
| 🟡 中  | 退货成本追溯 | 1-2天      |
| 🟡 中  | 费用变更重算 | 1天        |
| 🟢 低  | 负利润预警   | 0.5天      |

### 后续建议

1. **短期**: 优先修复退货利润调整问题
2. **中期**: 完善退货成本追溯，使用原销售成本入库
3. **长期**: 添加利润分析仪表盘和异常预警

---

_报告生成时间: 2025-01-20_
_分析范围: 客户直发、仓库进货、销售订单业务模块_
_版本: 1.0_
