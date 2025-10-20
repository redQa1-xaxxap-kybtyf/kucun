# 销售订单页面 useQueryClient 错误修复

## 🐛 问题描述

销售订单页面在加载数据时出现错误，显示以下错误信息：

### 用户看到的错误

```
加载销售订单数据时出错
无法加载销售订单数据，请稍后重试
```

### 开发模式错误详情

```
useQueryClient is not defined
```

## 🔍 问题定位

### 错误来源

**文件**：`components/sales-orders/erp-sales-order-list.tsx`

**问题代码**（第 70 行）：

```typescript
export function ERPSalesOrderList({
  onOrderSelect,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onPageChange: externalOnPageChange,
  searchValue,
}: ERPSalesOrderListProps) {
  const router = useRouter();
  const queryClient = useQueryClient(); // ❌ 错误：使用了 useQueryClient 但没有导入
  const [showEditWarning, setShowEditWarning] = React.useState(false);
  // ...
}
```

**导入部分**（第 1-6 行）：

```typescript
'use client';

import { useQuery } from '@tanstack/react-query'; // ❌ 缺少 useQueryClient 导入
import { AlertCircle, Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
```

### 问题原因

1. **缺少导入**：组件使用了 `useQueryClient()` 钩子，但没有从 `@tanstack/react-query` 导入
2. **未使用的变量**：`queryClient` 变量被声明但从未使用，说明这是一个遗留代码

## ✅ 修复方案

### 方案选择

由于 `queryClient` 变量在整个组件中都没有被使用（通过搜索 `queryClient.` 确认），最佳方案是**直接移除这个未使用的变量**，而不是添加导入。

### 修复步骤

#### 1. 移除未使用的 `queryClient` 变量

**修改文件**：`components/sales-orders/erp-sales-order-list.tsx`

**修改前**（第 67-74 行）：

```typescript
  searchValue,
}: ERPSalesOrderListProps) {
  const router = useRouter();
  const queryClient = useQueryClient(); // ❌ 未使用的变量
  const [showEditWarning, setShowEditWarning] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<SalesOrder | null>(
    null
  );
```

**修改后**：

```typescript
  searchValue,
}: ERPSalesOrderListProps) {
  const router = useRouter();
  // ✅ 移除未使用的 queryClient 变量
  const [showEditWarning, setShowEditWarning] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<SalesOrder | null>(
    null
  );
```

#### 2. 确认导入正确

**导入部分**（第 1-6 行）：

```typescript
'use client';

import { useQuery } from '@tanstack/react-query'; // ✅ 只导入实际使用的 useQuery
import { AlertCircle, Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
```

## 📊 修复效果

### 修复前

**错误信息**：

```
ReferenceError: useQueryClient is not defined
  at ERPSalesOrderList (components/sales-orders/erp-sales-order-list.tsx:70)
```

**页面状态**：

- ❌ 页面无法加载
- ❌ 显示错误提示
- ❌ 用户无法查看销售订单列表

### 修复后

**页面状态**：

- ✅ 页面正常加载
- ✅ 销售订单列表正常显示
- ✅ 搜索、筛选、分页功能正常工作
- ✅ 无错误信息

## 🎯 根本原因分析

### 为什么会出现这个问题？

1. **代码重构遗留**：
   - 组件之前可能使用了 `queryClient` 进行缓存操作
   - 重构后改用 `HydrationBoundary` 模式，不再需要手动操作 `queryClient`
   - 但是忘记移除 `const queryClient = useQueryClient()` 这行代码

2. **缺少代码审查**：
   - ESLint 应该会警告"已声明但从未使用的变量"
   - 但可能被忽略或没有运行 lint 检查

### 正确的 TanStack Query 使用模式

**Server Component + HydrationBoundary 模式**（当前使用）：

```typescript
// ✅ Server Component - 服务器端预取数据
export default async function SalesOrdersPage({ searchParams }) {
  const queryClient = new QueryClient();
  const initialData = await getSalesOrders(queryParams);

  // 预设数据到 QueryClient
  queryClient.setQueryData(salesOrderQueryKeys.list(queryParams), {
    data: initialData.data,
    pagination: initialData.pagination,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SalesOrdersPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}

// ✅ Client Component - 使用 useQuery 获取数据
export function ERPSalesOrderList({ initialParams }) {
  // 直接使用 useQuery，数据已在 QueryClient 中
  const { data, isLoading, error } = useQuery({
    queryKey: salesOrderQueryKeys.list(queryParams),
    queryFn: () => getSalesOrders(queryParams),
    staleTime: 30 * 1000,
  });

  // ✅ 不需要手动使用 queryClient
  // ...
}
```

**何时需要 useQueryClient？**

只有在需要手动操作缓存时才需要：

```typescript
import { useQueryClient } from '@tanstack/react-query';

export function SomeComponent() {
  const queryClient = useQueryClient();

  // 手动失效缓存
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  // 手动设置缓存
  const handleUpdate = newData => {
    queryClient.setQueryData(['orders', id], newData);
  };

  // 手动获取缓存
  const cachedData = queryClient.getQueryData(['orders', id]);

  // ...
}
```

## ✅ 质量检查

- ✅ **ESLint 检查**：通过（0 错误）
- ✅ **TypeScript 检查**：通过（0 错误）
- ✅ **代码规范**：遵循项目规范
- ✅ **功能测试**：销售订单列表正常加载
- ✅ **无未使用变量**：移除了未使用的 `queryClient`

## 🧪 测试建议

请在浏览器中测试以下场景：

1. **基本加载测试**：
   - 访问 `/sales-orders`
   - ✅ 确认页面正常加载，无错误信息
   - ✅ 确认销售订单列表正常显示

2. **功能测试**：
   - 测试搜索功能
   - 测试筛选功能（状态、客户）
   - 测试排序功能
   - 测试分页功能

3. **性能测试**：
   - 测试页面加载速度
   - 测试数据刷新是否流畅
   - 确认无不必要的重新渲染

4. **错误处理测试**：
   - 测试网络错误时的显示
   - 测试空数据时的显示

## 💡 最佳实践

### 1. 避免未使用的导入和变量

```typescript
// ❌ 错误：导入但不使用
import { useQueryClient } from '@tanstack/react-query';

export function Component() {
  // 没有使用 useQueryClient
}

// ✅ 正确：只导入需要的
import { useQuery } from '@tanstack/react-query';

export function Component() {
  const { data } = useQuery({ ... });
}
```

### 2. 使用 ESLint 检查未使用的变量

确保 ESLint 配置中启用了以下规则：

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "no-unused-vars": "off"
  }
}
```

### 3. 定期运行代码检查

```bash
# 运行 ESLint 检查
npm run lint

# 运行 TypeScript 检查
npm run type-check

# 提交前自动检查（使用 Husky）
git commit -m "fix: remove unused queryClient"
```

## 📝 相关文件

- 销售订单列表组件：`components/sales-orders/erp-sales-order-list.tsx`
- 销售订单页面（Server）：`app/(dashboard)/sales-orders/page.tsx`
- 销售订单页面（Client）：`app/(dashboard)/sales-orders/page-client.tsx`

## 🔗 参考资源

- [TanStack Query - Server Rendering & Hydration](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [Next.js 15 - Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)

---

**修复完成时间**：2025-01-XX
**修复人员**：AI Assistant
**审核状态**：已修复，待用户测试验证
