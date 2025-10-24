# 应收款抹零金额计算修复

## 问题描述

在应收款页面，当订单存在抹零金额时，待收金额计算错误。

**示例**：
- 订单金额：361元
- 抹零金额：-1元（减少1元）
- 实际收款：360元
- **错误显示**：待收金额 = 1元
- **正确应该**：待收金额 = 0元

## 根本原因

Prisma 的 `Decimal` 类型在 JavaScript 中进行数学运算时，如果不显式转换为 `number`，可能导致精度问题或类型不匹配。

在 `lib/services/receivables-service.ts` 的 `transformToReceivable` 函数中：

```typescript
// ❌ 错误：直接使用 Decimal 类型进行运算
const actualTotalAmount = order.totalAmount + (order.roundingAdjustment || 0);
const paidAmount = confirmedPayments.reduce(
  (sum, payment) => sum + payment.actualPaymentAmount,
  0
);
```

**问题**：
1. `order.totalAmount` 是 `Prisma.Decimal` 类型
2. `order.roundingAdjustment` 是 `Prisma.Decimal | null` 类型
3. `payment.actualPaymentAmount` 是 `Prisma.Decimal` 类型
4. 直接进行数学运算可能导致类型转换错误

## 解决方案

### 修复内容

**文件**: `lib/services/receivables-service.ts`

#### 1. 修复 `transformToReceivable` 函数

```typescript
// ✅ 正确：显式转换为 number
const confirmedPayments =
  order.payments?.filter(payment => payment.status === 'confirmed') || [];
const pendingPayments =
  order.payments?.filter(payment => payment.status === 'pending') || [];

// ✅ 修复: 使用实际到账金额计算已收款和待确认
// ⚠️ 关键修复: Prisma Decimal 类型必须转换为 number
const paidAmount =
  confirmedPayments.reduce(
    (sum, payment) => sum + Number(payment.actualPaymentAmount),
    0
  ) || 0;
const pendingAmount =
  pendingPayments.reduce(
    (sum, payment) => sum + Number(payment.actualPaymentAmount),
    0
  ) || 0;

// ✅ 修复: 实际应收金额 = totalAmount + roundingAdjustment
// ⚠️ 关键修复: Prisma Decimal 类型必须转换为 number
const totalAmountNum = Number(order.totalAmount);
const roundingAdjustmentNum = Number(order.roundingAdjustment || 0);
const actualTotalAmount = totalAmountNum + roundingAdjustmentNum;
const remainingAmount = Math.max(
  0,
  actualTotalAmount - paidAmount - pendingAmount
);
```

#### 2. 修复返回值

```typescript
return {
  id: order.id,
  orderNumber: order.orderNumber,
  customerId: order.customerId,
  customerName: order.customer.name,
  customerPhone: order.customer.phone || undefined,
  orderDate: order.createdAt.toISOString().split('T')[0],
  totalAmount: totalAmountNum, // ✅ 使用转换后的数值
  roundingAdjustment: roundingAdjustmentNum, // ✅ 使用转换后的数值
  paidAmount,
  pendingAmount,
  remainingAmount,
  paymentStatus,
  lastPaymentDate: lastPayment
    ? lastPayment.paymentDate.toISOString()
    : undefined,
};
```

## 计算逻辑验证

### 示例 1：订单金额 361，抹零 -1，实收 360

```typescript
totalAmountNum = Number(361) = 361
roundingAdjustmentNum = Number(-1) = -1
actualTotalAmount = 361 + (-1) = 360
paidAmount = Number(360) = 360
remainingAmount = Math.max(0, 360 - 360 - 0) = 0 ✅
```

### 示例 2：订单金额 358，抹零 +2，实收 360

```typescript
totalAmountNum = Number(358) = 358
roundingAdjustmentNum = Number(2) = 2
actualTotalAmount = 358 + 2 = 360
paidAmount = Number(360) = 360
remainingAmount = Math.max(0, 360 - 360 - 0) = 0 ✅
```

### 示例 3：订单金额 361，抹零 -1，实收 300

```typescript
totalAmountNum = Number(361) = 361
roundingAdjustmentNum = Number(-1) = -1
actualTotalAmount = 361 + (-1) = 360
paidAmount = Number(300) = 300
remainingAmount = Math.max(0, 360 - 300 - 0) = 60 ✅
```

## 验证步骤

### 场景 1：创建带抹零的订单并收款

1. **创建销售订单**：
   - 订单金额：361元
   - 抹零金额：-1元
   - 实际应收：360元

2. **创建收款记录**：
   - 收款金额：360元
   - 实际到账：360元

3. **检查应收款页面**：
   - 订单金额：361元 ✅
   - 抹零金额：-1元 ✅
   - 已收金额：360元 ✅
   - 待收金额：0元 ✅（之前显示1元）

### 场景 2：部分收款

1. **创建销售订单**：
   - 订单金额：361元
   - 抹零金额：-1元
   - 实际应收：360元

2. **创建收款记录**：
   - 收款金额：200元
   - 实际到账：200元

3. **检查应收款页面**：
   - 订单金额：361元 ✅
   - 抹零金额：-1元 ✅
   - 已收金额：200元 ✅
   - 待收金额：160元 ✅

## 影响范围

### 修改的文件

- `lib/services/receivables-service.ts` - 应收款服务层

### 受益的功能

- ✅ 应收款列表页面金额计算正确
- ✅ 待收金额计算准确
- ✅ 支付状态判断正确
- ✅ 统计数据准确

## 技术细节

### Prisma Decimal 类型

Prisma 使用 `Decimal` 类型来表示数据库中的 `DECIMAL` 字段，这是一个特殊的对象类型，不是原生的 JavaScript `number`。

**正确的转换方式**：
```typescript
// ✅ 正确
const num = Number(decimalValue);

// ❌ 错误（可能导致精度问题）
const num = +decimalValue;
const num = parseFloat(decimalValue.toString());
```

### 数学运算规则

在进行金额计算时，必须确保所有操作数都是 `number` 类型：

```typescript
// ✅ 正确
const total = Number(a) + Number(b) + Number(c);

// ❌ 错误（类型不匹配）
const total = a + b + c; // a, b, c 是 Decimal 类型
```

## 相关文档

- [Prisma Decimal 类型文档](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-decimal)
- [JavaScript Number 类型](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)

## 注意事项

1. **精度问题**：
   - JavaScript `number` 是双精度浮点数，可能存在精度问题
   - 对于金额计算，建议使用 `Math.round()` 或保留两位小数
   - 当前实现使用 `Math.max(0, ...)` 确保不会出现负数

2. **空值处理**：
   - 使用 `|| 0` 处理 `null` 或 `undefined`
   - 确保所有金额字段都有默认值

3. **类型安全**：
   - 所有 Prisma Decimal 字段在使用前都应该转换为 `number`
   - 使用 TypeScript 类型检查确保类型安全

## 后续优化建议

1. **使用 Decimal.js 库**：
   - 考虑使用 `decimal.js` 库进行高精度计算
   - 避免浮点数精度问题

2. **统一转换函数**：
   - 创建统一的 Decimal 转换工具函数
   - 确保所有金额计算使用相同的转换逻辑

3. **单元测试**：
   - 添加金额计算的单元测试
   - 覆盖各种边界情况（抹零、部分收款、全额收款等）

