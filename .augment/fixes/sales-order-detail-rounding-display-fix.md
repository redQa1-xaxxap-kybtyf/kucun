# 销售订单详情页面添加抹零金额显示

## 问题描述

销售订单详情页面没有显示订单的抹零金额，导致用户无法直观了解订单的实际应收金额。

## 需求

在销售订单详情页面的两个区域添加抹零金额显示：
1. **顶部统计卡片**：添加抹零金额卡片
2. **收款记录区域**：在订单金额总览中显示抹零金额和实际应收金额

## 解决方案

### 1. 顶部统计卡片修复

**文件**: `app/(dashboard)/sales-orders/[id]/page.tsx`

#### 1.1 动态布局

根据是否有抹零金额，动态调整卡片布局：
- **无抹零**：4列布局（订单总金额、已收金额、待收金额、毛利金额）
- **有抹零**：5列布局（订单总金额、抹零金额、已收金额、待收金额、毛利金额）

```typescript
<div
  className={`grid gap-4 md:grid-cols-2 ${order.roundingAdjustment !== 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
>
```

#### 1.2 抹零金额卡片

只在有抹零时显示：

```typescript
{/* ✅ 新增: 抹零金额卡片(只在有抹零时显示) */}
{order.roundingAdjustment !== 0 && (
  <Card
    className={`border ${order.roundingAdjustment > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}`}
    style={{ boxShadow: 'var(--shadow-light)' }}
  >
    <CardContent className="p-4">
      <div className="text-xs font-medium text-gray-600">
        抹零金额
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${order.roundingAdjustment > 0 ? 'text-red-600' : 'text-green-600'}`}
      >
        {order.roundingAdjustment > 0 ? '+' : ''}
        {formatCurrency(order.roundingAdjustment)}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        实际应收：
        {formatCurrency(order.totalAmount + order.roundingAdjustment)}
      </div>
    </CardContent>
  </Card>
)}
```

**显示规则**：
- 抹零金额 > 0：红色背景和文字（增加应收）
- 抹零金额 < 0：绿色背景和文字（减少应收）
- 显示实际应收金额（订单总额 + 抹零）

### 2. 收款记录区域修复

**文件**: `app/(dashboard)/sales-orders/[id]/page.tsx`

#### 2.1 订单金额总览

在订单总金额下方添加抹零金额和实际应收金额：

```typescript
{/* 订单金额总览 */}
<div className="mb-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
  <div className="mb-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
        <DollarSign className="h-4 w-4 text-white" />
      </div>
      <span className="text-sm font-semibold text-gray-700">
        订单总金额
      </span>
    </div>
    <div className="text-xl font-bold text-blue-600">
      {formatCurrency(order.totalAmount)}
    </div>
  </div>

  {/* ✅ 新增: 抹零金额显示(只在有抹零时显示) */}
  {order.roundingAdjustment !== 0 && (
    <div className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2">
      <span className="text-xs font-medium text-gray-600">
        抹零金额
      </span>
      <div
        className={`text-sm font-bold ${order.roundingAdjustment > 0 ? 'text-red-600' : 'text-green-600'}`}
      >
        {order.roundingAdjustment > 0 ? '+' : ''}
        {formatCurrency(order.roundingAdjustment)}
      </div>
    </div>
  )}

  {/* ✅ 新增: 实际应收金额(只在有抹零时显示) */}
  {order.roundingAdjustment !== 0 && (
    <div className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2">
      <span className="text-xs font-semibold text-gray-700">
        实际应收
      </span>
      <div className="text-lg font-bold text-purple-600">
        {formatCurrency(order.totalAmount + order.roundingAdjustment)}
      </div>
    </div>
  )}
</div>
```

#### 2.2 收款进度条修复

使用实际应收金额计算收款进度：

```typescript
{/* 收款进度条 */}
<div className="mb-3">
  <div className="mb-1 flex items-center justify-between">
    <span className="text-xs font-medium text-gray-600">
      收款进度
    </span>
    <span className="text-xs font-bold text-green-600">
      {order.totalAmount + order.roundingAdjustment > 0
        ? (
            (order.paidAmount /
              (order.totalAmount + order.roundingAdjustment)) *
            100
          ).toFixed(1)
        : '0.0'}
      %
    </span>
  </div>
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
    <div
      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
      style={{
        width: `${order.totalAmount + order.roundingAdjustment > 0 ? (order.paidAmount / (order.totalAmount + order.roundingAdjustment)) * 100 : 0}%`,
      }}
    ></div>
  </div>
</div>
```

## UI 效果

### 1. 顶部统计卡片

#### 无抹零的订单（4列布局）

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 订单总金额    │ 已收金额      │ 待收金额      │ 毛利金额      │
│ ¥500.00      │ ¥300.00      │ ¥200.00      │ ¥50.00       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### 有抹零的订单（5列布局）

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ 订单总金额    │ 抹零金额      │ 已收金额      │ 待收金额      │ 毛利金额      │
│ ¥361.00      │ -¥1.00       │ ¥360.00      │ ¥0.00        │ ¥50.00       │
│              │ (绿色)       │              │              │              │
│              │ 实际应收:     │              │              │              │
│              │ ¥360.00      │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 2. 收款记录区域

#### 订单金额总览（有抹零）

```
┌─────────────────────────────────────────────┐
│ 💰 订单总金额                    ¥361.00    │
├─────────────────────────────────────────────┤
│ 抹零金额                         -¥1.00     │
│                                  (绿色)     │
├─────────────────────────────────────────────┤
│ 实际应收                         ¥360.00    │
│                                  (紫色)     │
├─────────────────────────────────────────────┤
│ 收款进度                         100.0%     │
│ ████████████████████████████████            │
├─────────────────────────────────────────────┤
│ 已确认    │ 待确认    │ 待收款              │
│ ¥360.00   │ ¥0.00    │ ¥0.00              │
└─────────────────────────────────────────────┘
```

## 验证步骤

### 场景 1：创建带抹零的订单

1. **创建销售订单**：
   - 订单金额：361元
   - 抹零金额：-1元
   - 实际应收：360元

2. **创建收款记录**：
   - 收款金额：360元

3. **访问订单详情页面**：
   - ✅ 顶部显示5个卡片（包含抹零金额卡片）
   - ✅ 抹零金额卡片：-¥1.00（绿色背景）
   - ✅ 抹零金额卡片显示实际应收：¥360.00
   - ✅ 收款记录区域显示抹零金额：-¥1.00
   - ✅ 收款记录区域显示实际应收：¥360.00
   - ✅ 收款进度：100.0%（基于实际应收计算）

### 场景 2：无抹零的订单

1. **创建销售订单**：
   - 订单金额：500元
   - 抹零金额：0元

2. **访问订单详情页面**：
   - ✅ 顶部显示4个卡片（不显示抹零金额卡片）
   - ✅ 收款记录区域不显示抹零金额和实际应收
   - ✅ 收款进度基于订单总额计算

## 影响范围

### 修改的文件

- `app/(dashboard)/sales-orders/[id]/page.tsx` - 销售订单详情页面

### 受益的功能

- ✅ 顶部统计卡片显示抹零金额
- ✅ 收款记录区域显示抹零金额和实际应收
- ✅ 收款进度基于实际应收金额计算
- ✅ UI 自适应布局（有抹零时5列，无抹零时4列）
- ✅ 颜色规则统一（正数红色，负数绿色）

## 技术细节

### 1. 动态布局

使用条件渲染和动态 CSS 类实现自适应布局：

```typescript
className={`grid gap-4 md:grid-cols-2 ${order.roundingAdjustment !== 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
```

### 2. 条件渲染

只在有抹零时显示相关信息：

```typescript
{order.roundingAdjustment !== 0 && (
  // 抹零金额显示
)}
```

### 3. 颜色规则

- **正数抹零**（增加应收）：红色 `text-red-600`、`border-red-200`、`bg-red-50/50`
- **负数抹零**（减少应收）：绿色 `text-green-600`、`border-green-200`、`bg-green-50/50`

### 4. 实际应收金额计算

```typescript
const actualReceivable = order.totalAmount + order.roundingAdjustment;
```

### 5. 收款进度计算

基于实际应收金额计算：

```typescript
const progress = order.totalAmount + order.roundingAdjustment > 0
  ? (order.paidAmount / (order.totalAmount + order.roundingAdjustment)) * 100
  : 0;
```

## 相关文档

- [应收款缓存更新修复](./receivables-cache-invalidation-fix.md)
- [抹零金额计算修复](./rounding-adjustment-calculation-fix.md)
- [收款记录抹零显示修复](./payment-rounding-display-fix.md)

## 注意事项

1. **一致性**：
   - 与应收款页面和收款记录页面使用相同的显示逻辑
   - 保持 UI 风格统一

2. **性能**：
   - 使用条件渲染避免不必要的 DOM 元素
   - 动态布局不影响性能

3. **可维护性**：
   - 抹零显示逻辑清晰易懂
   - 易于理解和维护

4. **数据类型**：
   - `order.roundingAdjustment` 已经是 `number` 类型
   - 无需额外的类型转换

