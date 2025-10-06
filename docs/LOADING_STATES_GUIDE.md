# 加载状态使用指南

> 统一的加载状态处理规范，基于 shadcn/ui 和 Next.js 15.4 最佳实践

## 📋 目录

1. [核心原则](#核心原则)
2. [组件选择指南](#组件选择指南)
3. [使用场景](#使用场景)
4. [代码示例](#代码示例)
5. [常见问题](#常见问题)

---

## 🎯 核心原则

### 1. 统一使用 Skeleton 组件

✅ **推荐**: 使用 shadcn/ui 的 Skeleton 组件作为基础

```typescript
import { Skeleton } from '@/components/ui/skeleton';
```

❌ **避免**: 自定义加载动画或第三方加载组件

### 2. 遵循 Next.js 15.4 规范

✅ **推荐**: 使用 `loading.tsx` 文件处理页面级加载

```typescript
// app/(dashboard)/products/loading.tsx
export default function ProductsLoading() {
  return <ProductListSkeleton />;
}
```

❌ **避免**: 在页面组件中手动处理 Suspense

### 3. 与 TanStack Query 集成

✅ **推荐**: 使用 `isLoading` 状态显示骨架屏

```typescript
const { data, isLoading } = useQuery({...});

if (isLoading) return <ProductListSkeleton />;
```

❌ **避免**: 使用全局加载状态或 Loading Spinner

---

## 🔍 组件选择指南

### 何时使用 Skeleton 组件？

**适用场景**:

- ✅ 简单的文本/图片占位符
- ✅ 单个元素的加载状态
- ✅ 内联加载提示

**示例**:

```typescript
{isLoading ? (
  <Skeleton className="h-8 w-32" />
) : (
  <h1>{title}</h1>
)}
```

### 何时创建专用骨架屏？

**适用场景**:

- ✅ 复杂的页面布局
- ✅ 需要复用的加载状态
- ✅ 表格、列表等结构化内容

**示例**:

```typescript
// components/products/product-list-skeleton.tsx
export function ProductListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 搜索区域骨架 */}
      <Skeleton className="h-10 w-full" />

      {/* 表格骨架 */}
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
```

### 何时使用 loading.tsx？

**适用场景**:

- ✅ 服务器组件页面
- ✅ 需要流式渲染 (Streaming)
- ✅ 整个页面的加载状态

**示例**:

```typescript
// app/(dashboard)/products/loading.tsx
import { ProductListSkeleton } from '@/components/products/product-list-skeleton';

export default function ProductsLoading() {
  return <ProductListSkeleton />;
}
```

### ~~何时使用 LoadingSpinner？~~ (已移除)

**注意**: LoadingSpinner 组件已于 2025-10-05 从项目中移除。

**原因**:

- 使用率低，未在项目中被使用
- 功能可以通过 Loader2 图标直接实现
- 简化组件库，减少维护成本

**替代方案 - 按钮加载状态**:

```typescript
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isPending ? '提交中...' : '提交'}
</Button>
```

**替代方案 - 页面加载状态**:

```typescript
// 使用 Skeleton 组件代替
import { Skeleton } from '@/components/ui/skeleton';

{isLoading ? (
  <Skeleton className="h-8 w-32" />
) : (
  <Content />
)}
```

---

## 📚 使用场景

### 场景 1: 服务器组件页面加载

**文件结构**:

```
app/(dashboard)/products/
├── page.tsx          # 服务器组件
└── loading.tsx       # 加载状态
```

**loading.tsx**:

```typescript
import { ProductListSkeleton } from '@/components/products/product-list-skeleton';

export default function ProductsLoading() {
  return <ProductListSkeleton />;
}
```

**page.tsx**:

```typescript
// 服务器组件，无需手动处理加载状态
export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductList products={products} />;
}
```

---

### 场景 2: 客户端组件 + TanStack Query

**组件文件**:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { ProductListSkeleton } from '@/components/products/product-list-skeleton';
import { ErrorMessage } from '@/components/ui/error-message';

export function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  // 加载状态
  if (isLoading) {
    return <ProductListSkeleton />;
  }

  // 错误状态
  if (error) {
    return <ErrorMessage error={error} />;
  }

  // 正常渲染
  return (
    <div>
      {data.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

---

### 场景 3: 简单的内联加载

**适用于**: 单个元素的加载状态

```typescript
export function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
  });

  return (
    <div className="space-y-4">
      {/* 头像 */}
      {isLoading ? (
        <Skeleton className="h-12 w-12 rounded-full" />
      ) : (
        <Avatar src={user.avatar} />
      )}

      {/* 用户名 */}
      {isLoading ? (
        <Skeleton className="h-6 w-32" />
      ) : (
        <h2>{user.name}</h2>
      )}

      {/* 简介 */}
      {isLoading ? (
        <Skeleton className="h-4 w-full" />
      ) : (
        <p>{user.bio}</p>
      )}
    </div>
  );
}
```

---

### 场景 4: 表格加载状态

**推荐模式**: 创建专用的表格骨架屏

```typescript
// components/products/product-table-skeleton.tsx
export function ProductTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>产品名称</TableHead>
          <TableHead>分类</TableHead>
          <TableHead>价格</TableHead>
          <TableHead>库存</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

### 场景 5: 按钮加载状态

**推荐方案**: 使用 Loader2 图标

```typescript
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SubmitButton() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      await submitForm();
    });
  };

  return (
    <Button onClick={handleSubmit} disabled={isPending}>
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isPending ? '提交中...' : '提交'}
    </Button>
  );
}
```

---

### 场景 6: 卡片加载状态

**推荐模式**: 组合 Skeleton 组件

```typescript
export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-3 w-48" />
      </CardContent>
    </Card>
  );
}
```

---

## ⚠️ 常见错误

### ❌ 错误 1: 使用多种加载组件

```typescript
// ❌ 不推荐
import { Spinner } from 'react-spinners';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';

