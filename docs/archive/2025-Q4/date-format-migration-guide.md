# 日期格式统一迁移指南

> 详细的迁移步骤和代码示例，确保日期格式统一为 `YYYY-MM-DD HH:mm:ss`

**目标**: 将所有日期时间统一为包含完整时分秒的格式  
**原则**: 使用统一工具函数，禁止直接使用原生 JS 方法

---

## 📋 目录

1. [迁移前准备](#迁移前准备)
2. [核心修改](#核心修改)
3. [常见替换模式](#常见替换模式)
4. [分模块迁移](#分模块迁移)
5. [验证测试](#验证测试)

---

## 🔧 一、迁移前准备

### 1.1 备份当前代码

```bash
# 创建新分支
git checkout -b feat/unify-date-format

# 确保工作区干净
git status
```

### 1.2 安装依赖（如果需要）

```bash
# 确保 date-fns 已安装
npm install date-fns@^4.1.0
```

### 1.3 熟悉统一工具函数

**位置**: `lib/utils/datetime.ts`

**核心函数**:

```typescript
import {
  formatDate, // 格式化日期: yyyy-MM-dd
  formatDateTime, // 格式化日期时间: yyyy-MM-dd HH:mm:ss
  formatTimeAgo, // 相对时间: X分钟前
  toISOString, // ISO格式: 2025-01-14T10:30:45.000Z
  DATE_FORMATS, // 格式常量
} from '@/lib/utils/datetime';
```

---

## 🎯 二、核心修改

### 2.1 修改 `datetime.ts` 默认格式

**文件**: `lib/utils/datetime.ts`

**修改内容**:

```typescript
// 修改前
export const DATE_FORMATS = {
  DATE: 'yyyy-MM-dd',
  DATETIME: 'yyyy-MM-dd HH:mm', // ❌ 缺少秒
  DATETIME_FULL: 'yyyy-MM-dd HH:mm:ss',
  TIME: 'HH:mm',
  DATE_CN: 'yyyy年MM月dd日',
  DATETIME_CN: 'yyyy年MM月dd日 HH:mm',
  DATETIME_FULL_CN: 'yyyy年MM月dd日 HH:mm:ss',
} as const;

// 修改后
export const DATE_FORMATS = {
  DATE: 'yyyy-MM-dd',
  DATETIME: 'yyyy-MM-dd HH:mm:ss', // ✅ 包含秒（默认格式）
  DATETIME_SHORT: 'yyyy-MM-dd HH:mm', // ✅ 新增短格式（特殊场景）
  DATETIME_FULL: 'yyyy-MM-dd HH:mm:ss', // 保持不变
  TIME: 'HH:mm:ss', // ✅ 包含秒
  TIME_SHORT: 'HH:mm', // ✅ 新增短格式
  DATE_CN: 'yyyy年MM月dd日',
  DATETIME_CN: 'yyyy年MM月dd日 HH:mm:ss', // ✅ 包含秒
  DATETIME_SHORT_CN: 'yyyy年MM月dd日 HH:mm', // ✅ 新增短格式
  DATETIME_FULL_CN: 'yyyy年MM月dd日 HH:mm:ss',
} as const;
```

**影响**: 修改后，所有使用 `formatDateTime()` 的地方会自动显示秒。

---

## 🔄 三、常见替换模式

### 3.1 替换 `toLocaleString()`

#### ❌ 错误示例

```typescript
// 问题：格式不可控，输出 "2025/1/14 10:30:45"
new Date(payment.createdAt).toLocaleString('zh-CN');

// 问题：缺少时间配置
new Date(payment.createdAt).toLocaleString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
```

#### ✅ 正确示例

```typescript
import { formatDateTime, DATE_FORMATS } from '@/lib/utils/datetime';

// 方案 1: 使用默认格式（推荐）
formatDateTime(payment.createdAt);
// 输出: "2025-01-14 10:30:45"

// 方案 2: 使用完整格式常量
formatDateTime(payment.createdAt, DATE_FORMATS.DATETIME_FULL);
// 输出: "2025-01-14 10:30:45"

// 方案 3: 使用中文格式
formatDateTime(payment.createdAt, DATE_FORMATS.DATETIME_CN);
// 输出: "2025年01月14日 10:30:45"
```

### 3.2 替换 `toLocaleDateString()`

#### ❌ 错误示例

```typescript
// 问题：只有日期，缺少时间
new Date(order.createdAt).toLocaleDateString('zh-CN');
// 输出: "2025/1/14"
```

#### ✅ 正确示例

```typescript
import { formatDate, formatDateTime, DATE_FORMATS } from '@/lib/utils/datetime';

// 方案 1: 如果确实只需要日期
formatDate(order.createdAt);
// 输出: "2025-01-14"

// 方案 2: 如果需要完整时间（推荐用于 createdAt/updatedAt）
formatDateTime(order.createdAt);
// 输出: "2025-01-14 10:30:45"
```

### 3.3 替换直接使用 `format()`

#### ❌ 错误示例

```typescript
import { format } from 'date-fns';

// 问题：绕过统一工具，格式不统一
format(new Date(expense.createdAt), 'yyyy-MM-dd HH:mm:ss');
format(new Date(payment.paymentDate), 'yyyy-MM-dd');
```

#### ✅ 正确示例

```typescript
import { formatDate, formatDateTime } from '@/lib/utils/datetime';

// 使用统一工具函数
formatDateTime(expense.createdAt); // "2025-01-14 10:30:45"
formatDate(payment.paymentDate); // "2025-01-14"
```

### 3.4 替换表单默认值

#### ❌ 错误示例

```typescript
import { format } from 'date-fns';

const form = useForm({
  defaultValues: {
    paymentDate: format(new Date(), 'yyyy-MM-dd'), // ❌ 直接使用 format
  },
});
```

#### ✅ 正确示例

```typescript
import { formatDate } from '@/lib/utils/datetime';

const form = useForm({
  defaultValues: {
    paymentDate: formatDate(new Date()), // ✅ 使用统一工具
  },
});
```

### 3.5 替换日期选择器回调

#### ❌ 错误示例

```typescript
import { format } from 'date-fns';

<DatePicker
  onSelect={(date) => {
    field.onChange(date ? format(date, 'yyyy-MM-dd') : '')  // ❌
  }}
/>
```

#### ✅ 正确示例

```typescript
import { formatDate } from '@/lib/utils/datetime';

<DatePicker
  onSelect={(date) => {
    field.onChange(date ? formatDate(date) : '')  // ✅
  }}
/>
```

---

## 📦 四、分模块迁移

### 4.1 财务模块（P0 - 高优先级）

#### 文件列表

1. `app/(dashboard)/finance/payments/[id]/page-client.tsx`
2. `app/(dashboard)/finance/refunds/[id]/page.tsx`
3. `components/finance/payables-client/PayableTableList.tsx`
4. `components/finance/receivables-client/ReceivablesTableList.tsx`
5. `components/finance/expenses/expense-detail.tsx`

#### 修改示例

**文件**: `app/(dashboard)/finance/payments/[id]/page-client.tsx`

```typescript
// 修改前
{
  new Date(payment.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// 修改后
import { formatDateTime } from '@/lib/utils/datetime';

{
  formatDateTime(payment.createdAt);
}
```

### 4.2 客户模块（P0 - 高优先级）

#### 文件列表

1. `components/customers/erp-customer-list.tsx`
2. `components/customers/erp-customer-detail.tsx`
3. `app/(dashboard)/customers/[id]/page.tsx`

#### 修改示例

**文件**: `components/customers/erp-customer-list.tsx`

```typescript
// 修改前
.toLocaleString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

// 修改后
import { formatDateTime } from '@/lib/utils/datetime';

formatDateTime(customer.createdAt)
```

### 4.3 库存模块（P1 - 中优先级）

#### 文件列表

1. `app/(dashboard)/inventory/counts/[id]/page-client.tsx`
2. `components/inventory/counts/count-list.tsx`
3. `components/inventory/forms/inbound-records-table.tsx`

#### 修改示例

**文件**: `components/inventory/counts/count-list.tsx`

```typescript
// 修改前
import { format } from 'date-fns';

{
  format(new Date(count.planDate), 'yyyy-MM-dd');
}

// 修改后
import { formatDate } from '@/lib/utils/datetime';

{
  formatDate(count.planDate);
}
```

### 4.4 仪表盘模块（P1 - 中优先级）

#### 文件列表

1. `components/dashboard/factory-shipments.tsx`
2. `components/dashboard/pending-orders.tsx`
3. `components/dashboard/recent-orders.tsx`
4. `components/dashboard/todo-list.tsx`

#### 修改示例

**文件**: `components/dashboard/todo-list.tsx`

```typescript
// 修改前
{
  new Date(todo.dueDate).toLocaleDateString('zh-CN');
}

// 修改后
import { formatDate } from '@/lib/utils/datetime';

{
  formatDate(todo.dueDate);
}
```

---

## ✅ 五、验证测试

### 5.1 代码质量检查

```bash
# 1. 运行 ESLint 检查
npm run lint

# 2. 运行 TypeScript 检查
npm run type-check

# 3. 运行 Prettier 格式化
npm run format

# 4. 检查是否有遗漏的原生方法
Get-ChildItem -Path app,components -Recurse -Include *.tsx,*.ts | Select-String -Pattern "toLocaleDateString|toLocaleString"
```

### 5.2 功能测试清单

#### 财务模块

- [ ] 收款列表页面：日期显示为 `YYYY-MM-DD HH:mm:ss`
- [ ] 收款详情页面：创建时间、更新时间显示正确
- [ ] 付款列表页面：日期显示为 `YYYY-MM-DD HH:mm:ss`
- [ ] 退款列表页面：日期显示为 `YYYY-MM-DD HH:mm:ss`
- [ ] 应收款列表：订单日期、最后收款日期显示正确

#### 客户模块

- [ ] 客户列表：创建时间显示为 `YYYY-MM-DD HH:mm:ss`
- [ ] 客户详情：所有日期字段显示正确

#### 库存模块

- [ ] 盘点列表：计划日期、创建时间显示正确
- [ ] 入库记录：入库时间显示为 `YYYY-MM-DD HH:mm:ss`

#### 仪表盘

- [ ] 待办事项：到期日期显示正确
- [ ] 最近订单：订单日期显示正确

### 5.3 浏览器兼容性测试

- [ ] Chrome 浏览器：日期显示正常
- [ ] Edge 浏览器：日期显示正常
- [ ] Firefox 浏览器：日期显示正常
- [ ] Safari 浏览器：日期显示正常（如果支持）

---

## 📊 六、迁移进度跟踪

### 6.1 进度表

| 模块     | 文件数 | 已完成 | 进度   | 负责人 |
| -------- | ------ | ------ | ------ | ------ |
| 财务模块 | 15     | 0      | 0%     | -      |
| 客户模块 | 8      | 0      | 0%     | -      |
| 库存模块 | 10     | 0      | 0%     | -      |
| 仪表盘   | 5      | 0      | 0%     | -      |
| 其他     | 10     | 0      | 0%     | -      |
| **总计** | **48** | **0**  | **0%** | -      |

### 6.2 问题记录

| 日期 | 文件 | 问题描述 | 解决方案 | 状态 |
| ---- | ---- | -------- | -------- | ---- |
| -    | -    | -        | -        | -    |

---

## 🚀 七、提交规范

### 7.1 提交信息格式

```bash
# 单个文件修改
git commit -m "refactor(finance): 统一收款详情页日期格式为 YYYY-MM-DD HH:mm:ss"

# 批量修改
git commit -m "refactor(finance): 统一财务模块所有日期格式

- 替换 toLocaleString() 为 formatDateTime()
- 替换 toLocaleDateString() 为 formatDate()
- 统一使用 lib/utils/datetime.ts 工具函数
- 影响文件: 15个"
```

### 7.2 Pull Request 模板

```markdown
## 📝 修改说明

统一项目中所有日期时间格式为 `YYYY-MM-DD HH:mm:ss`

## 🎯 修改内容

- [x] 修改 `lib/utils/datetime.ts` 默认格式
- [x] 替换财务模块中的原生 JS 日期方法
- [x] 替换客户模块中的原生 JS 日期方法
- [x] 替换库存模块中的原生 JS 日期方法
- [x] 替换仪表盘模块中的原生 JS 日期方法

## ✅ 验证清单

- [x] 通过 ESLint 检查
- [x] 通过 TypeScript 检查
- [x] 通过 Prettier 格式化
- [x] 手动测试所有修改页面
- [x] 浏览器兼容性测试

## 📊 影响范围

- 修改文件数: 48
- 修改行数: ~140
- 风险等级: 🟡 中等

## 🖼️ 截图

（附上修改前后的对比截图）
```

---

## 📚 八、参考资源

- [项目日期格式分析报告](./date-format-analysis.md)
- [date-fns 官方文档](https://date-fns.org/)
- [项目日期工具源码](../lib/utils/datetime.ts)

---

**最后更新**: 2025-01-14  
**维护者**: Augment Agent  
**版本**: 1.0.0
