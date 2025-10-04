# 统一缓存管理系统使用指南

## 架构概述

本项目采用多层缓存架构，确保最佳性能和数据一致性：

```
┌─────────────────────────────────────────────────────────┐
│                 Client Components                        │
│          (TanStack Query + API 调用)                     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
                       ↓
┌─────────────────────────────────────────────────────────┐
│                   API Routes                             │
│              (Redis 缓存 + Pub/Sub)                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│              Server Components                           │
│   React cache() + Next.js cache + Redis                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  Database (Prisma)                       │
└─────────────────────────────────────────────────────────┘
```

## 核心概念

### 1. 缓存标签 (Cache Tags)

统一的缓存标签系统，便于精确失效：

```typescript
import { CacheTags } from '@/lib/cache';

// 使用预定义标签
CacheTags.Products.all;           // 'products'
CacheTags.Products.list;          // 'products:list'
CacheTags.Products.detail('123'); // 'products:123'
CacheTags.Inventory.summary('p1'); // 'inventory:summary:p1'
```

### 2. 缓存层级

**L1: React cache()** - 请求级缓存，同一请求内复用
- 作用域：单个 HTTP 请求
- 生命周期：请求结束自动清除
- 适用：服务器组件数据获取

**L2: Next.js unstable_cache** - 应用级缓存
- 作用域：单个 Next.js 进程
- 生命周期：由 revalidate 或 revalidateTag 控制
- 适用：静态数据、低频变更数据

**L3: Redis** - 分布式缓存
- 作用域：跨进程、跨服务器
- 生命周期：由 TTL 或手动失效控制
- 适用：所有场景，特别是多实例部署

## 使用场景

### 场景 1: 服务器组件获取数据

**基础用法 - 产品列表**

```typescript
// app/(dashboard)/products/page.tsx
import { cachedQuery, CacheTags } from '@/lib/cache';
import { prisma } from '@/lib/db';

// 定义缓存查询函数
const getProducts = cachedQuery(
  async (params: { page: number; limit: number }) => {
    return await prisma.product.findMany({
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: { category: true },
    });
  },
  {
    tags: [CacheTags.Products.list],
    revalidate: 60, // Next.js 缓存 1 分钟
    redis: true,
    redisTTL: 180, // Redis 缓存 3 分钟
  }
);

// 在服务器组件中使用
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Number(searchParams.page) || 1;
  const products = await getProducts({ page, limit: 20 });

  return <ProductList products={products} />;
}
```

**详情页用法 - 产品详情**

```typescript
// app/(dashboard)/products/[id]/page.tsx
import { cachedDetail, CacheTags } from '@/lib/cache';
import { prisma } from '@/lib/db';

const getProductDetail = cachedDetail(
  async (id: string) => {
    return await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
        inventory: true,
      },
    });
  },
  (id: string) => [CacheTags.Products.detail(id)]
);

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProductDetail(params.id);

  if (!product) {
    notFound();
  }

  return <ProductDetail product={product} />;
}
```

**统计数据用法 - 仪表盘**

```typescript
// app/(dashboard)/page.tsx
import { cachedStats, CacheTags } from '@/lib/cache';
import { prisma } from '@/lib/db';

const getDashboardStats = cachedStats(
  async () => {
    const [ordersCount, revenue, inventoryValue] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.salesOrder.aggregate({
        _sum: { totalAmount: true },
      }),
      prisma.inventory.aggregate({
        _sum: { quantity: true },
      }),
    ]);

    return {
      ordersCount,
      revenue: revenue._sum.totalAmount || 0,
      inventoryValue: inventoryValue._sum.quantity || 0,
    };
  },
  {
    tags: [CacheTags.Dashboard.stats],
    redisTTL: 600, // 统计数据缓存 10 分钟
  }
);

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return <DashboardOverview stats={stats} />;
}
```

### 场景 2: API 路由使用 Redis 缓存

**GET 请求 - 产品列表 API**

```typescript
// app/api/products/route.ts
import { type NextRequest } from 'next/server';
import { getOrSetJSON, buildCacheKey, revalidateProducts } from '@/lib/cache';
import { withAuth, successResponse } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

export const GET = withAuth(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);

    const params = {
      page: Number(searchParams.get('page')) || 1,
      limit: Number(searchParams.get('limit')) || 20,
      search: searchParams.get('search') || undefined,
    };

    // 构建缓存键
    const cacheKey = buildCacheKey('products:list', params);

    // 获取或设置缓存
    const data = await getOrSetJSON(
      cacheKey,
      async () => {
        // 从数据库查询
        const [products, total] = await Promise.all([
          prisma.product.findMany({
            where: params.search
              ? { name: { contains: params.search } }
              : undefined,
            skip: (params.page - 1) * params.limit,
            take: params.limit,
          }),
          prisma.product.count({
            where: params.search
              ? { name: { contains: params.search } }
              : undefined,
          }),
        ]);

        return {
          products,
          pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
          },
        };
      },
      300, // 缓存 5 分钟
      {
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: true, // 防止缓存穿透
      }
    );

    return successResponse(data);
  },
  { permissions: ['products:view'] }
);
```

