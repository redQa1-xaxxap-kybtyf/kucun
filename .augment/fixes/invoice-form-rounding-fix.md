# 发票导向表单抹零金额提交修复

## 问题描述

用户在应收货款页面发现：
- 订单金额：¥696.50
- 已收金额：¥0.00
- **待收金额：¥6.50**（错误！应该是 ¥690.00）
- 抹零金额没有显示

经过排查发现：
- 订单的 `roundingAdjustment` 字段值是 0，而不是 6.50
- 这导致待收金额计算错误：696.5 - 0 - 690 = 6.5（应该是：690 - 0 - 690 = 0）

## 根本原因

**发票导向表单**（`components/sales-orders/invoice-oriented-form.tsx`）在提交订单时，**没有包含 `roundingAdjustment` 字段**，导致抹零金额丢失。

### 问题代码

```typescript
// ❌ 错误：没有包含 roundingAdjustment
const onSubmit = (data: CreateSalesOrderData) => {
  const { orderNumber: _orderNumber, ...submitData } = data;
  const orderData = {
    ...submitData,
    totalAmount,
    items: submitData.items.map(item => ({
      ...item,
      subtotal: (item.quantity ?? 0) * (item.unitPrice || 0),
    })),
  };

  createMutation.mutate(orderData as unknown as SalesOrderCreateInput);
};
```

### 对比其他表单

**ERP 销售订单表单**（`components/sales-orders/erp-sales-order-form.tsx`）正确包含了 `roundingAdjustment`：

```typescript
// ✅ 正确：包含 roundingAdjustment
const mapFormDataForTransform = (payload: CreateSalesOrderData): SalesOrderFormData => ({
  customerId: payload.customerId,
  status: payload.status,
  orderType: payload.orderType,
  transferMode: payload.transferMode,
  supplierId: payload.supplierId,
  remarks: payload.remarks ?? '',
  items: payload.items ?? [],
  feeItems: (payload.feeItems ?? []).map(fee => ({...})),
  roundingAdjustment: payload.roundingAdjustment, // ✅ 包含抹零金额
  usePrepayment: payload.usePrepayment,
  prepaymentAmount: payload.prepaymentAmount,
});
```

## 解决方案

### 1. 修复表单提交逻辑

**文件**: `components/sales-orders/invoice-oriented-form.tsx`

#### 修改点 1：在 `onSubmit` 中包含 `roundingAdjustment`

```typescript
// 表单提交
const onSubmit = (data: CreateSalesOrderData) => {
  // 不传递orderNumber，让后端自动生成，构建销售订单数据
  const { orderNumber: _orderNumber, ...submitData } = data;
  const orderData = {
    ...submitData,
    totalAmount,
    roundingAdjustment: submitData.roundingAdjustment, // ✅ 新增: 包含抹零金额
    items: submitData.items.map(item => ({
      ...item,
      subtotal: (item.quantity ?? 0) * (item.unitPrice || 0),
    })),
  };

  // orderData 符合 SalesOrderCreateInput 类型
  createMutation.mutate(orderData as unknown as SalesOrderCreateInput);
};
```

#### 修改点 2：在默认值中添加 `roundingAdjustment`

```typescript
// 表单配置
const form = useForm<CreateSalesOrderData>({
  resolver: zodResolver(CreateSalesOrderSchema),
  defaultValues: {
    customerId: '',
    status: 'draft',
    remarks: '',
    items: [],
    roundingAdjustment: undefined, // ✅ 新增: 抹零金额默认值
  },
});
```

## 验证步骤

### 场景：创建带抹零的订单

1. **使用发票导向表单创建订单**：
   - 订单金额：696.50元
   - 抹零金额：-6.50元
   - 实际应收：690元

2. **创建收款记录**：
   - 收款金额：690元

3. **检查应收货款页面**：
   - ✅ 订单金额：¥696.50
   - ✅ 抹零金额：-¥6.50（绿色显示）
   - ✅ 已收金额：¥690.00
   - ✅ 待收金额：¥0.00（之前错误显示 ¥6.50）

4. **检查数据库**：
   ```sql
   SELECT orderNumber, totalAmount, roundingAdjustment 
   FROM sales_orders 
   WHERE orderNumber = 'SO202510230100';
   ```
   - ✅ `roundingAdjustment` 应该是 -6.50，而不是 0

## 影响范围

### 修改的文件

- `components/sales-orders/invoice-oriented-form.tsx` - 发票导向表单

### 受影响的功能

- ✅ 发票导向表单创建订单时正确保存抹零金额
- ✅ 应收货款页面正确显示待收金额
- ✅ 应收货款页面正确显示抹零金额
- ✅ 收款进度计算正确

### 不受影响的功能

- ✅ ERP 销售订单表单（已经正确实现）
- ✅ 其他订单表单

## 技术细节

### 数据流

1. **前端表单** → 包含 `roundingAdjustment` 字段
2. **API 验证** → `salesOrderCreateSchema` 验证抹零金额
3. **后端处理** → `calculateFinancials` 计算实际应收金额
4. **数据库存储** → `roundingAdjustment` 字段保存抹零金额
5. **应收款服务** → 使用 `totalAmount + roundingAdjustment` 计算实际应收

### 计算逻辑

```typescript
// 实际应收金额 = 订单金额 + 抹零金额
const actualTotalAmount = totalAmount + roundingAdjustment;

// 待收金额 = 实际应收 - 已收 - 待确认
const remainingAmount = actualTotalAmount - paidAmount - pendingAmount;
```

### 示例计算

**订单金额 696.50，抹零 -6.50，收款 690**：

```
实际应收 = 696.50 + (-6.50) = 690.00
待收金额 = 690.00 - 690.00 - 0 = 0.00 ✅
```

**之前的错误计算（抹零丢失）**：

```
实际应收 = 696.50 + 0 = 696.50
待收金额 = 696.50 - 690.00 - 0 = 6.50 ❌
```

## 相关文档

- [应收款缓存更新修复](./receivables-cache-invalidation-fix.md)
- [抹零金额计算修复](./rounding-adjustment-calculation-fix.md)
- [收款记录抹零显示修复](./payment-rounding-display-fix.md)
- [销售订单详情抹零显示修复](./sales-order-detail-rounding-display-fix.md)

## 注意事项

1. **数据一致性**：
   - 所有订单表单都应该包含 `roundingAdjustment` 字段
   - 确保提交时不会丢失这个字段

2. **向后兼容**：
   - 旧订单的 `roundingAdjustment` 可能是 `null` 或 `0`
   - 代码中使用 `roundingAdjustment || 0` 处理

3. **表单验证**：
   - `roundingAdjustment` 字段已在 `salesOrderCreateSchema` 中定义
   - 支持正数和负数，最多保留2位小数

4. **UI 显示**：
   - 抹零金额为 0 时不显示
   - 正数显示为红色（增加应收）
   - 负数显示为绿色（减少应收）

## 后续改进建议

1. **统一表单逻辑**：
   - 考虑将订单提交逻辑抽取为公共函数
   - 避免不同表单之间的实现差异

2. **添加单元测试**：
   - 测试抹零金额的提交和计算
   - 测试边界情况（0、正数、负数）

3. **添加 E2E 测试**：
   - 测试完整的订单创建和收款流程
   - 验证抹零金额在各个页面的显示

## 总结

这个问题是由于发票导向表单在提交订单时遗漏了 `roundingAdjustment` 字段导致的。修复后，所有订单表单都能正确保存和显示抹零金额，应收货款的计算也完全正确了。

