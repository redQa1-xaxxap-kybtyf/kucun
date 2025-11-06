# 销售订单成本计算 - 快速参考卡片

## 🎯 核心公式

```typescript
// 订单项单位成本
unitCost = Inventory.unitCost + (分摊费用 / 数量)

// 订单项成本小计
costSubtotal = unitCost × quantity

// 订单总成本
costAmount = Σ costSubtotal

// 订单总费用
expenseAmount = Σ feeItems.feeAmount

// 订单利润
profitAmount = totalAmount - costAmount - expenseAmount

// 利润率
profitMargin = (profitAmount / totalAmount) × 100%
```

---

## ⏰ 成本计算时机

| 订单状态      | 是否计算成本 | 原因           |
| ------------- | ------------ | -------------- |
| `draft`       | ❌ 否        | 成本未确定     |
| `confirmed`   | ❌ 否        | 成本可能变化   |
| **`shipped`** | **✅ 是**    | **成本确定**   |
| `delivered`   | ✅ 已计算    | 使用发货时成本 |

**关键点**：在订单状态变为 `shipped` 时计算成本！

---

## 📊 成本数据流

```
入库 → 更新 Inventory.unitCost（加权平均）
         ↓
      发货时读取
         ↓
   + 分摊费用/数量
         ↓
  SalesOrderItem.unitCost（确定）
         ↓
  OutboundRecord.unitCost（历史记录）
```

---

## 💰 费用分摊方法

**推荐：按金额比例分摊**

```typescript
分摊费用 = (订单项金额 / 订单总金额) × 总费用

// 示例
订单总额 = 1000元
订单项A = 600元
订单项B = 400元
总费用 = 100元

订单项A分摊费用 = (600 / 1000) × 100 = 60元
订单项B分摊费用 = (400 / 1000) × 100 = 40元
```

---

## 🔄 普通销售 vs 调货销售

### 普通销售（NORMAL）

```typescript
// 发货时
const inventory = await getInventory(productId);
const unitCost = inventory.unitCost + allocatedExpense / quantity;
```

**成本来源**：本地库存成本

### 调货销售（TRANSFER）

```typescript
// 发货时
if (transferMode === 'SUPPLIER_ONLY') {
  // 从供应商库存获取成本
  const unitCost = supplierInventory.unitCost + allocatedExpense / quantity;
} else if (transferMode === 'LOCAL_ONLY') {
  // 从本地库存获取成本
  const unitCost = localInventory.unitCost + allocatedExpense / quantity;
} else {
  // 混合模式：分别计算
}
```

**成本来源**：根据 `transferMode` 决定

---

## ✅ 实施检查清单

### Phase 1: 数据库准备

- [ ] 添加 `SalesOrder.expenseAmount` 字段
- [ ] 添加 `SalesOrderItem.allocatedExpense` 字段
- [ ] 添加 `SalesOrderItem.profitMargin` 字段
- [ ] 运行数据库迁移

### Phase 2: 费用分摊服务

- [ ] 创建 `lib/services/sales-order-expense-service.ts`
- [ ] 实现 `allocateExpensesByValue()` 函数
- [ ] 复用 `roundToTwoDecimals()` 精度处理
- [ ] 编写单元测试（目标覆盖率 >90%）

### Phase 3: 成本计算服务

- [ ] 创建 `lib/services/sales-order-cost-service.ts`
- [ ] 实现 `calculateSalesOrderCost()` 函数
- [ ] 实现 `updateSalesOrderCost()` 函数
- [ ] 编写单元测试

### Phase 4: 集成到出库流程

- [ ] 修改 `lib/api/handlers/sales-order-status.ts`
- [ ] 在发货时调用成本计算服务
- [ ] 更新订单项成本字段
- [ ] 更新出库记录成本字段
- [ ] 更新订单总成本和利润

### Phase 5: 测试验证

- [ ] 创建测试订单
- [ ] 验证成本计算准确性
- [ ] 验证费用分摊正确性
- [ ] 验证利润计算正确性
- [ ] 验证财务报表数据一致性

---

## 🚨 常见错误

### ❌ 错误1：创建订单时计算成本

