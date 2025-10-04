# Query Keys 使用指南

本文档说明如何在项目中正确使用集中管理的 Query Keys。

## 📋 目录

1. [基本使用](#基本使用)
2. [在组件中使用](#在组件中使用)
3. [缓存失效](#缓存失效)
4. [预取数据](#预取数据)
5. [类型安全](#类型安全)
6. [最佳实践](#最佳实践)

## 基本使用

### 1. 导入 Query Keys

```typescript
import { queryKeys } from '@/lib/queryKeys';
```

### 2. 在 useQuery 中使用

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// 查询产品列表
const { data: products } = useQuery({
  queryKey: queryKeys.products.list({ page: 1, pageSize: 20 }),
  queryFn: () => fetchProducts({ page: 1, pageSize: 20 }),
});

// 查询单个产品
const { data: product } = useQuery({
  queryKey: queryKeys.products.detail(productId),
  queryFn: () => fetchProduct(productId),
});
```

### 3. 在 useMutation 中使用

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    // 失效产品列表缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.lists(),
    });
  },
});
```

## 在组件中使用

### 示例 1: 产品列表页面

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useState } from 'react';

export default function ProductListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // 使用 Query Keys 查询产品列表
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.products.list({
      page,
      pageSize: 20,
      search
    }),
    queryFn: () => fetchProducts({ page, pageSize: 20, search }),
  });

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索产品..."
      />
      <ul>
        {data?.items.map(product => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 示例 2: 产品详情页面

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export default function ProductDetailPage({ productId }: { productId: string }) {
  const queryClient = useQueryClient();

  // 查询产品详情
  const { data: product } = useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => fetchProduct(productId),
  });

  // 查询产品库存
  const { data: inventory } = useQuery({
    queryKey: queryKeys.products.inventory(productId),
    queryFn: () => fetchProductInventory(productId),
  });

  // 更新产品
  const updateMutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      // 失效当前产品的缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId)
      });
    },
  });

  return (
    <div>
      <h1>{product?.name}</h1>
      <p>库存: {inventory?.quantity}</p>
      <button onClick={() => updateMutation.mutate({ id: productId, name: '新名称' })}>
        更新产品
      </button>
    </div>
  );
}
```

## 缓存失效

### 1. 失效特定查询

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const queryClient = useQueryClient();

// 失效单个产品的缓存
queryClient.invalidateQueries({
  queryKey: queryKeys.products.detail('product-id'),
});

// 失效所有产品列表的缓存
queryClient.invalidateQueries({
  queryKey: queryKeys.products.lists(),
});

// 失效所有产品相关的缓存
queryClient.invalidateQueries({
  queryKey: queryKeys.products.all,
});
```

### 2. 在 Mutation 中失效缓存

```typescript
const createProductMutation = useMutation({
  mutationFn: createProduct,
  onSuccess: newProduct => {
    // 失效产品列表
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.lists(),
    });

    // 可选: 设置新产品的缓存
    queryClient.setQueryData(
      queryKeys.products.detail(newProduct.id),
      newProduct
    );
  },
});

const updateProductMutation = useMutation({
  mutationFn: updateProduct,
  onSuccess: updatedProduct => {
    // 失效特定产品和列表
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.detail(updatedProduct.id),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.lists(),
    });
  },
});

const deleteProductMutation = useMutation({
  mutationFn: deleteProduct,
  onSuccess: (_, productId) => {
    // 移除特定产品的缓存
    queryClient.removeQueries({
      queryKey: queryKeys.products.detail(productId),
    });

    // 失效产品列表
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.lists(),
    });
  },
});
```

## 预取数据

### 1. 在服务器组件中预取

```typescript
// app/(dashboard)/products/page.tsx
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import ProductList from './ProductList';

export default async function ProductsPage() {
  const queryClient = new QueryClient();

  // 预取产品列表
  await queryClient.prefetchQuery({
    queryKey: queryKeys.products.list({ page: 1, pageSize: 20 }),
    queryFn: () => fetchProducts({ page: 1, pageSize: 20 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductList />
    </HydrationBoundary>
  );
}
```

### 2. 在客户端预取

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

function ProductListItem({ product }: { product: Product }) {
  const queryClient = useQueryClient();

  // 鼠标悬停时预取产品详情
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(product.id),
      queryFn: () => fetchProduct(product.id),
    });
  };

  return (
    <div onMouseEnter={handleMouseEnter}>
      {product.name}
    </div>
  );
}
```

## 类型安全

### 1. Query Keys 的类型推断

```typescript
import { queryKeys } from '@/lib/queryKeys';

// TypeScript 会自动推断 Query Key 的类型
const productListKey = queryKeys.products.list({ page: 1 });
// 类型: readonly ["products", "list", { page: 1 }]

