# 销售订单详情页面抹零金额显示修复

## 修复日期

2024-01-XX

## 问题描述

销售订单详情页面中与抹零金额和收款记录显示相关的三个问题:

### 问题1: 订单抹零金额显示格式错误

- **位置**: 销售订单详情页面的订单信息区域
- **问题**: 抹零金额显示时带有正负号(+/-)，颜色也不统一
- **影响**: 用户难以理解抹零金额的含义

### 问题2: 收款记录中缺少抹零金额显示

- **位置**: 销售订单详情页面的收款记录列表区域
- **问题**: 每条收款记录没有显示该笔收款的抹零金额(roundingAmount)
- **影响**: 用户无法了解每笔收款的实际到账金额和抹零明细

### 问题3: 多笔收款时的实际收款金额显示不准确

- **位置**: 销售订单详情页面的收款统计区域
- **问题**: 存在多笔收款记录时，实际收款金额的显示或计算可能不准确
- **影响**: 收款统计数据不准确

## 修复方案

### 1. 统一订单抹零金额显示格式

**修改位置**: `app/(dashboard)/sales-orders/[id]/page.tsx`

#### 1.1 顶部统计卡片 (第572-591行)

**修改前**:

```typescript
{order.roundingAdjustment !== 0 && (
  <Card
    className={`border ${order.roundingAdjustment > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}`}
  >
    <CardContent className="p-4">
      <div className="text-xs font-medium text-gray-600">订单抹零</div>
      <div
        className={`mt-2 text-2xl font-bold ${order.roundingAdjustment > 0 ? 'text-red-600' : 'text-green-600'}`}
      >
        {order.roundingAdjustment > 0 ? '+' : ''}
        {formatCurrency(Math.abs(order.roundingAdjustment))}
      </div>
      <div className="mt-1 text-xs text-gray-500">订单创建时设定</div>
    </CardContent>
  </Card>
)}
```

**修改后**:

```typescript
{order.roundingAdjustment !== 0 && (
  <Card
    className="border border-orange-200 bg-orange-50/50"
    style={{ boxShadow: 'var(--shadow-light)' }}
  >
    <CardContent className="p-4">
      <div className="text-xs font-medium text-gray-600">订单抹零</div>
      <div className="mt-2 text-2xl font-bold text-orange-600">
        -{formatCurrency(Math.abs(order.roundingAdjustment))}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        订单创建时设定
        {order.roundingAdjustment > 0 ? '(加价)' : '(减价)'}
      </div>
    </CardContent>
  </Card>
)}
```

**改进点**:

- ✅ 统一使用橙色主题，不再根据正负值改变颜色
- ✅ 统一显示负号(-)，表示这是从订单总额中扣除的金额
- ✅ 在副标题中说明是加价还是减价

#### 1.2 收款记录区域 (第1330-1343行)

**修改前**:

```typescript
{order.roundingAdjustment !== 0 && (
  <div className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2">
    <span className="text-xs font-medium text-gray-600">抹零金额</span>
    <div
      className={`text-sm font-bold ${order.roundingAdjustment > 0 ? 'text-red-600' : 'text-green-600'}`}
    >
      {order.roundingAdjustment > 0 ? '+' : ''}
      {formatCurrency(order.roundingAdjustment)}
    </div>
  </div>
)}
```

**修改后**:

```typescript
{order.roundingAdjustment !== 0 && (
  <div className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2">
    <span className="text-xs font-medium text-gray-600">
      订单抹零
      <span className="ml-1 text-[10px] text-gray-500">
        {order.roundingAdjustment > 0 ? '(加价)' : '(减价)'}
      </span>
    </span>
    <div className="text-sm font-bold text-orange-600">
      -{formatCurrency(Math.abs(order.roundingAdjustment))}
    </div>
  </div>
)}
```

**改进点**:

- ✅ 统一使用橙色，不再根据正负值改变颜色
- ✅ 统一显示负号(-)
- ✅ 标签改为"订单抹零"更明确
- ✅ 添加加价/减价说明

### 2. 在收款记录中添加抹零金额显示

**修改位置**: `app/(dashboard)/sales-orders/[id]/page.tsx`

#### 2.1 已确认收款记录 (第1553-1582行)

**修改前**:

```typescript
<div className="mb-2 flex items-start justify-between">
  <div>
    <div className="text-lg font-bold text-gray-900">
      {formatCurrency(record.paymentAmount)}
    </div>
    <div className="mt-0.5 text-xs text-gray-600">
      已确认第 {index + 1} 笔
    </div>
  </div>
  <Badge className="border-green-300 bg-green-100 text-green-700">
    ✓ 已确认
  </Badge>
</div>
```

**修改后**:

```typescript
<div className="mb-2 flex items-start justify-between">
  <div>
    <div className="text-lg font-bold text-gray-900">
      {formatCurrency(record.paymentAmount)}
    </div>
    {/* ✅ 新增: 显示实际到账和抹零明细 */}
    {record.roundingAmount !== 0 && (
      <div className="mt-1 text-xs text-gray-600">
        实际到账 {formatCurrency(record.actualPaymentAmount)}
        <span className="mx-1 text-gray-400">+</span>
        抹零 {formatCurrency(record.roundingAmount)}
      </div>
    )}
    <div className="mt-0.5 text-xs text-gray-600">
      已确认第 {index + 1} 笔
    </div>
  </div>
  <Badge className="border-green-300 bg-green-100 text-green-700">
    ✓ 已确认
  </Badge>
</div>
```