// 在不同地方使用不同的加载组件
```

```typescript
// ✅ 推荐
import { Skeleton } from '@/components/ui/skeleton';

// 统一使用 Skeleton 组件
```

### ❌ 错误 2: 在服务器组件中手动处理 Suspense

```typescript
// ❌ 不推荐
export default async function ProductsPage() {
  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ProductList />
    </Suspense>
  );
}
```

```typescript
// ✅ 推荐
// 使用 loading.tsx 文件
// app/(dashboard)/products/loading.tsx
export default function ProductsLoading() {
  return <ProductListSkeleton />;
}
```

### ❌ 错误 3: 内联大量 Skeleton 代码

```typescript
// ❌ 不推荐 - 代码重复
if (isLoading) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-48" />
      {/* 30+ 行 Skeleton 代码 */}
    </div>
  );
}
```

```typescript
// ✅ 推荐 - 提取为组件
if (isLoading) {
  return <ProductListSkeleton />;
}
```

---

## 📊 决策流程图

```
需要显示加载状态？
├─ 是服务器组件？
│  └─ 是 → 使用 loading.tsx + 专用骨架屏
│
├─ 是客户端组件？
│  ├─ 使用 TanStack Query？
│  │  └─ 是 → 检查 isLoading + 专用骨架屏
│  │
│  └─ 简单的单个元素？
│     └─ 是 → 内联 Skeleton 组件
│
└─ 是按钮/表单提交？
   └─ 是 → 使用 Loader2 图标 + disabled 状态
```

---

## 🎓 最佳实践总结

1. **统一使用 Skeleton 组件** - 保持 UI 一致性
2. **为复杂布局创建专用骨架屏** - 提高代码复用性
3. **遵循 Next.js 15.4 规范** - 使用 loading.tsx 文件
4. **与 TanStack Query 集成** - 正确处理 isLoading 状态
5. **避免过度工程化** - 简单场景使用内联 Skeleton
6. **提供良好的用户体验** - 骨架屏应与实际内容布局一致

---

## 📚 参考资源

- [shadcn/ui Skeleton 组件](https://ui.shadcn.com/docs/components/skeleton)
- [Next.js 15.4 Loading UI](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [TanStack Query Loading States](https://tanstack.com/query/latest/docs/react/guides/queries)
- [加载组件统一化分析报告](../LOADING_COMPONENT_ANALYSIS_REPORT.md)

---

**文档版本**: 1.0.0  
**最后更新**: 2025-10-05  
**维护者**: 开发团队