const productDetailKey = queryKeys.products.detail('123');
// 类型: readonly ["products", "detail", "123"]
```

### 2. 使用 queryOptions 增强类型安全

```typescript
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// 定义可复用的查询选项
export function productListOptions(filters: {
  page: number;
  pageSize: number;
}) {
  return queryOptions({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => fetchProducts(filters),
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

// 在组件中使用
const { data } = useQuery(productListOptions({ page: 1, pageSize: 20 }));

// 在预取中使用
queryClient.prefetchQuery(productListOptions({ page: 2, pageSize: 20 }));

// 获取缓存数据时也有类型推断
const cachedData = queryClient.getQueryData(
  productListOptions({ page: 1, pageSize: 20 }).queryKey
);
// cachedData 的类型会自动推断为 Product[] | undefined
```

## 最佳实践

### 1. ✅ 始终使用集中管理的 Query Keys

```typescript
// ✅ 正确
import { queryKeys } from '@/lib/queryKeys';
useQuery({
  queryKey: queryKeys.products.detail(id),
  queryFn: () => fetchProduct(id),
});

// ❌ 错误 - 不要硬编码 Query Keys
useQuery({
  queryKey: ['products', 'detail', id],
  queryFn: () => fetchProduct(id),
});
```

### 2. ✅ 使用层级结构失效缓存

```typescript
// ✅ 正确 - 失效所有产品相关的查询
queryClient.invalidateQueries({
  queryKey: queryKeys.products.all,
});

// ✅ 正确 - 只失效产品列表
queryClient.invalidateQueries({
  queryKey: queryKeys.products.lists(),
});

// ✅ 正确 - 只失效特定产品
queryClient.invalidateQueries({
  queryKey: queryKeys.products.detail(id),
});
```

### 3. ✅ 在 Mutation 中正确失效缓存

```typescript
// ✅ 正确 - 创建后失效列表
const createMutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.lists(),
    });
  },
});

// ✅ 正确 - 更新后失效详情和列表
const updateMutation = useMutation({
  mutationFn: updateProduct,
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.detail(variables.id),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.lists(),
    });
  },
});
```

### 4. ✅ 使用 queryOptions 提高复用性

```typescript
// ✅ 正确 - 定义可复用的查询选项
export function productDetailOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => fetchProduct(id),
    staleTime: 5 * 60 * 1000,
  });
}

// 在多个地方使用
useQuery(productDetailOptions(id));
queryClient.prefetchQuery(productDetailOptions(id));
queryClient.getQueryData(productDetailOptions(id).queryKey);
```

### 5. ✅ 合理设置过滤参数

```typescript
// ✅ 正确 - 包含所有影响查询结果的参数
const { data } = useQuery({
  queryKey: queryKeys.products.list({
    page,
    pageSize,
    search,
    status,
    categoryId,
  }),
  queryFn: () =>
    fetchProducts({
      page,
      pageSize,
      search,
      status,
      categoryId,
    }),
});

// ❌ 错误 - 遗漏参数会导致缓存错误
const { data } = useQuery({
  queryKey: queryKeys.products.list({ page, pageSize }),
  queryFn: () => fetchProducts({ page, pageSize, search, status }), // search 和 status 未包含在 key 中
});
```

## 常见问题

### Q1: 如何添加新的 Query Keys?

在 `lib/queryKeys.ts` 中按照现有模式添加：

```typescript
export const newModuleKeys = {
  all: ['new-module'] as const,

  lists: () => [...newModuleKeys.all, 'list'] as const,
  list: (filters?: BaseFilters) => [...newModuleKeys.lists(), filters] as const,

  details: () => [...newModuleKeys.all, 'detail'] as const,
  detail: (id: string) => [...newModuleKeys.details(), id] as const,
} as const;

// 添加到 queryKeys 导出
export const queryKeys = {
  // ... 其他 keys
  newModule: newModuleKeys,
} as const;
```

### Q2: 如何处理复杂的过滤条件?

扩展过滤参数类型：

```typescript
// 在 lib/queryKeys.ts 中定义
interface ProductFilters extends BaseFilters {
  status?: 'active' | 'inactive';
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
}

export const productKeys = {
  // ...
  list: (filters?: ProductFilters) =>
    [...productKeys.lists(), filters] as const,
};
```

### Q3: 如何在 Server Actions 中使用?

```typescript
'use server';

import { revalidateTag } from 'next/cache';
import { queryKeys } from '@/lib/queryKeys';

export async function createProduct(data: ProductInput) {
  const product = await db.product.create({ data });

  // 使用 Next.js 的 revalidateTag
  revalidateTag(JSON.stringify(queryKeys.products.lists()));

  return product;
}
```

---

**记住**: 集中管理 Query Keys 是确保缓存一致性和类型安全的关键！