**POST 请求 - 创建产品并失效缓存**

```typescript
// app/api/products/route.ts (续)
import { revalidateProducts, publishDataUpdate } from '@/lib/cache';

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const body = await request.json();

    // 验证数据
    const validatedData = productCreateSchema.parse(body);

    // 创建产品
    const product = await prisma.product.create({
      data: {
        ...validatedData,
        createdBy: user.id,
      },
    });

    // 失效相关缓存
    await revalidateProducts();

    // 发布实时更新事件（通过 Pub/Sub）
    await publishDataUpdate('products', product.id, 'create');

    return successResponse(product, '产品创建成功');
  },
  { permissions: ['products:create'] }
);
```

**PUT 请求 - 更新产品**

```typescript
// app/api/products/[id]/route.ts
import { revalidateProducts, publishDataUpdate } from '@/lib/cache';

export const PUT = withAuth(
  async (request: NextRequest, context: { params: { id: string } }) => {
    const { id } = context.params;
    const body = await request.json();

    const product = await prisma.product.update({
      where: { id },
      data: body,
    });

    // 失效特定产品的缓存
    await revalidateProducts(id);

    // 发布更新事件
    await publishDataUpdate('products', id, 'update');

    return successResponse(product, '产品更新成功');
  },
  { permissions: ['products:edit'] }
);
```

### 场景 3: 客户端组件使用 TanStack Query

**列表页面**

```typescript
// components/products/product-list-client.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { CacheTags } from '@/lib/cache';

interface ProductListProps {
  initialData?: Product[];
  params: { page: number; search?: string };
}

export function ProductListClient({ initialData, params }: ProductListProps) {
  const { data, isLoading } = useQuery({
    // 使用统一的缓存标签作为 queryKey
    queryKey: [CacheTags.Products.list, params],
    queryFn: async () => {
      const response = await fetch(
        `/api/products?${new URLSearchParams(params as any)}`
      );
      return response.json();
    },
    initialData,
    staleTime: 60000, // 1 分钟内认为数据新鲜
    gcTime: 300000, // 5 分钟后清理未使用的缓存
  });

  if (isLoading) return <Loading />;

  return <ProductTable products={data.products} />;
}
```

**创建/更新操作**

```typescript
// components/products/product-form-client.tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CacheTags } from '@/lib/cache';

export function ProductFormClient() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: ProductCreateData) => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      // 失效相关查询
      queryClient.invalidateQueries({
        queryKey: [CacheTags.Products.list]
      });
      queryClient.invalidateQueries({
        queryKey: [CacheTags.Dashboard.stats]
      });
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      createMutation.mutate(formData);
    }}>
      {/* 表单字段 */}
    </form>
  );
}
```

### 场景 4: 级联缓存失效

系统会自动处理相关缓存的级联失效：

```typescript
// app/api/inventory/adjust/route.ts
import { revalidateInventory } from '@/lib/cache';

export const POST = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();

    // 调整库存
    await prisma.inventory.update({
      where: { id: body.inventoryId },
      data: { quantity: body.newQuantity },
    });

    // 只需失效库存缓存
    await revalidateInventory(body.productId);

    // 系统会自动级联失效以下缓存：
    // - 产品列表 (CacheTags.Products.list)
    // - 仪表盘统计 (CacheTags.Dashboard.overview)
    // - 库存告警 (CacheTags.Dashboard.alerts)
    // - 销售订单列表 (CacheTags.SalesOrders.list)

    return successResponse(null, '库存调整成功');
  },
  { permissions: ['inventory:adjust'] }
);
```

## 缓存策略建议

### 高频查询，低频变更（如产品详情）

```typescript
import { CACHE_STRATEGY } from '@/lib/cache';

const getProduct = cachedDetail(
  async (id: string) => prisma.product.findUnique({ where: { id } }),
  (id) => [CacheTags.Products.detail(id)]
);

// 使用预定义策略
const getProduct = cachedQuery(
  async (id: string) => prisma.product.findUnique({ where: { id } }),
  {
    tags: [(id: string) => CacheTags.Products.detail(id)],
    ...CACHE_STRATEGY.staticData, // { redis: true, redisTTL: 3600, revalidate: 1800 }
  }
);
```

### 中频查询，中频变更（如产品列表）

```typescript
const getProducts = cachedList(
  async (params) => prisma.product.findMany(params),
  {
    tags: [CacheTags.Products.list],
    ...CACHE_STRATEGY.dynamicData, // { redis: true, redisTTL: 300, revalidate: 60 }
  }
);
```

### 高频查询，高频变更（如库存）

```typescript
const getInventory = cachedQuery(
  async (productId) => prisma.inventory.findMany({ where: { productId } }),
  {
    tags: [CacheTags.Inventory.summary(productId)],
    ...CACHE_STRATEGY.volatileData, // { redis: true, redisTTL: 60, revalidate: 30 }
  }
);
```

### 统计数据，计算开销大

