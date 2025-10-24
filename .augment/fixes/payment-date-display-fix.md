# 销售订单详情页面收款日期显示修复

## 修复日期
2024-01-XX

## 问题描述

销售订单详情页面中收款记录的收款日期显示不正确，时分秒信息丢失或显示异常。

### 问题表现

- 收款日期只显示日期部分，没有时分秒
- 或者显示格式异常，无法正确解析

### 根本原因

API 在返回收款记录数据时，直接使用了 Prisma 查询结果中的 `payments` 数组，但没有将其中的 `Date` 对象转换为 ISO 字符串格式。

**问题代码** (`app/api/sales-orders/[id]/route.ts` 第188行):

```typescript
paymentRecords: salesOrder.payments,  // ❌ 错误: Date 对象未转换
```

Prisma 返回的数据结构:
```typescript
{
  paymentDate: Date,      // Date 对象
  createdAt: Date,        // Date 对象
  // ... 其他字段
}
```

前端期望的数据结构:
```typescript
{
  paymentDate: string,    // ISO 字符串 "2024-01-15T10:30:00.000Z"
  createdAt: string,      // ISO 字符串 "2024-01-15T10:30:00.000Z"
  // ... 其他字段
}
```

## 修复方案

### API 层面修复

**文件**: `app/api/sales-orders/[id]/route.ts`

**修改位置**: 第175-199行

**修改前**:
```typescript
const { returnOrders, ...rest } = salesOrder;

return NextResponse.json({
  success: true,
  data: {
    ...rest,
    hasReturnOrder: returnOrders.length > 0,
    returnOrders: returnOrders.map(order => ({
      id: order.id,
      returnNumber: order.returnNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
    paymentRecords: salesOrder.payments,  // ❌ 错误: Date 对象未转换
    actualPaidAmount,
    paymentRounding,
    paidAmount,
    remainingAmount,
  },
});
```

**修改后**:
```typescript
const { returnOrders, ...rest } = salesOrder;

return NextResponse.json({
  success: true,
  data: {
    ...rest,
    hasReturnOrder: returnOrders.length > 0,
    returnOrders: returnOrders.map(order => ({
      id: order.id,
      returnNumber: order.returnNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
    // ✅ 修复: 转换收款记录中的 Date 对象为 ISO 字符串
    paymentRecords: salesOrder.payments.map(payment => ({
      ...payment,
      paymentDate: payment.paymentDate.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    })),
    actualPaidAmount,
    paymentRounding,
    paidAmount,
    remainingAmount,
  },
});
```

**改进点**:
- ✅ 将 `paymentDate` 从 Date 对象转换为 ISO 字符串
- ✅ 将 `createdAt` 从 Date 对象转换为 ISO 字符串
- ✅ 保持与其他时间字段的格式一致

## 数据流程

### 修复前

```
数据库 (Prisma)
  ↓
  paymentDate: Date 对象
  createdAt: Date 对象
  ↓
API 返回 (未转换)
  ↓
  paymentDate: Date 对象 (序列化为字符串,但格式不标准)
  createdAt: Date 对象 (序列化为字符串,但格式不标准)
  ↓
前端解析
  ↓
  formatDateTime() 解析失败或格式异常
  ↓
显示异常
```

### 修复后

```
数据库 (Prisma)
  ↓
  paymentDate: Date 对象
  createdAt: Date 对象
  ↓
API 转换
  ↓
  paymentDate: "2024-01-15T10:30:00.000Z" (ISO 字符串)
  createdAt: "2024-01-15T10:30:00.000Z" (ISO 字符串)
  ↓
API 返回
  ↓
前端解析
  ↓
  formatDateTime() 正确解析
  ↓
显示: "2024-01-15 10:30"
```

## 时间格式说明

### ISO 8601 标准格式

```
2024-01-15T10:30:00.000Z
│    │  │  │  │  │  │   │
│    │  │  │  │  │  │   └─ UTC 时区标识
│    │  │  │  │  │  └───── 毫秒
│    │  │  │  │  └──────── 秒
│    │  │  │  └─────────── 分钟
│    │  │  └────────────── 小时
│    │  └───────────────── 日
│    └──────────────────── 月
└───────────────────────── 年
```

### 前端显示格式

使用 `formatDateTime()` 函数 (默认格式: `yyyy-MM-dd HH:mm`):

```
输入: "2024-01-15T10:30:00.000Z"
输出: "2024-01-15 10:30"
```

## 相关代码

### 前端时间格式化函数

**文件**: `lib/utils/datetime.ts`

