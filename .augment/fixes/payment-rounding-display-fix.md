# 收款记录页面添加抹零金额显示

## 问题描述

收款记录列表页面没有显示订单的抹零金额，导致用户无法直观了解订单的实际应收金额。

## 需求

在收款记录列表中，每条记录需要显示关联订单的抹零金额：
- 显示格式：在订单金额旁边显示抹零金额
- 如果抹零金额为0，不显示
- 抹零金额为正数时用红色显示（+）
- 抹零金额为负数时用绿色显示（-）

## 解决方案

### 1. 服务端数据获取修复

**文件**: `app/(dashboard)/finance/payments/page.tsx`

#### 1.1 查询订单时包含抹零金额

```typescript
const [payments, total] = await Promise.all([
  prisma.paymentRecord.findMany({
    where: whereConditions,
    include: {
      customer: {
        select: { id: true, name: true, phone: true },
      },
      salesOrder: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          roundingAdjustment: true, // ✅ 新增: 获取订单抹零金额
        },
      },
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip,
    take: limit,
  }),
  prisma.paymentRecord.count({ where: whereConditions }),
]);
```

#### 1.2 计算实际应收金额

```typescript
const orderTotalAmount = Number(payment.salesOrder.totalAmount);
// ✅ 新增: 获取订单抹零金额
const orderRoundingAdjustment = Number(
  payment.salesOrder.roundingAdjustment || 0
);
// ✅ 修复: 实际应收金额 = totalAmount + roundingAdjustment
const actualTotalAmount = orderTotalAmount + orderRoundingAdjustment;
const orderRemainingAmount =
  actualTotalAmount - orderPaidAmount - orderPendingAmount;
```

#### 1.3 返回数据包含抹零金额

```typescript
return {
  // ... 其他字段
  salesOrder: {
    id: payment.salesOrder.id,
    orderNumber: payment.salesOrder.orderNumber,
    totalAmount: orderTotalAmount,
    roundingAdjustment: orderRoundingAdjustment, // ✅ 新增: 订单抹零金额
    paidAmount: orderPaidAmount,
    pendingAmount: orderPendingAmount,
    remainingAmount: orderRemainingAmount,
  },
  // ... 其他字段
};
```

### 2. 客户端类型定义修复

**文件**: `components/finance/payments-client.tsx`

#### 2.1 更新 TypeScript 类型

