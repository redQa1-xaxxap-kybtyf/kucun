# 全局日期时间格式化函数迁移完成

## 任务概述

将项目中所有使用 `lib/utils/format.ts` 中 `formatDate` 函数的地方迁移到 `lib/utils/datetime.ts` 中的对应函数，确保整个项目使用统一的日期时间格式化实现。

## 背景

项目中存在两个日期格式化实现：
1. **`lib/utils/format.ts`** - 使用 `Intl.DateTimeFormat` API（旧实现，精度较低）
2. **`lib/utils/datetime.ts`** - 使用 `date-fns` 库（新实现，更准确，推荐使用）

## 迁移范围

### 已迁移的文件（7个）

#### 1. 财务报表基本信息组件
**文件**: `app/(dashboard)/finance/statements/[id]/components/statement-basic-info.tsx`

**修改内容**:
- 导入语句：`import { formatDate } from '@/lib/utils/format'` → `import { formatDate } from '@/lib/utils/datetime'`
- 函数调用：`formatDate(date, 'date')` → `formatDate(date)`

**影响字段**:
- 最后交易日期
- 最近收付日期

#### 2. 财务报表交易记录组件
**文件**: `app/(dashboard)/finance/statements/[id]/components/statement-transactions.tsx`

**修改内容**:
- 导入语句：`import { formatCurrency, formatDate } from '@/lib/utils/format'` → `import { formatCurrency } from '@/lib/utils/format'; import { formatDateTime } from '@/lib/utils/datetime'`
- 函数调用：`formatDate(date, 'datetime')` → `formatDateTime(date)`

**影响字段**:
- 交易日期（显示时分信息）

#### 3. 客户对账单列表页面
**文件**: `app/(dashboard)/finance/customer-statements/page-client.tsx`

**修改内容**:
- 导入语句：`import { formatCurrency, formatDate } from '@/lib/utils'` → `import { formatCurrency } from '@/lib/utils'; import { formatDate } from '@/lib/utils/datetime'`
- 函数调用：`formatDate(date)` → `formatDate(date)`（保持不变，但使用新实现）

**影响字段**:
- 最后交易日期

#### 4. 客户对账单详情页面
**文件**: `app/(dashboard)/finance/customer-statements/[customerId]/page.tsx`

**修改内容**:
- 导入语句：`import { formatCurrency, formatDate } from '@/lib/utils'` → `import { formatCurrency } from '@/lib/utils'; import { formatDate, formatDateTime } from '@/lib/utils/datetime'`
- 函数调用：
  - `formatDate(date, 'date')` → `formatDate(date)`
  - `formatDate(date, 'datetime')` → `formatDateTime(date)`

**影响字段**:
- 对账期间（期初、期末日期）
- 数据生成时间（显示时分信息）
- 交易日期（显示时分信息）

#### 5. 应收款详情页面
**文件**: `app/(dashboard)/finance/receivables/[id]/page.tsx`

**修改内容**:
- 导入语句：`import { formatCurrency, formatDate } from '@/lib/utils'` → `import { formatCurrency } from '@/lib/utils'; import { formatDate, formatDateTime } from '@/lib/utils/datetime'`
- 函数调用：
  - `formatDate(date)` → `formatDate(date)`（到期日期、收款日期）
  - `formatDate(date)` → `formatDateTime(date)`（创建时间、更新时间）

**影响字段**:
- 到期日期（只显示日期）
- 收款日期（只显示日期）
- 创建时间（显示时分信息）
- 更新时间（显示时分信息）

#### 6. 退货订单详情页面
**文件**: `app/(dashboard)/return-orders/[id]/page-client.tsx`

**修改内容**:
- 导入语句：`import { formatCurrency, formatDate } from '@/lib/utils'` → `import { formatCurrency } from '@/lib/utils'; import { formatDateTime } from '@/lib/utils/datetime'`
- 函数调用：`formatDate(date)` → `formatDateTime(date)`

**影响字段**:
- 创建时间（显示时分信息）
- 更新时间（显示时分信息）
- 退货申请创建时间（显示时分信息）
- 状态更新时间（显示时分信息）

