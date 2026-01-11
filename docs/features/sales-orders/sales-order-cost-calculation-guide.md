# 销售订单成本计算逻辑 - 专业指南

## 📋 目录

1. [核心问题回答](#核心问题回答)
2. [最佳实践](#最佳实践)
3. [与厂家发货订单的对比](#与厂家发货订单的对比)
4. [具体实现建议](#具体实现建议)
5. [费用分摊问题](#费用分摊问题)

---

## 🎯 核心问题回答

### Q1: 是否需要额外计算成本，还是直接读取库存成本？

**答案：两者结合**

```typescript
// ✅ 正确做法
成本 = 库存单位成本（Inventory.unitCost）+ 分摊费用 / 数量

// ❌ 错误做法1：只用库存成本（忽略了费用）
成本 = Inventory.unitCost

// ❌ 错误做法2：完全手动输入（不准确）
成本 = 用户输入的值
```

**详细说明**：

1. **基础成本来源**：`Inventory.unitCost`（加权平均成本）
   - ✅ 这是入库时已经计算好的
   - ✅ 反映了历史采购成本的加权平均
   - ✅ 随着新入库自动更新

2. **费用分摊**：销售订单的费用需要分摊到成本中
   - 运费、仓储费、包装费等
   - 这些费用是销售成本的一部分
   - 应该计入 `unitCost`

3. **最终成本**：
   ```typescript
   订单项单位成本 = Inventory.unitCost + (分摊费用 / 数量)
   订单项成本小计 = 订单项单位成本 × 数量
   订单总成本 = Σ 订单项成本小计
   ```

### Q2: 成本计算的时机？

**答案：出库时（订单状态变为 `shipped`）**

**时间线对比**：

| 阶段     | 订单状态      | 库存成本   | 是否计算成本 | 原因                   |
| -------- | ------------- | ---------- | ------------ | ---------------------- |
| 创建订单 | `draft`       | 可能变化   | ❌ 不计算    | 成本未确定             |
| 确认订单 | `confirmed`   | 可能变化   | ❌ 不计算    | 成本仍可能变化         |
| **发货** | **`shipped`** | **已确定** | **✅ 计算**  | **成本确定，不再变化** |
| 完成     | `delivered`   | 已确定     | ✅ 已计算    | 使用发货时的成本       |

**为什么是出库时？**

```
示例：
2025-01-01: 入库100片，单价10元，库存成本 = 10元/片
2025-01-05: 创建订单，销售50片
2025-01-10: 入库200片，单价12元，库存成本 = (100×10 + 200×12) / 300 = 11.33元/片
2025-01-15: 发货（出库）

如果在创建订单时计算成本 = 10元/片（错误！）
如果在发货时计算成本 = 11.33元/片（正确！）
```

### Q3: 普通销售 vs 调货销售的成本计算

#### 普通销售（NORMAL）

**当前问题**：完全没有成本计算 ❌

**应该如何做**：

```typescript
// 发货时（status: draft → shipped）
async function handleShipped(orderId: string) {
  // 1. 获取订单和订单项
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { items: true, feeItems: true },
  });

  // 2. 对每个订单项
  for (const item of order.items) {
    // 2.1 查询库存，获取当前的加权平均成本
    const inventory = await prisma.inventory.findFirst({
      where: {
        productId: item.productId,
        quantity: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2.2 计算分摊费用
    const allocatedExpense = calculateAllocatedExpense(item, order.feeItems);

    // 2.3 计算单位成本
    const unitCost =
      (inventory.unitCost || 0) + allocatedExpense / item.quantity;

    // 2.4 更新订单项
    await prisma.salesOrderItem.update({
      where: { id: item.id },
      data: {
        unitCost,
        costSubtotal: unitCost * item.quantity,
        allocatedExpense,
        profitAmount: item.subtotal - unitCost * item.quantity,
      },
    });

    // 2.5 创建出库记录（记录历史成本）
    await prisma.outboundRecord.create({
      data: {
        // ...
        unitCost,
        totalCost: unitCost * item.quantity,
      },
    });
  }

  // 3. 更新订单总成本和利润
  const totalCost = order.items.reduce(
    (sum, item) => sum + item.costSubtotal,
    0
  );
  const totalExpense = order.feeItems.reduce(
    (sum, fee) => sum + fee.feeAmount,
    0
  );
  const profitAmount = order.totalAmount - totalCost - totalExpense;

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: {
      costAmount: totalCost,
      expenseAmount: totalExpense,
      profitAmount,
    },
  });
}
```

#### 调货销售（TRANSFER）

**当前做法**：手动输入 `unitCost` ⚠️

**问题**：

- 依赖人工输入，容易出错
- 无法保证与实际库存成本一致
- 无法自动更新

**建议改进**：

```typescript
// 方案1：从供应商库存获取成本（如果是从供应商调货）
const supplierInventory = await getSupplierInventory(
  item.productId,
  supplierId
);
const unitCost = supplierInventory.unitCost;

// 方案2：从本地库存获取成本（如果是从本地仓库调货）
const localInventory = await getLocalInventory(item.productId);
const unitCost = localInventory.unitCost;

// 方案3：混合模式（根据 transferMode 决定）
if (transferMode === 'SUPPLIER_ONLY') {
  // 从供应商获取
} else if (transferMode === 'LOCAL_ONLY') {
  // 从本地库存获取
} else {
  // 混合：根据 localQuantity 和 transferQuantity 分别计算
}
```

### Q4: 库存成本变化后，销售订单成本是否需要更新？

**答案：不需要！（历史成本原则）**

**原因**：

1. **会计准则**：已发货的订单使用历史成本
2. **数据一致性**：出库记录已经记录了当时的成本
3. **利润计算**：利润应该基于发货时的成本，不应该追溯调整

**示例**：

```
2025-01-15: 发货，库存成本 = 11.33元/片，记录成本 = 11.33元/片
2025-01-20: 新入库，库存成本 = 12元/片
2025-01-25: 查询1月15日的订单成本 = 仍然是 11.33元/片（不变）
```

**例外情况**：

- ❌ 订单状态为 `draft` 或 `confirmed`（未发货）：成本未确定，可以重算
- ✅ 订单状态为 `shipped` 或 `delivered`（已发货）：成本已确定，不应变动

---

## 🏆 最佳实践

### 1. 成本计算的"三阶段"模型

```typescript
// 阶段1：创建订单（draft）
{
  costAmount: null,        // 成本未知
  profitAmount: null,      // 利润未知
  status: 'draft'
}

// 阶段2：确认订单（confirmed）
{
  costAmount: null,        // 成本仍未知（库存成本可能变化）
  profitAmount: null,      // 利润仍未知
  status: 'confirmed'
}

// 阶段3：发货（shipped）- 成本确定
{
  costAmount: 1133.00,     // ✅ 成本确定（基于出库时的库存成本）
  profitAmount: 367.00,    // ✅ 利润确定
  status: 'shipped'
}
```

### 2. 成本数据流

```
入库 → 更新库存成本（加权平均）
       ↓
    Inventory.unitCost
       ↓
    销售订单发货
       ↓
    读取 Inventory.unitCost
       ↓
    + 分摊费用
       ↓
    SalesOrderItem.unitCost（确定，不再变化）
       ↓
    OutboundRecord.unitCost（历史记录）
```

### 3. 费用分摊策略

**推荐：按金额比例分摊**（与厂家发货订单一致）

```typescript
function allocateExpensesByValue(
  items: SalesOrderItem[],
  totalExpense: number
): Map<string, number> {
  const totalValue = items.reduce((sum, item) => sum + item.subtotal, 0);

  const allocations = new Map<string, number>();
  let allocatedSum = 0;

  items.forEach((item, index) => {
    if (index === items.length - 1) {
      // 最后一项：用总费用减去已分摊的，避免精度误差
      allocations.set(item.id, totalExpense - allocatedSum);
    } else {
      const allocated = roundToTwoDecimals(
        (item.subtotal / totalValue) * totalExpense
      );
      allocations.set(item.id, allocated);
      allocatedSum += allocated;
    }
  });

  return allocations;
}
```

---

## 🔄 与厂家发货订单的对比

### 相同点

| 特性     | 销售订单  | 厂家发货订单 | 说明                          |
| -------- | --------- | ------------ | ----------------------------- |
| 费用分摊 | ✅ 应该有 | ✅ 有        | 都需要分摊费用到订单项        |
| 精度处理 | ✅ 应该有 | ✅ 有        | 都使用 `roundToTwoDecimals()` |
| 利润公式 | ✅ 应该是 | ✅ 是        | 收入 - 成本 - 费用            |
| 历史成本 | ✅ 应该是 | ✅ 是        | 成本确定后不变                |

### 不同点

| 特性             | 销售订单 | 厂家发货订单       | 原因         |
| ---------------- | -------- | ------------------ | ------------ |
| **成本来源**     | 库存成本 | 采购成本           | 业务性质不同 |
| **成本确定时机** | 出库时   | 创建时             | 业务流程不同 |
| **货物归属**     | 无区分   | 客户货/自有货      | 业务模式不同 |
| **库存影响**     | 减少库存 | 增加库存（自有货） | 业务方向相反 |

### 详细对比

#### 厂家发货订单（Factory Shipment）

**业务场景**：从厂家采购产品，发货给客户

```
厂家 → [采购] → 我方 → [销售] → 客户

成本计算：
- 客户货：采购成本 + 分摊费用（计算利润）
- 自有货：采购成本 + 分摊费用（入库，更新库存成本）
```

**成本确定时机**：创建订单时

- 原因：采购价格在订单创建时已确定
- 费用：运费、仓储费等，在订单创建时录入

**代码示例**：

<augment_code_snippet path="lib/services/factory-shipment-profit-service.ts" mode="EXCERPT">

```typescript
export function calculateItemProfit(
  item: FactoryShipmentOrderItem,
  receivableAmount: number,
  allocatedExpense: number
): ItemProfitResult {
  const cost = item.totalPrice; // 采购成本
  const revenue = receivableAmount; // 应收金额
  const expense = allocatedExpense; // 分摊费用

  // 利润 = 收入 - 成本 - 费用
  const profitAmount = roundToTwoDecimals(revenue - cost - expense);

  // 单位成本 = 采购单价 + 分摊费用 / 数量
  const unitCost = item.quantity > 0
    ? roundToTwoDecimals(item.unitPrice + expense / item.quantity)
    : item.unitPrice;

  return { profitAmount, unitCost, ... };
}
```

</augment_code_snippet>

#### 销售订单（Sales Order）

**业务场景**：从库存销售产品给客户

```
库存 → [销售] → 客户

成本计算：
- 库存成本（加权平均）+ 分摊费用
```

**成本确定时机**：发货时（出库时）

- 原因：库存成本在发货前可能变化（新入库影响加权平均）
- 费用：运费、包装费等，可能在发货时才确定

**应该实现的代码**：

```typescript
// 销售订单发货时计算成本
export async function calculateSalesOrderCost(
  orderId: string
): Promise<CostCalculationResult> {
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { items: true, feeItems: true },
  });

  // 1. 计算费用总额
  const totalExpense = order.feeItems.reduce(
    (sum, fee) => sum + fee.feeAmount,
    0
  );

  // 2. 分摊费用
  const expenseAllocations = allocateExpensesByValue(order.items, totalExpense);

  // 3. 计算每个订单项的成本
  const itemCosts = await Promise.all(
    order.items.map(async item => {
      // 3.1 获取库存成本
      const inventory = await prisma.inventory.findFirst({
        where: { productId: item.productId, quantity: { gt: 0 } },
      });

      const inventoryUnitCost = inventory?.unitCost || 0;

      // 3.2 获取分摊费用
      const allocatedExpense = expenseAllocations.get(item.id) || 0;

      // 3.3 计算单位成本
      const unitCost = inventoryUnitCost + allocatedExpense / item.quantity;

      // 3.4 计算成本小计
      const costSubtotal = unitCost * item.quantity;

      // 3.5 计算利润
      const profitAmount = item.subtotal - costSubtotal;

      return {
        itemId: item.id,
        unitCost: roundToTwoDecimals(unitCost),
        costSubtotal: roundToTwoDecimals(costSubtotal),
        allocatedExpense: roundToTwoDecimals(allocatedExpense),
        profitAmount: roundToTwoDecimals(profitAmount),
      };
    })
  );

  // 4. 计算订单总成本和利润
  const totalCost = itemCosts.reduce((sum, item) => sum + item.costSubtotal, 0);
  const totalProfit = order.totalAmount - totalCost - totalExpense;

  return {
    totalCost: roundToTwoDecimals(totalCost),
    totalExpense: roundToTwoDecimals(totalExpense),
    totalProfit: roundToTwoDecimals(totalProfit),
    profitMargin:
      order.totalAmount > 0
        ? roundToTwoDecimals((totalProfit / order.totalAmount) * 100)
        : 0,
    itemCosts,
  };
}
```

---

## 💡 具体实现建议

### 建议1: 修改出库逻辑，同时更新订单成本

**当前代码**（`lib/api/handlers/sales-order-status.ts:257`）：

<augment_code_snippet path="lib/api/handlers/sales-order-status.ts" mode="EXCERPT">

```typescript
// 创建出库记录（使用预先生成的单号）
await tx.outboundRecord.create({
  data: {
    recordNumber: outboundRecordNumber,
    productId,
    variantId: inventory.variantId,
    batchNumber: item.batchNumber || inventory.batchNumber || undefined,
    inventoryId: inventory.id,
    quantity: item.quantity,
    unitCost: item.unitCost || inventory.unitCost || undefined, // ⚠️ 问题：优先使用订单项的成本
    totalCost: item.unitCost
      ? item.unitCost * item.quantity
      : inventory.unitCost
        ? inventory.unitCost * item.quantity
        : undefined,
    reason: 'sales_outbound',
    notes: `销售订单发货：${existingOrder.orderNumber}`,
    customerId: existingOrder.customerId,
    salesOrderId: existingOrder.id,
    operatorId: finalOperatorId,
  },
});
```

</augment_code_snippet>

**问题**：

1. 优先使用 `item.unitCost`（可能是手动输入的，不准确）
2. 没有考虑费用分摊
3. 没有更新订单项的成本字段

**改进后的代码**：

```typescript
// 1. 先计算费用分摊
const feeItems = await tx.salesOrderFeeItem.findMany({
  where: { salesOrderId: existingOrder.id },
});
const totalExpense = feeItems.reduce((sum, fee) => sum + fee.feeAmount, 0);
const expenseAllocations = allocateExpensesByValue(
  existingOrder.items,
  totalExpense
);

// 2. 对每个订单项
for (const item of existingOrder.items) {
  const inventory = await tx.inventory.findFirst({
    where: { productId: item.productId, quantity: { gt: 0 } },
  });

  // 2.1 计算单位成本（库存成本 + 分摊费用）
  const inventoryUnitCost = inventory?.unitCost || 0;
  const allocatedExpense = expenseAllocations.get(item.id) || 0;
  const unitCost = roundToTwoDecimals(
    inventoryUnitCost + allocatedExpense / item.quantity
  );
  const totalCost = roundToTwoDecimals(unitCost * item.quantity);

  // 2.2 更新订单项成本
  await tx.salesOrderItem.update({
    where: { id: item.id },
    data: {
      unitCost,
      costSubtotal: totalCost,
      allocatedExpense: roundToTwoDecimals(allocatedExpense),
      profitAmount: roundToTwoDecimals(item.subtotal - totalCost),
    },
  });

  // 2.3 创建出库记录（使用计算后的成本）
  await tx.outboundRecord.create({
    data: {
      recordNumber: outboundRecordNumber,
      productId: item.productId,
      variantId: inventory?.variantId,
      batchNumber: item.batchNumber || inventory?.batchNumber || undefined,
      inventoryId: inventory?.id,
      quantity: item.quantity,
      unitCost, // ✅ 使用计算后的成本
      totalCost, // ✅ 使用计算后的总成本
      reason: 'sales_outbound',
      notes: `销售订单发货：${existingOrder.orderNumber}`,
      customerId: existingOrder.customerId,
      salesOrderId: existingOrder.id,
      operatorId: finalOperatorId,
    },
  });
}

// 3. 更新订单总成本和利润
const updatedItems = await tx.salesOrderItem.findMany({
  where: { salesOrderId: existingOrder.id },
});
const totalCost = updatedItems.reduce(
  (sum, item) => sum + (item.costSubtotal || 0),
  0
);
const profitAmount = existingOrder.totalAmount - totalCost - totalExpense;

await tx.salesOrder.update({
  where: { id: existingOrder.id },
  data: {
    costAmount: roundToTwoDecimals(totalCost),
    expenseAmount: roundToTwoDecimals(totalExpense),
    profitAmount: roundToTwoDecimals(profitAmount),
  },
});
```

### 建议2: 创建专门的成本计算服务

**文件结构**：

```
lib/services/
  ├── sales-order-cost-service.ts      # 成本计算服务
  ├── sales-order-expense-service.ts   # 费用分摊服务（复用厂家发货的逻辑）
  └── sales-order-profit-service.ts    # 利润计算服务
```

**示例代码**（`lib/services/sales-order-cost-service.ts`）：

```typescript
import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from './factory-shipment-expense-service';
import { allocateExpensesByValue } from './sales-order-expense-service';

export interface SalesOrderCostResult {
  totalCost: number;
  totalExpense: number;
  totalProfit: number;
  profitMargin: number;
  itemCosts: Array<{
    itemId: string;
    unitCost: number;
    costSubtotal: number;
    allocatedExpense: number;
    profitAmount: number;
  }>;
}

/**
 * 计算销售订单成本
 *
 * 应该在订单发货时调用
 *
 * @param orderId 销售订单ID
 * @returns 成本计算结果
 */
export async function calculateSalesOrderCost(
  orderId: string
): Promise<SalesOrderCostResult> {
  // 实现逻辑（见上文）
}

/**
 * 更新销售订单成本到数据库
 *
 * @param orderId 销售订单ID
 * @param costResult 成本计算结果
 */
export async function updateSalesOrderCost(
  orderId: string,
  costResult: SalesOrderCostResult
): Promise<void> {
  await prisma.$transaction([
    // 更新订单项
    ...costResult.itemCosts.map(item =>
      prisma.salesOrderItem.update({
        where: { id: item.itemId },
        data: {
          unitCost: item.unitCost,
          costSubtotal: item.costSubtotal,
          allocatedExpense: item.allocatedExpense,
          profitAmount: item.profitAmount,
        },
      })
    ),
    // 更新订单
    prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        costAmount: costResult.totalCost,
        expenseAmount: costResult.totalExpense,
        profitAmount: costResult.totalProfit,
      },
    }),
  ]);
}
```

---

## 📦 费用分摊问题

### 是否需要费用分摊？

**答案：是的，强烈建议！**

**原因**：

1. **成本准确性**
   - 运费、包装费等是销售成本的一部分
   - 不分摊费用会导致成本被低估，利润被高估

2. **利润分析**
   - 需要知道每个产品的真实利润
   - 费用分摊后才能准确分析产品盈利能力

3. **定价决策**
   - 定价应该覆盖成本 + 费用 + 期望利润
   - 不考虑费用会导致定价过低

**示例**：

```
订单总额：1000元
产品成本：600元
运费：100元

❌ 不分摊费用：
利润 = 1000 - 600 = 400元（错误！）
利润率 = 40%（虚高）

✅ 分摊费用：
利润 = 1000 - 600 - 100 = 300元（正确）
利润率 = 30%（准确）
```

### 如何分摊费用？

**推荐方法：按金额比例分摊**（与厂家发货订单一致）

**优点**：

- 简单易懂
- 公平合理
- 与产品价值成正比

**实现**：

```typescript
// 复用厂家发货订单的费用分摊逻辑
import { allocateExpenses } from '@/lib/services/factory-shipment-expense-service';

// 将 SalesOrderFeeItem 转换为费用数组
const expenses = feeItems.map(fee => ({
  type: fee.feeType,
  amount: fee.feeAmount,
}));

// 调用分摊函数
const allocationResult = allocateExpenses(
  order.items,
  expenses.reduce((sum, e) => sum + e.amount, 0),
  { method: 'by_value' } // 按金额比例分摊
);

// 获取每个订单项的分摊费用
const expenseMap = new Map(
  allocationResult.results.map(r => [r.itemId, r.allocatedAmount])
);
```

---

## ✅ 总结

### 核心要点

1. **成本来源**：库存成本（`Inventory.unitCost`）+ 分摊费用
2. **计算时机**：出库时（订单状态变为 `shipped`）
3. **历史成本**：成本确定后不再变化
4. **费用分摊**：必须分摊，推荐按金额比例
5. **利润公式**：收入 - 成本 - 费用

### 实施步骤

1. **Phase 1**: 添加数据库字段（`expenseAmount`, `allocatedExpense`）
2. **Phase 2**: 创建费用分摊服务（复用厂家发货逻辑）
3. **Phase 3**: 创建成本计算服务
4. **Phase 4**: 修改出库逻辑，集成成本计算
5. **Phase 5**: 添加利润重算功能（可选）

### 预期收益

- ✅ 成本数据准确
- ✅ 利润计算正确
- ✅ 财务报表可靠
- ✅ 支持利润分析
- ✅ 辅助定价决策

---

**文档版本**: 1.0  
**最后更新**: 2025-11-04  
**作者**: AI Assistant