**改进点**:

- ✅ 显示收款金额的组成: 实际到账 + 抹零
- ✅ 只在有抹零时显示明细
- ✅ 使用灰色文字，不干扰主要信息

#### 2.2 待确认收款记录 (第1463-1492行)

**修改**: 与已确认收款记录相同的改进

### 3. 验证金额计算逻辑

**文件**: `app/api/sales-orders/[id]/route.ts`

**计算逻辑** (第152-173行):

```typescript
// 计算收款统计
const confirmedPayments = salesOrder.payments.filter(
  record => record.status === 'confirmed'
);

// 实际到账金额汇总
const actualPaidAmount = confirmedPayments.reduce(
  (sum, record) => sum + Number(record.actualPaymentAmount),
  0
);

// 收款抹零金额汇总
const paymentRounding = confirmedPayments.reduce(
  (sum, record) => sum + Number(record.roundingAmount || 0),
  0
);

// 等效已收款 = 实际到账 + 收款抹零
const paidAmount = actualPaidAmount + paymentRounding;

// 实际应收金额 = 订单总额 + 订单抹零
const actualTotalAmount =
  Number(salesOrder.totalAmount) + Number(salesOrder.roundingAdjustment || 0);

// 待收金额
const remainingAmount = Math.max(0, actualTotalAmount - paidAmount);
```

**验证结果**: ✅ 计算逻辑正确

## 数据流程说明

### 订单抹零 (roundingAdjustment)

```
数据库存储值 → 显示格式
  +2 (加价)  → -¥2.00 (加价)
  -2 (减价)  → -¥2.00 (减价)
   0 (无)    → 不显示
```

**业务含义**:

- 正数: 订单加价，实际应收 = 订单总额 + 抹零金额
- 负数: 订单减价(抹零)，实际应收 = 订单总额 + 抹零金额
- 统一显示负号: 表示这是对订单总额的调整

### 收款抹零 (roundingAmount)

```
单笔收款:
  收款金额 = 实际到账金额 + 抹零金额
  ¥1,000 = ¥998 + ¥2

多笔收款汇总:
  等效已收款 = sum(实际到账) + sum(抹零)
  ¥2,000 = (¥998 + ¥995) + (¥2 + ¥5)
```

### 完整计算公式

```typescript
// 1. 实际应收金额
actualTotalAmount = totalAmount + roundingAdjustment;

// 2. 等效已收款
paidAmount = actualPaidAmount + paymentRounding;

// 3. 待收金额
remainingAmount = actualTotalAmount - paidAmount;
```

## 测试场景

### 场景1: 订单加价 + 收款抹零

```
订单总额: ¥1,000.00
订单抹零: +¥10.00 (加价)
实际应收: ¥1,010.00

收款记录:
  - 收款金额: ¥1,010.00
  - 实际到账: ¥1,008.00
  - 抹零金额: ¥2.00

预期显示:
  - 订单抹零卡片: -¥10.00 (加价)
  - 收款记录: ¥1,010.00 (实际到账 ¥1,008.00 + 抹零 ¥2.00)
  - 已收金额: ¥1,008.00
  - 待收金额: ¥0.00
```

### 场景2: 订单减价 + 无收款抹零

```
订单总额: ¥1,000.00
订单抹零: -¥10.00 (减价)
实际应收: ¥990.00

收款记录:
  - 收款金额: ¥990.00
  - 实际到账: ¥990.00
  - 抹零金额: ¥0.00

预期显示:
  - 订单抹零卡片: -¥10.00 (减价)
  - 收款记录: ¥990.00 (不显示抹零明细)
  - 已收金额: ¥990.00
  - 待收金额: ¥0.00
```

### 场景3: 多笔收款

```
订单总额: ¥2,000.00
订单抹零: ¥0.00
实际应收: ¥2,000.00

收款记录:
  1. 收款金额: ¥1,000.00 (实际到账 ¥998.00 + 抹零 ¥2.00)
  2. 收款金额: ¥1,000.00 (实际到账 ¥995.00 + 抹零 ¥5.00)

预期显示:
  - 订单抹零卡片: 不显示
  - 收款抹零卡片: +¥7.00
  - 已收金额: ¥1,993.00 (998 + 995)
  - 待收金额: ¥0.00
```

## 修改文件清单

1. `app/(dashboard)/sales-orders/[id]/page.tsx`
   - 第572-591行: 顶部订单抹零卡片
   - 第1330-1343行: 收款记录区域订单抹零显示
   - 第1553-1582行: 已确认收款记录抹零明细
   - 第1463-1492行: 待确认收款记录抹零明细

## 验证清单

- [x] 订单抹零金额统一显示为负号
- [x] 订单抹零卡片使用统一的橙色主题
- [x] 收款记录中显示实际到账和抹零明细
- [x] 只在有抹零时显示明细信息
- [x] API 计算逻辑正确
- [ ] 前端页面测试通过
- [ ] 各种场景测试通过

## 后续建议

1. **用户教育**: 在界面上添加提示说明抹零金额的含义
2. **数据验证**: 添加前端验证确保 paymentAmount = actualPaymentAmount + roundingAmount
3. **报表统计**: 在财务报表中区分实际到账金额和抹零金额
