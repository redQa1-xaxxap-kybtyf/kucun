# 临时商品 lastUsedAt 字段显示格式修改总结

## 📋 修改概述

将临时商品的"最后使用时间"（`lastUsedAt`）字段的显示格式从仅显示日期改为显示完整的日期和时间（包括时分）。

**修改前**: `2025-10-25`  
**修改后**: `2025-10-25 14:30`

## 🔍 修改范围

### 1. 前端组件

#### 文件: `app/(dashboard)/inventory/temporary-products/page-client.tsx`

**修改内容**:

1. **导入语句修改**:

   ```typescript
   // 修改前
   import { formatDate } from '@/lib/utils';

   // 修改后
   import { formatDateTime } from '@/lib/utils/datetime';
   ```

2. **显示格式修改** (第 322 行):

   ```typescript
   // 修改前
   {
     formatDate(new Date(product.lastUsedAt));
   }

   // 修改后
   {
     formatDateTime(new Date(product.lastUsedAt));
   }
   ```

**影响位置**:

- 临时商品列表表格中的"最后使用时间"列

**显示效果**:

- 修改前: `2025-10-25`
- 修改后: `2025-10-25 14:30`

### 2. 诊断脚本

#### 文件: `scripts/diagnose-temporary-products.ts`

**修改内容**:

**日期格式化修改** (第 49-54 行):

```typescript
// 修改前
console.log(`     最后使用: ${tp.lastUsedAt || '从未使用'}`);
console.log(`     创建时间: ${tp.createdAt}`);

// 修改后
console.log(
  `     最后使用: ${tp.lastUsedAt ? new Date(tp.lastUsedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '从未使用'}`
);
console.log(
  `     创建时间: ${new Date(tp.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
);
```

**影响位置**:

- 诊断脚本输出的临时商品信息

**显示效果**:

- 修改前: `2025-10-25T14:30:00.000Z`
- 修改后: `2025/10/25 14:30`

### 3. SQL 脚本

#### 文件: `scripts/check-temporary-products.sql`

**修改内容**: 无需修改

**原因**: MySQL 查询结果会直接显示数据库中的原始 DATETIME 格式，已经包含完整的日期和时间信息。

**显示效果**: `2025-10-25 14:30:00`

## 📊 技术细节

### 使用的格式化函数

#### 前端组件

使用 `lib/utils/datetime.ts` 中的 `formatDateTime` 函数：

```typescript
import { formatDateTime } from '@/lib/utils/datetime';

// 使用方式
formatDateTime(new Date(product.lastUsedAt));
```

**函数实现** (基于 `date-fns`):

```typescript
export function formatDateTime(
  date: Date | string | null | undefined,
  formatStr: string = 'yyyy-MM-dd HH:mm'
): string {
  if (!date) return '-';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '-';
  return format(dateObj, formatStr, { locale: zhCN });
}
```

**默认格式**: `yyyy-MM-dd HH:mm` (例如: `2025-10-25 14:30`)

#### 诊断脚本

使用 JavaScript 原生的 `toLocaleString` 方法：

```typescript
new Date(tp.lastUsedAt).toLocaleString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
```

**格式**: `yyyy/MM/dd HH:mm` (例如: `2025/10/25 14:30`)

### 时区处理

- **前端**: `date-fns` 使用本地时区，自动处理时区转换
- **诊断脚本**: `toLocaleString` 使用本地时区
- **数据库**: MySQL DATETIME 类型存储的是本地时间（不含时区信息）

**注意**: 确保服务器和客户端时区一致，避免时间显示错误。

## ✅ 验证清单

- [x] 前端组件导入语句已修改
- [x] 前端组件显示格式已修改
- [x] 诊断脚本日期格式已修改
- [x] ESLint 检查通过（无错误，仅有警告）
- [ ] 浏览器测试：临时商品列表页面显示正确
- [ ] 运行诊断脚本验证输出格式

## 🧪 测试步骤

### 1. 前端测试

1. 启动开发服务器：`npm run dev`
2. 访问临时商品库页面：`http://localhost:3000/inventory/temporary-products`
3. 检查"最后使用时间"列的显示格式
4. 确认格式为 `YYYY-MM-DD HH:mm`（例如：`2025-10-25 14:30`）

### 2. 诊断脚本测试

1. 运行诊断脚本：

   ```bash
   npx tsx scripts/diagnose-temporary-products.ts
   ```

2. 检查输出中的日期格式：

   ```
   最近的临时商品:
     1. [TEST-001] 测试商品
        供应商: 卡士亚
        使用次数: 2
        最后使用: 2025/10/25 14:30
        创建时间: 2025/10/25 10:15
   ```

3. 确认格式为 `YYYY/MM/DD HH:mm`

### 3. SQL 脚本测试

1. 运行 SQL 脚本：

   ```bash
   mysql -u root -p kucun_dev < scripts/check-temporary-products.sql
   ```

2. 检查输出中的日期格式：

   ```
   code      | name     | last_used_at        | created_at
   ----------|----------|---------------------|--------------------
   TEST-001  | 测试商品 | 2025-10-25 14:30:00 | 2025-10-25 10:15:00
   ```

3. 确认格式为 `YYYY-MM-DD HH:mm:ss`（MySQL 默认格式）

## 📝 相关文件

### 已修改的文件

1. `app/(dashboard)/inventory/temporary-products/page-client.tsx`
   - 导入语句：`formatDate` → `formatDateTime`
   - 显示格式：第 322 行

2. `scripts/diagnose-temporary-products.ts`
   - 日期格式化：第 49-54 行

### 未修改的文件

1. `scripts/check-temporary-products.sql`
   - 原因：MySQL 自动显示完整日期时间

2. `app/api/temporary-products/route.ts`
   - 原因：API 返回原始 Date 对象，格式化在前端进行

3. `prisma/schema.prisma`
   - 原因：数据库 Schema 定义不需要修改

## 🎯 设计原则

### 1. 一致性

- 所有显示 `lastUsedAt` 的地方都使用相同的格式
- 前端使用 `formatDateTime` 函数统一格式化
- 诊断脚本使用 `toLocaleString` 保持一致

### 2. 可读性

- 显示完整的日期和时间，方便用户了解精确的使用时间
- 使用 24 小时制，符合中国用户习惯
- 格式简洁，不显示秒数（避免信息过载）

### 3. 可维护性

- 使用统一的格式化函数 `formatDateTime`
- 遵循项目的日期时间格式化规范
- 代码符合 ESLint 规范

## 🔄 后续优化建议

### 1. 统一日期格式化

建议在整个项目中统一使用 `lib/utils/datetime.ts` 中的格式化函数：

- `formatDate(date)` - 仅显示日期：`2025-10-25`
- `formatDateTime(date)` - 显示日期和时间：`2025-10-25 14:30`
- `formatTime(date)` - 仅显示时间：`14:30`

### 2. 相对时间显示

对于最近使用的临时商品，可以考虑显示相对时间：

```typescript
// 例如：
'2 小时前';
'昨天 14:30';
'3 天前';
```

可以使用 `date-fns` 的 `formatDistanceToNow` 函数实现。

### 3. 时区处理

如果系统需要支持多时区，建议：

1. 数据库使用 UTC 时间存储
2. API 返回 ISO 8601 格式（含时区信息）
3. 前端根据用户时区显示

## 📚 参考资源

- [date-fns 文档](https://date-fns.org/)
- [MDN - toLocaleString](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString)
- [项目日期时间格式化规范](../.augment/fixes/global-datetime-format-migration.md)

---

**修改完成时间**: 2025-10-25

**修改人员**: AI Assistant

**验证状态**: 待测试
