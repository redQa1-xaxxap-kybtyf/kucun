# 销售订单详情"已收款金额"修复总结

## 问题描述

销售订单详情页面中"已收款金额"字段未正确显示,显示为 0 或 undefined。

## 根本原因

API 查询收款记录时缺少了两个关键字段:
- `actualPaymentAmount` - 实际到账金额
- `roundingAmount` - 收款抹零金额

导致后续计算时使用了 undefined 值,结果为 0。

## 修复内容

### 1. API 层面修复

**文件**: `app/api/sales-orders/[id]/route.ts`

**位置**: 第112-128行

**修改**: 在 `payments` 查询的 `select` 中添加两个字段

```diff
payments: {
  select: {
    id: true,
    paymentNumber: true,
    paymentAmount: true,
+   actualPaymentAmount: true, // ✅ 新增: 实际到账金额
+   roundingAmount: true, // ✅ 新增: 收款抹零金额
    paymentMethod: true,
    paymentDate: true,
    status: true,
    remarks: true,
    createdAt: true,
  },
  orderBy: {
    paymentDate: 'desc',
  },
},
```

### 2. 前端类型定义修复

**文件**: `app/(dashboard)/sales-orders/[id]/page.tsx`

**位置**: 第46-57行

**修改**: 在 `PaymentRecord` 接口中添加两个字段

```diff
interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
+ actualPaymentAmount: number; // ✅ 新增: 实际到账金额
+ roundingAmount: number; // ✅ 新增: 收款抹零金额
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}
```

### 3. 收款记录列表页面类型修复

**文件**: `app/(dashboard)/finance/payments/page-client.tsx`

**位置**: 第32-40行

**修改**: 在 `salesOrder` 接口中添加 `roundingAdjustment` 字段

```diff
salesOrder: {
  id: string;
  orderNumber: string;
  totalAmount: number;
+ roundingAdjustment: number; // ✅ 新增: 订单抹零金额
  paidAmount: number;
  pendingAmount: number;
  remainingAmount: number;
};
```

## 修复验证

### 编译检查

```bash
npm run type-check  # ✅ 通过
npm run lint        # ✅ 通过
npm run format      # ✅ 通过
```

### 功能验证

1. ✅ API 返回数据包含 `actualPaymentAmount` 和 `roundingAmount`
2. ✅ 前端页面正确显示已收款金额
3. ✅ 金额计算准确无误
4. ✅ 类型定义完整,无 TypeScript 错误

## 影响范围

### 修改的文件 (3个)

1. `app/api/sales-orders/[id]/route.ts` - API 查询逻辑
2. `app/(dashboard)/sales-orders/[id]/page.tsx` - 订单详情页面类型定义
3. `app/(dashboard)/finance/payments/page-client.tsx` - 收款记录列表页面类型定义

### 受益的功能

- ✅ 销售订单详情页面正确显示已收款金额
- ✅ 收款统计准确计算
- ✅ 待收金额计算正确
- ✅ 收款进度显示准确

### 不受影响的功能

- ✅ 收款记录创建/编辑功能
- ✅ 收款记录列表页面
- ✅ 财务报表统计
- ✅ 其他订单相关功能

## 数据流程

```
数据库 (PaymentRecord)
  ↓
  ├─ paymentAmount: 1000        (收款金额)
  ├─ actualPaymentAmount: 998   (实际到账)
  └─ roundingAmount: 2          (抹零金额)
  
API 查询 (GET /api/sales-orders/:id)
  ↓
  ├─ 查询 payments (包含 actualPaymentAmount, roundingAmount)
  ├─ 计算 actualPaidAmount = sum(actualPaymentAmount)
  ├─ 计算 paymentRounding = sum(roundingAmount)
  └─ 计算 paidAmount = actualPaidAmount + paymentRounding
  
API 返回
  ↓
  ├─ paymentRecords: [{ actualPaymentAmount, roundingAmount, ... }]
  ├─ actualPaidAmount: 998
  ├─ paymentRounding: 2
  ├─ paidAmount: 1000
  └─ remainingAmount: 0
  
前端显示
  ↓
  ├─ 已收金额卡片: ¥998.00 (actualPaidAmount)
  ├─ 收款抹零: ¥2.00 (paymentRounding)
  └─ 待收金额: ¥0.00 (remainingAmount)
```

## 关键公式

```typescript
// 1. 单条收款记录
paymentAmount = actualPaymentAmount + roundingAmount

// 2. 已收款汇总
actualPaidAmount = sum(confirmedPayments.actualPaymentAmount)
paymentRounding = sum(confirmedPayments.roundingAmount)
paidAmount = actualPaidAmount + paymentRounding

// 3. 待收金额
actualTotalAmount = totalAmount + roundingAdjustment
remainingAmount = actualTotalAmount - paidAmount
```

## 测试场景

### 场景1: 单笔收款(带抹零)

```
订单总额: ¥1,000.00
收款记录:
  - 收款金额: ¥1,000.00
  - 实际到账: ¥998.00
  - 抹零金额: ¥2.00

预期结果:
  - 已收金额: ¥998.00 ✅
  - 待收金额: ¥0.00 ✅
```

### 场景2: 多笔收款

```
订单总额: ¥2,000.00
收款记录:
  1. 实际到账: ¥998.00, 抹零: ¥2.00
  2. 实际到账: ¥995.00, 抹零: ¥5.00

预期结果:
  - 已收金额: ¥1,993.00 (998 + 995) ✅
  - 收款抹零: ¥7.00 (2 + 5) ✅
  - 等效已收: ¥2,000.00 ✅
  - 待收金额: ¥0.00 ✅
```

### 场景3: 待确认收款

```
订单总额: ¥1,000.00
收款记录:
  1. 已确认: 实际到账 ¥500.00
  2. 待确认: 实际到账 ¥500.00

预期结果:
  - 已收金额: ¥500.00 (只计算已确认) ✅
  - 待收金额: ¥500.00 ✅
```

## 相关文档

- [详细修复文档](.augment/fixes/sales-order-detail-paid-amount-fix.md)
- [验证指南](.augment/fixes/verify-paid-amount-fix.md)
- [收款抹零功能](.augment/fixes/payment-rounding-display-fix.md)
- [订单抹零功能](.augment/fixes/sales-order-detail-rounding-display-fix.md)

## 后续建议

1. **统一类型定义**: 将 `PaymentRecord` 接口定义移到 `lib/types/payment.ts` 中统一管理
2. **添加单元测试**: 为金额计算逻辑添加单元测试
3. **数据验证**: 添加前端数据验证,确保金额计算正确
4. **性能优化**: 考虑在数据库层面计算汇总,减少前端计算

## 提交信息

```
fix(sales-orders): 修复订单详情页面已收款金额未显示的问题

- 在 API 查询中添加 actualPaymentAmount 和 roundingAmount 字段
- 更新前端 PaymentRecord 接口定义
- 修复收款记录列表页面类型定义

问题: 销售订单详情页面"已收款金额"显示为 0
原因: API 查询缺少关键字段,导致计算结果为 undefined
影响: 用户无法查看订单的实际收款情况

修复文件:
- app/api/sales-orders/[id]/route.ts
- app/(dashboard)/sales-orders/[id]/page.tsx
- app/(dashboard)/finance/payments/page-client.tsx

测试: ✅ TypeScript 编译通过
测试: ✅ ESLint 检查通过
测试: ✅ 功能验证通过
```

## 完成时间

2024-01-XX XX:XX:XX

## 修复人员

AI Assistant (Augment Agent)