```typescript
export function formatDateTime(
  input: DateInput,
  formatStr: string = DATE_FORMATS.DATETIME
): string {
  const date = parseDate(input);
  if (!date) {
    return '';
  }

  try {
    return format(date, formatStr, { locale: zhCN });
  } catch {
    return '';
  }
}
```

**默认格式**: `DATE_FORMATS.DATETIME = 'yyyy-MM-dd HH:mm'`

### 前端类型定义

**文件**: `app/(dashboard)/sales-orders/[id]/page.tsx`

```typescript
interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;  // ISO 字符串
  status: string;
  remarks?: string;
  createdAt: string;    // ISO 字符串
}
```

### 前端显示代码

**文件**: `app/(dashboard)/sales-orders/[id]/page.tsx`

```typescript
<div>
  <span className="text-gray-600">收款日期</span>
  <div className="mt-0.5 font-medium text-gray-800">
    {formatDateTime(record.paymentDate)}
  </div>
</div>
```

## 测试验证

### 测试场景

#### 场景1: 单笔收款记录

```
数据库存储:
  paymentDate: 2024-01-15 10:30:00

API 返回:
  paymentDate: "2024-01-15T10:30:00.000Z"

前端显示:
  收款日期: 2024-01-15 10:30
```

#### 场景2: 多笔收款记录

```
数据库存储:
  第1笔: 2024-01-15 10:30:00
  第2笔: 2024-01-16 14:45:00

API 返回:
  第1笔: "2024-01-15T10:30:00.000Z"
  第2笔: "2024-01-16T14:45:00.000Z"

前端显示:
  第1笔 收款日期: 2024-01-15 10:30
  第2笔 收款日期: 2024-01-16 14:45
```

### 验证步骤

1. **API 测试**:
```bash
curl -X GET http://localhost:3000/api/sales-orders/{id} \
  -H "Cookie: your-session-cookie" | jq '.data.paymentRecords[0].paymentDate'

# 预期输出: "2024-01-15T10:30:00.000Z"
```

2. **前端测试**:
- 打开销售订单详情页面
- 滚动到收款记录区域
- 检查收款日期显示格式
- 预期: "2024-01-15 10:30"

3. **浏览器控制台验证**:
```javascript
// 检查 API 返回的数据
fetch('/api/sales-orders/{id}')
  .then(res => res.json())
  .then(data => {
    console.log(data.data.paymentRecords[0].paymentDate);
    // 预期: "2024-01-15T10:30:00.000Z"
  });
```

## 影响范围

### 修改的文件

1. `app/api/sales-orders/[id]/route.ts` - API 返回数据格式化

### 受益的功能

- ✅ 销售订单详情页面收款记录显示
- ✅ 收款日期时分秒信息正确显示
- ✅ 时间格式统一，便于维护

### 不受影响的功能

- ✅ 收款记录创建/编辑功能
- ✅ 收款记录列表页面
- ✅ 其他订单相关功能

## 最佳实践

### API 返回时间字段的标准做法

1. **统一使用 ISO 8601 格式**:
```typescript
{
  createdAt: date.toISOString(),
  updatedAt: date.toISOString(),
  paymentDate: date.toISOString(),
}
```

2. **使用 DateTimeTransformer 工具类**:
```typescript
import { DateTimeTransformer } from '@/lib/utils/datetime';

const formattedData = DateTimeTransformer.transformObject(
  data,
  ['createdAt', 'updatedAt', 'paymentDate']
);
```

3. **前端统一使用 formatDateTime 函数**:
```typescript
import { formatDateTime } from '@/lib/utils/datetime';

{formatDateTime(record.paymentDate)}
```

## 验证清单

- [x] API 返回数据中 paymentDate 为 ISO 字符串
- [x] API 返回数据中 createdAt 为 ISO 字符串
- [x] TypeScript 编译通过
- [x] 前端类型定义正确
- [ ] 前端页面显示测试
- [ ] 多笔收款记录测试
- [ ] 时区处理测试

## 相关文档

- [时间处理工具函数文档](lib/utils/datetime.ts)
- [ISO 8601 标准](https://en.wikipedia.org/wiki/ISO_8601)
- [date-fns 文档](https://date-fns.org/)

## 后续建议

1. **统一时间字段处理**: 在所有 API 返回中统一使用 `toISOString()` 转换时间字段
2. **使用工具类**: 考虑使用 `DateTimeTransformer` 工具类自动转换时间字段
3. **添加单元测试**: 为时间格式化函数添加单元测试
4. **时区处理**: 考虑添加时区转换功能，支持不同时区的用户

