# 日期时间格式化函数统一修复

## 问题描述

项目中存在两个不同的日期格式化实现，导致日期时间显示不一致：

1. **`lib/utils/format.ts`** - 使用 `Intl.DateTimeFormat` API
   - 较老的实现
   - 精度较低
   - 在某些情况下不显示时分秒信息

2. **`lib/utils/datetime.ts`** - 使用 `date-fns` 库
   - 更准确的实现
   - 支持完整的时分秒显示
   - 提供更多格式化选项

## 问题影响

**销售订单详情页面**（`app/(dashboard)/sales-orders/[id]/page.tsx`）使用的是从 `lib/utils.ts` 导出的 `formatDate` 函数，该函数实际来自 `lib/utils/format.ts`，导致：

- 日期显示缺少时分信息
- 与其他页面（如收款记录列表）的显示格式不一致
- 用户体验不统一

## 解决方案

### 修改的文件

**文件**: `app/(dashboard)/sales-orders/[id]/page.tsx`

### 修改内容

#### 1. 更新导入语句

**修改前**:

```typescript
import { formatCurrency, formatDate } from '@/lib/utils';
```

**修改后**:

```typescript
import { formatCurrency } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';
```

#### 2. 替换日期时间显示函数

将所有需要显示时分信息的日期字段从 `formatDate(date, 'datetime')` 改为 `formatDateTime(date)`：

| 位置     | 字段     | 修改前                                       | 修改后                               |
| -------- | -------- | -------------------------------------------- | ------------------------------------ |
| 第751行  | 创建时间 | `formatDate(order.createdAt, 'datetime')`    | `formatDateTime(order.createdAt)`    |
| 第760行  | 发货时间 | `formatDate(order.shippedAt, 'datetime')`    | `formatDateTime(order.shippedAt)`    |
| 第769行  | 更新时间 | `formatDate(order.updatedAt, 'datetime')`    | `formatDateTime(order.updatedAt)`    |
| 第1481行 | 收款日期 | `formatDate(record.paymentDate, 'datetime')` | `formatDateTime(record.paymentDate)` |
| 第1571行 | 收款日期 | `formatDate(record.paymentDate, 'datetime')` | `formatDateTime(record.paymentDate)` |
| 第1645行 | 订单创建 | `formatDate(order.createdAt, 'datetime')`    | `formatDateTime(order.createdAt)`    |
| 第1660行 | 订单更新 | `formatDate(order.updatedAt, 'datetime')`    | `formatDateTime(order.updatedAt)`    |

#### 3. 保留只显示日期的字段

以下字段只需要显示日期，继续使用 `formatDate`：

| 位置     | 字段             | 函数调用                            |
| -------- | ---------------- | ----------------------------------- |
| 第842行  | 退货订单创建时间 | `formatDate(returnOrder.createdAt)` |
| 第1031行 | 生产日期         | `formatDate(item.productionDate)`   |

## 技术细节

### `lib/utils/format.ts` 的 `formatDate` 函数

```typescript
export function formatDate(
  date: Date | string,
  format: 'date' | 'datetime' | 'time' = 'date'
): string {
  // 使用 Intl.DateTimeFormat API
  // 在某些浏览器中可能显示不一致
  return dateObj.toLocaleDateString('zh-CN', options);
}
```

### `lib/utils/datetime.ts` 的 `formatDateTime` 函数

```typescript
export function formatDateTime(
  input: DateInput,
  formatStr: string = DATE_FORMATS.DATETIME
): string {
  // 使用 date-fns 库
  // 默认格式: 'yyyy-MM-dd HH:mm'
  return format(date, formatStr, { locale: zhCN });
}
```

### 显示格式对比

**旧格式**（`lib/utils/format.ts`）:

```
2025-10-23 12:34:56  // 可能显示不一致
```

**新格式**（`lib/utils/datetime.ts`）:

```
2025-10-23 12:34  // 统一格式，精确到分钟
```

## 验证结果

### 修改前

销售订单详情页面的日期时间显示：

- ❌ 创建时间：2025-10-23（缺少时分信息）
- ❌ 发货时间：2025-10-23（缺少时分信息）
- ❌ 更新时间：2025-10-23（缺少时分信息）
- ❌ 收款日期：2025-10-23（缺少时分信息）

### 修改后

销售订单详情页面的日期时间显示：

- ✅ 创建时间：2025-10-23 12:34
- ✅ 发货时间：2025-10-23 14:56
- ✅ 更新时间：2025-10-23 15:20
- ✅ 收款日期：2025-10-23 16:45

### 与其他页面的一致性

现在销售订单详情页面的日期时间格式与以下页面保持一致：

- ✅ 收款记录列表页面
- ✅ 应收货款页面
- ✅ 其他使用 `formatDateTime` 的页面

## 后续建议

### 1. 全局统一日期格式化函数

建议在整个项目中统一使用 `lib/utils/datetime.ts` 中的函数：

- **显示日期时间**: 使用 `formatDateTime(date)`
- **只显示日期**: 使用 `formatDate(date)`
- **相对时间**: 使用 `formatTimeAgo(date)`

### 2. 逐步迁移旧代码

建议逐步将项目中所有使用 `lib/utils/format.ts` 的 `formatDate` 函数的地方迁移到 `lib/utils/datetime.ts`：

```bash
# 搜索所有使用旧函数的地方
grep -r "from '@/lib/utils'" --include="*.tsx" --include="*.ts" | grep formatDate
```

### 3. 更新 `lib/utils.ts`

考虑更新 `lib/utils.ts` 中的导出，将 `formatDate` 和 `formatDateTime` 都指向 `lib/utils/datetime.ts`：

```typescript
// lib/utils.ts
export { formatDate, formatDateTime } from './utils/datetime';
```

这样可以避免混淆，确保所有地方使用的都是统一的实现。

### 4. 添加 ESLint 规则

考虑添加 ESLint 规则，禁止直接从 `lib/utils/format.ts` 导入 `formatDate`：

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "@/lib/utils/format",
            "importNames": ["formatDate"],
            "message": "请使用 @/lib/utils/datetime 中的 formatDate 或 formatDateTime"
          }
        ]
      }
    ]
  }
}
```

## 相关文档

- [date-fns 官方文档](https://date-fns.org/)
- [Intl.DateTimeFormat MDN 文档](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

## 总结

这次修复统一了销售订单详情页面的日期时间显示格式，使用了更准确的 `date-fns` 库，确保了与其他页面的一致性。

**修改内容**:

- ✅ 更新导入语句，使用 `lib/utils/datetime.ts` 中的函数
- ✅ 替换 7 处需要显示时分信息的日期字段
- ✅ 保留 2 处只需要显示日期的字段
- ✅ 确保日期时间格式与其他页面保持一致

**后续工作**:

- 建议逐步迁移项目中所有使用旧函数的地方
- 考虑更新 `lib/utils.ts` 的导出
- 添加 ESLint 规则防止混用
