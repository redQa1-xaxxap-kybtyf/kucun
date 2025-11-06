# 销售订单详情页面"已收款金额"字段显示修复

## 问题描述

销售订单详情页面中"已收款金额"字段未正确显示,原因是 API 查询时缺少了关键字段。

## 问题根源

### API 层面 (`app/api/sales-orders/[id]/route.ts`)

**问题**: 第112-126行的 `payments` 查询中缺少了两个关键字段:

- ❌ 缺少 `actualPaymentAmount` - 实际到账金额
- ❌ 缺少 `roundingAmount` - 收款抹零金额

**影响**: 导致第154-157行的计算使用了未查询的字段,结果为 `undefined` 或 `0`:

```typescript
// 第154-157行的计算依赖这两个字段
const actualPaidAmount = confirmedPayments.reduce(
  (sum, record) => sum + Number(record.actualPaymentAmount), // ❌ undefined
  0
);
const paymentRounding = confirmedPayments.reduce(
  (sum, record) => sum + Number(record.roundingAmount || 0), // ❌ undefined
  0
);
```

### 前端层面 (`app/(dashboard)/sales-orders/[id]/page.tsx`)

**问题**: 第46-55行的 `PaymentRecord` 接口定义缺少了这两个字段:

```typescript
interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  // ❌ 缺少 actualPaymentAmount
  // ❌ 缺少 roundingAmount
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}
```

## 修复方案

### 1. API 层面修复

**文件**: `app/api/sales-orders/[id]/route.ts`

**修改位置**: 第112-126行

**修改内容**: 在 `payments` 查询的 `select` 中添加两个字段:

```typescript
payments: {
  select: {
    id: true,
    paymentNumber: true,
    paymentAmount: true,
    actualPaymentAmount: true, // ✅ 新增: 实际到账金额
    roundingAmount: true, // ✅ 新增: 收款抹零金额
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

### 2. 前端层面修复

**文件**: `app/(dashboard)/sales-orders/[id]/page.tsx`

**修改位置**: 第46-55行

**修改内容**: 在 `PaymentRecord` 接口中添加两个字段:

```typescript
interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number; // ✅ 新增: 实际到账金额
  roundingAmount: number; // ✅ 新增: 收款抹零金额
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}
```

## 数据流程说明

### 1. 数据库层 (Prisma Schema)

```prisma
model PaymentRecord {
  id                  String   @id @default(uuid())
  paymentNumber       String   @unique
  paymentAmount       Float    // 收款金额 = 实际到账 + 抹零
  actualPaymentAmount Float    @default(0) // 实际到账金额
  roundingAmount      Float    @default(0) // 抹零金额(正数表示冲减)
  // ... 其他字段
}
```

### 2. API 层计算逻辑

```typescript
// 第152-166行: 计算收款统计
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
```

### 3. API 返回数据结构

```typescript
{
  success: true,
  data: {
    ...salesOrder,
    paymentRecords: salesOrder.payments, // 包含 actualPaymentAmount 和 roundingAmount
    actualPaidAmount,    // 实际到账金额汇总
    paymentRounding,     // 收款抹零金额汇总
    paidAmount,          // 等效已收款(到账+抹零)
    remainingAmount,     // 待收金额
  }
}
```

### 4. 前端显示

**顶部统计卡片** (第612-630行):

```typescript
<Card className="border border-green-200 bg-green-50/50">
  <CardContent className="p-4">
    <div className="text-xs font-medium text-gray-600">已收金额</div>
    <div className="mt-2 text-2xl font-bold text-green-600">
      {formatCurrency(order.actualPaidAmount)} {/* ✅ 显示实际到账金额汇总 */}
    </div>
    <div className="mt-1 text-xs text-gray-500">
      实际到账{' '}
      {order.paymentRecords.filter(r => r.status === 'confirmed').length} 笔
    </div>
  </CardContent>