```typescript
const getStats = cachedStats(
  async () => {
    // 复杂聚合查询
    return await computeExpensiveStats();
  },
  {
    tags: [CacheTags.Dashboard.stats],
    ...CACHE_STRATEGY.aggregateData, // { redis: true, redisTTL: 600, revalidate: 300 }
  }
);
```

### 实时数据，不缓存

```typescript
const getRealtime = cachedQuery(
  async () => {
    return await prisma.order.findMany({
      where: { status: 'processing' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  },
  {
    tags: [CacheTags.SalesOrders.list],
    ...CACHE_STRATEGY.realtimeData, // { redis: false, revalidate: 0 }
  }
);
```

## 最佳实践

### 1. 始终使用预定义的缓存标签

```typescript
// ✅ 推荐
import { CacheTags } from '@/lib/cache';
await revalidateCache(CacheTags.Products.detail(id));

// ❌ 不推荐
await revalidateCache(`products:${id}`);
```

### 2. 在数据变更时主动失效缓存

```typescript
// ✅ 推荐 - 变更后立即失效
await prisma.product.update({ where: { id }, data });
await revalidateProducts(id);

// ❌ 不推荐 - 依赖 TTL 自然过期
await prisma.product.update({ where: { id }, data });
// 等待缓存过期...
```

### 3. 利用级联失效避免手动管理

```typescript
// ✅ 推荐 - 只失效直接相关的缓存
await revalidateSalesOrders(orderId);
// 系统自动失效: 财务、库存、仪表盘等相关缓存

// ❌ 不推荐 - 手动失效所有相关缓存
await revalidateSalesOrders(orderId);
await revalidateFinance('receivables');
await revalidateInventory();
await revalidateDashboard();
```

### 4. 为热点数据使用分布式锁

```typescript
import { getOrSetWithLock } from '@/lib/cache';

// 防止缓存击穿（热点数据失效时大量请求同时查询数据库）
const getHotProduct = async (id: string) => {
  return await getOrSetWithLock(
    `product:${id}`,
    async () => {
      return await prisma.product.findUnique({ where: { id } });
    },
    300 // TTL
  );
};
```

### 5. 在应用启动时初始化缓存系统

```typescript
// app/layout.tsx 或 middleware.ts
import { initializeCacheSystem } from '@/lib/cache';

// 应用启动时调用一次
initializeCacheSystem();
```

## 监控和调试

### 1. 查看缓存命中率

```typescript
// 在开发环境启用缓存日志
if (process.env.NODE_ENV === 'development') {
  const originalGetOrSet = getOrSetJSON;
  getOrSetJSON = async (...args) => {
    const start = Date.now();
    const result = await originalGetOrSet(...args);
    console.log(`[Cache] ${args[0]} - ${Date.now() - start}ms`);
    return result;
  };
}
```

### 2. 手动清除缓存（开发调试）

```typescript
// app/api/admin/clear-cache/route.ts
import { redis } from '@/lib/cache';

export async function POST(request: NextRequest) {
  const { pattern } = await request.json();

  // 清除匹配的缓存
  const deleted = await redis.scanDel(pattern || '*');

  return Response.json({
    success: true,
    deleted
  });
}
```

### 3. 监控 Redis 性能

```bash
# Redis CLI
redis-cli
> INFO stats
> MONITOR  # 实时查看命令
> KEYS kucun:*  # 查看所有缓存键（仅开发环境）
```

## 常见问题

### Q: 何时使用 Next.js 缓存 vs Redis 缓存？

**Next.js 缓存**：
- 单进程部署
- 静态或准静态数据
- 需要 Build Time 优化

**Redis 缓存**：
- 多进程/多服务器部署
- 动态数据
- 需要跨请求共享

**两者结合**（推荐）：
- 利用 Next.js 的增量静态再生成 (ISR)
- 同时使用 Redis 作为数据源缓存

### Q: 如何避免缓存雪崩？

使用随机 TTL：

```typescript
await getOrSetJSON(
  key,
  fetcher,
  300, // 基础 TTL
  {
    enableRandomTTL: true, // 自动添加 ±20% 抖动
    jitterPercent: 20,
  }
);
```

### Q: 如何避免缓存穿透？

启用空值缓存：

```typescript
await getOrSetJSON(
  key,
  fetcher,
  300,
  {
    enableNullCache: true, // 缓存 null 结果
  }
);
```

### Q: 如何避免缓存击穿？

使用分布式锁：

```typescript
await getOrSetWithLock(key, fetcher, 300);
```

## 总结

本缓存系统提供了：

1. **统一的缓存接口** - 无论是服务器组件、API 路由还是客户端组件
2. **自动级联失效** - 数据变更时自动失效相关缓存
3. **多层缓存架构** - React cache + Next.js cache + Redis
4. **防护机制** - 防止缓存雪崩、穿透、击穿
5. **实时通知** - 通过 Redis Pub/Sub 实现跨进程缓存同步

遵循本指南的最佳实践，可以显著提升应用性能，同时保持数据一致性。