```typescript
interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: PaymentStatus;
  remarks?: string;
  receiptNumber?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    roundingAdjustment: number; // ✅ 新增: 订单抹零金额
    paidAmount: number;
    pendingAmount: number;
    remainingAmount: number;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### 3. UI 显示修复

**文件**: `components/finance/payments-client.tsx`

#### 3.1 订单收款情况区域添加抹零显示

```typescript
{/* 订单收款情况 */}
<div className="space-y-2 rounded-md border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/30 p-3">
  <div className="mb-2 text-xs font-semibold text-gray-700">
    订单收款情况
  </div>

  {(() => {
    const hasRounding =
      typeof payment.salesOrder.roundingAdjustment === 'number' &&
      payment.salesOrder.roundingAdjustment !== 0;
    return (
      <div
        className={`grid gap-2 text-xs ${hasRounding ? 'grid-cols-5' : 'grid-cols-4'}`}
      >
        {/* 订单总额 */}
        <div className="rounded bg-white/80 p-2 text-center">
          <div className="mb-0.5 text-[10px] text-gray-600">
            订单总额
          </div>
          <div className="font-bold text-blue-600">
            {formatCurrency(orderTotal)}
          </div>
        </div>
        
        {/* ✅ 新增: 抹零金额显示(只在有抹零时显示) */}
        {hasRounding && (
          <div className="rounded bg-white/80 p-2 text-center">
            <div className="mb-0.5 text-[10px] text-gray-600">
              抹零金额
            </div>
            <div
              className={`font-bold ${payment.salesOrder.roundingAdjustment > 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {payment.salesOrder.roundingAdjustment > 0 ? '+' : ''}
              {formatCurrency(payment.salesOrder.roundingAdjustment)}
            </div>
          </div>
        )}
        
        {/* 已确认、待确认、待收款 */}
        {/* ... */}
      </div>
    );
  })()}
</div>
```

## UI 效果

### 无抹零的订单（4列布局）

```
┌─────────────────────────────────────────────────────────┐
│ 订单收款情况                                              │
├──────────┬──────────┬──────────┬──────────────────────┤
│ 订单总额  │ 已确认   │ 待确认   │ 待收款                │
│ ¥500.00  │ ¥300.00  │ ¥0.00   │ ¥200.00              │
└──────────┴──────────┴──────────┴──────────────────────┘
```

### 有抹零的订单（5列布局）

```
┌──────────────────────────────────────────────────────────────────┐
│ 订单收款情况                                                       │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ 订单总额  │ 抹零金额  │ 已确认   │ 待确认   │ 待收款            │
│ ¥361.00  │ -¥1.00   │ ¥360.00  │ ¥0.00   │ ¥0.00            │
│          │ (绿色)   │          │         │                  │
└──────────┴──────────┴──────────┴──────────┴──────────────────┘
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

3. **检查收款记录列表页面**：
   - ✅ 订单总额：361元
   - ✅ 抹零金额：-1元（绿色显示）
   - ✅ 已确认：360元
   - ✅ 待收款：0元

### 场景 2：无抹零的订单

1. **创建销售订单**：
   - 订单金额：500元
   - 抹零金额：0元

2. **创建收款记录**：
   - 收款金额：300元

3. **检查收款记录列表页面**：
   - ✅ 订单总额：500元
   - ✅ 不显示抹零金额（因为为0）
   - ✅ 已确认：300元
   - ✅ 待收款：200元

## 影响范围

### 修改的文件

1. **服务端**：
   - `app/(dashboard)/finance/payments/page.tsx` - 收款记录数据获取

2. **客户端**：
   - `components/finance/payments-client.tsx` - 收款记录列表显示

### 受益的功能

- ✅ 收款记录列表显示订单抹零金额
- ✅ 实际应收金额计算正确
- ✅ 待收款金额计算准确
- ✅ UI 自适应布局（有抹零时5列，无抹零时4列）

## 技术细节

### 1. 动态列数布局

使用条件渲染和动态 CSS 类实现自适应布局：

```typescript
const hasRounding =
  typeof payment.salesOrder.roundingAdjustment === 'number' &&
  payment.salesOrder.roundingAdjustment !== 0;

<div className={`grid gap-2 text-xs ${hasRounding ? 'grid-cols-5' : 'grid-cols-4'}`}>
  {/* 订单总额 */}
  {/* 抹零金额（条件渲染） */}
  {hasRounding && <div>...</div>}
  {/* 已确认、待确认、待收款 */}
</div>
```

### 2. 颜色规则

- **正数抹零**（增加应收）：红色 `text-red-600`
- **负数抹零**（减少应收）：绿色 `text-green-600`

### 3. 数据类型转换

确保所有 Prisma Decimal 类型都转换为 number：

```typescript
const orderRoundingAdjustment = Number(
  payment.salesOrder.roundingAdjustment || 0
);
```

## 应收款页面状态

应收款页面（`components/finance/receivables-client.tsx`）已经正确实现了抹零金额显示：

- ✅ 第401-433行已有抹零金额显示逻辑
- ✅ 使用相同的颜色规则和布局
- ✅ 动态4列/3列布局

## 相关文档

- [应收款缓存更新修复](./receivables-cache-invalidation-fix.md)
- [抹零金额计算修复](./rounding-adjustment-calculation-fix.md)

## 注意事项

1. **一致性**：
   - 收款记录页面和应收款页面使用相同的显示逻辑
   - 保持 UI 风格统一

2. **性能**：
   - 使用条件渲染避免不必要的 DOM 元素
   - 动态布局不影响性能

3. **可维护性**：
   - 抹零显示逻辑封装在 IIFE 中
   - 易于理解和维护