```typescript
// ❌ 错误
async function createSalesOrder(data) {
  const costAmount = calculateCost(data.items); // 成本未确定！
  // ...
}

// ✅ 正确
async function createSalesOrder(data) {
  const costAmount = null; // 成本待定
  // ...
}
```

### ❌ 错误2：忽略费用

```typescript
// ❌ 错误
profitAmount = totalAmount - costAmount;

// ✅ 正确
profitAmount = totalAmount - costAmount - expenseAmount;
```

### ❌ 错误3：手动输入成本

```typescript
// ❌ 错误（调货销售）
const unitCost = userInput; // 依赖人工输入

// ✅ 正确
const inventory = await getInventory(productId);
const unitCost = inventory.unitCost + allocatedExpense / quantity;
```

### ❌ 错误4：成本追溯调整

```typescript
// ❌ 错误
// 库存成本变化后，更新已发货订单的成本
await updateShippedOrderCost(orderId, newCost);

// ✅ 正确
// 已发货订单使用历史成本，不应变动
// 只有 draft 或 confirmed 状态的订单可以重算成本
```

---

## 📝 代码模板

### 发货时计算成本

```typescript
async function handleShipped(orderId: string) {
  await prisma.$transaction(async tx => {
    // 1. 获取订单
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: { items: true, feeItems: true },
    });

    // 2. 计算费用总额
    const totalExpense = order.feeItems.reduce(
      (sum, fee) => sum + fee.feeAmount,
      0
    );

    // 3. 分摊费用
    const expenseAllocations = allocateExpensesByValue(
      order.items,
      totalExpense
    );

    // 4. 计算每个订单项的成本
    for (const item of order.items) {
      // 4.1 获取库存成本
      const inventory = await tx.inventory.findFirst({
        where: { productId: item.productId, quantity: { gt: 0 } },
      });

      // 4.2 计算单位成本
      const inventoryUnitCost = inventory?.unitCost || 0;
      const allocatedExpense = expenseAllocations.get(item.id) || 0;
      const unitCost = roundToTwoDecimals(
        inventoryUnitCost + allocatedExpense / item.quantity
      );

      // 4.3 更新订单项
      await tx.salesOrderItem.update({
        where: { id: item.id },
        data: {
          unitCost,
          costSubtotal: roundToTwoDecimals(unitCost * item.quantity),
          allocatedExpense: roundToTwoDecimals(allocatedExpense),
          profitAmount: roundToTwoDecimals(
            item.subtotal - unitCost * item.quantity
          ),
        },
      });

      // 4.4 创建出库记录
      await tx.outboundRecord.create({
        data: {
          // ...
          unitCost,
          totalCost: roundToTwoDecimals(unitCost * item.quantity),
        },
      });
    }

    // 5. 更新订单总成本和利润
    const totalCost = order.items.reduce(
      (sum, item) => sum + (item.costSubtotal || 0),
      0
    );
    const profitAmount = order.totalAmount - totalCost - totalExpense;

    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status: 'shipped',
        costAmount: roundToTwoDecimals(totalCost),
        expenseAmount: roundToTwoDecimals(totalExpense),
        profitAmount: roundToTwoDecimals(profitAmount),
      },
    });
  });
}
```

### 费用分摊函数

```typescript
function allocateExpensesByValue(
  items: SalesOrderItem[],
  totalExpense: number
): Map<string, number> {
  const totalValue = items.reduce((sum, item) => sum + item.subtotal, 0);

  if (totalValue === 0) {
    return new Map();
  }

  const allocations = new Map<string, number>();
  let allocatedSum = 0;

  items.forEach((item, index) => {
    if (index === items.length - 1) {
      // 最后一项：避免精度误差
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

## 🔗 相关文档

- **详细指南**: `docs/sales-order-cost-calculation-guide.md`
- **分析报告**: `docs/sales-orders-analysis-report.md`
- **执行摘要**: `docs/sales-orders-analysis-summary.md`
- **厂家发货参考**: `lib/services/factory-shipment-profit-service.ts`

---

## 💡 关键提示

1. **成本在发货时确定**，不是创建订单时
2. **费用必须分摊**，否则利润虚高
3. **使用库存成本**，不要手动输入
4. **历史成本原则**，成本确定后不变
5. **精度处理统一**，使用 `roundToTwoDecimals()`

---

**快速参考版本**: 1.0  
**最后更新**: 2025-11-04