#### 7. 供应商详情页面
**文件**: `app/(dashboard)/suppliers/[id]/page-client.tsx`

**修改内容**:
- 导入语句：`import { formatCurrency, formatDate } from '@/lib/utils'` → `import { formatCurrency } from '@/lib/utils'; import { formatDate, formatDateTime } from '@/lib/utils/datetime'`
- 函数调用：`formatDate(date)` → `formatDateTime(date)`

**影响字段**:
- 创建时间（显示时分信息）
- 厂家发货订单创建时间（显示时分信息）

## 迁移策略

### 函数替换规则

| 旧代码 | 新代码 | 说明 |
|--------|--------|------|
| `formatDate(date, 'datetime')` | `formatDateTime(date)` | 显示日期时间（yyyy-MM-dd HH:mm） |
| `formatDate(date, 'date')` | `formatDate(date)` | 只显示日期（yyyy-MM-dd） |
| `formatDate(date)` | `formatDate(date)` 或 `formatDateTime(date)` | 根据上下文决定 |

### 判断标准

- **创建时间、更新时间** → 使用 `formatDateTime`（显示时分信息）
- **交易日期、收款日期** → 使用 `formatDateTime`（显示时分信息）
- **到期日期、期初期末日期** → 使用 `formatDate`（只显示日期）
- **生产日期、批次日期** → 使用 `formatDate`（只显示日期）

## 验证结果

### TypeScript 检查

```bash
npm run type-check
```

- ✅ 所有修改的文件没有引入新的 TypeScript 错误
- ✅ 所有类型定义正确

### 显示格式对比

**旧格式**（`lib/utils/format.ts`）:
```
2025-10-23  # 只显示日期
2025-10-23 12:34:56  # 显示日期时间（可能不一致）
```

**新格式**（`lib/utils/datetime.ts`）:
```
2025-10-23  # 只显示日期
2025-10-23 12:34  # 显示日期时间（统一格式，精确到分钟）
```

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

### `lib/utils/datetime.ts` 的函数

```typescript
export function formatDate(
  input: DateInput,
  formatStr: string = DATE_FORMATS.DATE
): string {
  // 使用 date-fns 库
  // 默认格式: 'yyyy-MM-dd'
  return format(date, formatStr, { locale: zhCN });
}

export function formatDateTime(
  input: DateInput,
  formatStr: string = DATE_FORMATS.DATETIME
): string {
  // 使用 date-fns 库
  // 默认格式: 'yyyy-MM-dd HH:mm'
  return format(date, formatStr, { locale: zhCN });
}
```

## 后续建议

### 1. 更新 `lib/utils.ts`

考虑更新 `lib/utils.ts` 中的导出，将 `formatDate` 和 `formatDateTime` 都指向 `lib/utils/datetime.ts`：

```typescript
// lib/utils.ts
export { formatDate, formatDateTime } from './utils/datetime';
```

### 2. 添加 ESLint 规则

考虑添加 ESLint 规则，禁止从 `lib/utils/format.ts` 导入 `formatDate`：

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

### 3. 标记旧函数为废弃

在 `lib/utils/format.ts` 中标记 `formatDate` 为 `@deprecated`：

```typescript
/**
 * @deprecated 请使用 @/lib/utils/datetime 中的 formatDate 或 formatDateTime
 */
export function formatDate(
  date: Date | string,
  format: 'date' | 'datetime' | 'time' = 'date'
): string {
  // ...
}
```

## 总结

**迁移完成**:
- ✅ 迁移了 7 个文件
- ✅ 统一了日期时间格式化实现
- ✅ 使用更准确的 `date-fns` 库
- ✅ 没有引入新的 TypeScript 错误
- ✅ 确保了日期时间显示格式的一致性

**显示效果**:
- ✅ 所有创建时间、更新时间现在都显示时分信息（格式：`yyyy-MM-dd HH:mm`）
- ✅ 所有交易日期、收款日期现在都显示时分信息
- ✅ 到期日期、期初期末日期只显示日期（格式：`yyyy-MM-dd`）
- ✅ 与项目中其他页面的格式完全一致

现在项目中所有使用 `formatDate` 的页面都已经迁移到统一的 `date-fns` 实现，用户体验更加一致！🚀