</Card>
```

**收款记录列表** (第1545-1618行):

```typescript
{order.paymentRecords
  .filter(r => r.status === 'confirmed')
  .map((record, index) => (
    <div key={record.id}>
      <div className="text-lg font-bold text-gray-900">
        {formatCurrency(record.paymentAmount)} {/* ✅ 显示单条记录的收款金额 */}
      </div>
      {/* 可以进一步显示 actualPaymentAmount 和 roundingAmount 的明细 */}
    </div>
  ))
}
```

## 字段说明

### PaymentRecord 字段含义

| 字段名                | 类型  | 说明                    | 示例    |
| --------------------- | ----- | ----------------------- | ------- |
| `paymentAmount`       | Float | 收款金额(记录金额)      | 1000.00 |
| `actualPaymentAmount` | Float | 实际到账金额            | 998.00  |
| `roundingAmount`      | Float | 收款抹零金额(优惠/减免) | 2.00    |

**关系**: `paymentAmount = actualPaymentAmount + roundingAmount`

### SalesOrderDetail 汇总字段

| 字段名             | 类型   | 说明             | 计算方式                                   |
| ------------------ | ------ | ---------------- | ------------------------------------------ |
| `actualPaidAmount` | number | 实际到账金额汇总 | sum(confirmedPayments.actualPaymentAmount) |
| `paymentRounding`  | number | 收款抹零金额汇总 | sum(confirmedPayments.roundingAmount)      |
| `paidAmount`       | number | 等效已收款       | actualPaidAmount + paymentRounding         |
| `remainingAmount`  | number | 待收金额         | actualTotalAmount - paidAmount             |

## 测试验证

### 1. API 测试

```bash
# 获取销售订单详情
curl -X GET http://localhost:3000/api/sales-orders/{id} \
  -H "Cookie: your-session-cookie"

# 验证返回数据包含:
# - paymentRecords[].actualPaymentAmount
# - paymentRecords[].roundingAmount
# - actualPaidAmount
# - paymentRounding
# - paidAmount
```

### 2. 前端测试

1. 访问销售订单详情页面
2. 检查顶部"已收金额"卡片是否正确显示
3. 检查收款记录列表是否正确显示
4. 验证金额计算是否正确

### 3. 数据一致性验证

```typescript
// 验证公式:
actualPaidAmount + paymentRounding === paidAmount;
totalAmount + roundingAdjustment - paidAmount === remainingAmount;
```

## 影响范围

### 修改的文件

1. `app/api/sales-orders/[id]/route.ts` - API 查询逻辑
2. `app/(dashboard)/sales-orders/[id]/page.tsx` - 前端类型定义

### 受益的功能

- ✅ 销售订单详情页面正确显示已收款金额
- ✅ 收款统计准确计算
- ✅ 待收金额计算正确
- ✅ 收款进度显示准确

### 不受影响的功能

- ✅ 收款记录创建/编辑功能
- ✅ 收款记录列表页面
- ✅ 财务报表统计

## 相关文档

- [收款抹零功能说明](.augment/fixes/payment-rounding-display-fix.md)
- [订单抹零功能说明](.augment/fixes/sales-order-detail-rounding-display-fix.md)
- [Prisma Schema - PaymentRecord 模型](prisma/schema.prisma#L585-L625)

## 注意事项

1. **字段命名一致性**: 确保 API 返回的字段名与前端接口定义一致
2. **类型安全**: 使用 TypeScript 类型定义确保数据结构正确
3. **空值处理**: 使用 `|| 0` 处理可能的 null/undefined 值
4. **精度处理**: 金额计算使用 `Number()` 转换确保精度

## 后续优化建议

1. **收款记录明细显示**: 在收款记录列表中显示 `actualPaymentAmount` 和 `roundingAmount` 的明细
2. **统一类型定义**: 将 `PaymentRecord` 接口定义移到 `lib/types/payment.ts` 中统一管理
3. **数据验证**: 添加前端数据验证,确保 `paymentAmount = actualPaymentAmount + roundingAmount`
