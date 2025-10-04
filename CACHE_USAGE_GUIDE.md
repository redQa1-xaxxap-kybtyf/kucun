# 缓存与实时系统使用指南

## 快速开始

### 1. 基础缓存使用

#### 简单缓存

```typescript
import { getOrSetJSON } from '@/lib/cache';

// 产品详情缓存
const product = await getOrSetJSON<Product>(
  'product:123',
  async () => {
    return await prisma.product.findUnique({ where: { id: '123' } });
  },
  300 // TTL 300秒，自动添加随机抖动防雪崩
);
```

#### 分布式锁缓存 (防击穿)

```typescript
import { getOrSetWithLock } from '@/lib/cache';

// 热点数据缓存
const stats = await getOrSetWithLock<DashboardStats>(
  'dashboard:stats',
  async () => {
    return await calculateDashboardStats();
  },
  600, // 缓存 10 分钟
  { lockTTL: 30 } // 锁超时 30 秒
);
```

### 2. 服务器组件缓存

#### 查询缓存

```typescript
import { cachedQuery, CacheTags } from '@/lib/cache';

// 定义缓存查询函数
const getProducts = cachedQuery(
  async (params: ProductQueryParams) => {
    return await prisma.product.findMany({
      where: params.search ? { name: { contains: params.search } } : {},
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    });
  },
  {
    tags: [CacheTags.Products.list],
    revalidate: 60, // Next.js 缓存 60 秒
    redisTTL: 300,  // Redis 缓存 5 分钟
  }
);

// 在服务器组件中使用
export default async function ProductsPage() {
  const products = await getProducts({ page: 1, limit: 20, search: '' });

  return <ProductList products={products} />;
}
```

#### 详情页缓存

```typescript
import { cachedDetail, CacheTags } from '@/lib/cache';

const getProductDetail = cachedDetail(
  async (id: string) => {
    return await prisma.product.findUnique({
      where: { id },
      include: { category: true, variants: true },
    });
  },
  (id: string) => [CacheTags.Products.detail(id)]
);

// 使用
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductDetail(params.id);

  return <ProductDetail product={product} />;
}
```

### 3. 缓存失效

#### 手动失效

```typescript
import { revalidateTag } from 'next/cache';
import { invalidateNamespace, CacheTags } from '@/lib/cache';

// 失效特定标签 (Next.js 缓存)
await revalidateTag(CacheTags.Products.list);
await revalidateTag(CacheTags.Products.detail('123'));

// 失效命名空间 (Redis 缓存)
await invalidateNamespace('product:');
```

#### 便捷失效函数

```typescript
import {
  revalidateProducts,
  revalidateInventory,
  revalidateCustomers,
  revalidateSalesOrders,
} from '@/lib/cache';

// 创建产品后
await revalidateProducts();

// 更新库存后
await revalidateInventory('product-id');

// 创建订单后
await revalidateSalesOrders();
```

### 4. 事件发布订阅

#### 发布事件

```typescript
import {
  publishDataUpdate,
  publishInventoryChange,
  publishOrderStatusChange,
} from '@/lib/cache';

// API Route 中发布事件
export async function POST(req: Request) {
  const order = await prisma.salesOrder.create({ data });

  // 发布数据更新事件
  await publishDataUpdate('sales-orders', order.id, 'create');

  // 发布库存变更事件
  await publishInventoryChange({
    productId: item.productId,
    oldQuantity: 100,
    newQuantity: 95,
    reason: '销售出库',
  });

  return Response.json(order);
}
```

#### 订阅事件

```typescript
import { subscribeChannel, PubSubChannels } from '@/lib/cache';

// 在应用启动时订阅
subscribeChannel(PubSubChannels.inventoryChange, async event => {
  console.log('[Inventory] Change detected:', event);

  // 失效相关缓存
  await revalidateInventory(event.productId);

  // 推送 WebSocket 通知
  wsServer.publish('inventory', event);
});
```

### 5. WebSocket 实时通信

#### 服务器端发布

```typescript
import { wsServer } from '@/lib/ws/ws-server';

// 发布实时消息
wsServer.publish('inventory', {
  type: 'inventory:change',
  productId: '123',
  newQuantity: 95,
});
```

#### 客户端订阅

```typescript
import { createWsClient } from '@/lib/ws/ws-client';

const ws = createWsClient();

// 连接
ws.connect();

// 订阅频道
ws.subscribe('inventory');

// 接收消息
ws.onMessage<InventoryChangeEvent>(message => {
  console.log('Inventory changed:', message.data);

  // 更新 UI
  queryClient.invalidateQueries(['inventory', message.data.productId]);
});
```

## 缓存策略推荐

### 静态数据 (高缓存，低失效)

```typescript
// 产品详情、分类信息
const product = cachedDetail(
  async id => getProduct(id),
  id => [CacheTags.Products.detail(id)]
);
// TTL: 1小时
```

### 动态数据 (中缓存，中失效)

```typescript
// 产品列表、客户列表
const products = cachedList(async params => getProducts(params), {
  tags: [CacheTags.Products.list],
  revalidate: 60,
});
// TTL: 5分钟
```

### 高频数据 (低缓存，高失效)

```typescript
// 库存数据、订单状态
const inventory = await getOrSetJSON(
  `inventory:${productId}`,
  () => getInventory(productId),
  10 // TTL: 10秒
);
```

### 统计数据 (高缓存，分布式锁)

```typescript
// 仪表盘统计、报表数据
const stats = await getOrSetWithLock(
  'dashboard:stats',
  () => calculateStats(),
  600, // TTL: 10分钟
  { lockTTL: 30 } // 锁: 30秒
);
```

## 完整示例：产品 CRUD

### 创建产品

```typescript
// app/api/products/route.ts
export async function POST(req: Request) {
  const data = await req.json();

  // 1. 创建产品
  const product = await prisma.product.create({ data });

  // 2. 发布事件 (解耦，推荐)
  await publishDataUpdate('products', product.id, 'create');

  // 或直接失效缓存 (简单场景)
  // await revalidateProducts();

  return Response.json({ success: true, data: product });
}
```

### 更新产品

```typescript
export async function PUT(req: Request) {
  const { id, ...data } = await req.json();

  // 1. 更新产品
  const product = await prisma.product.update({
    where: { id },
    data,
  });

  // 2. 失效特定产品缓存
  await revalidateTag(CacheTags.Products.detail(id));
  await revalidateTag(CacheTags.Products.list);

  // 3. 发布事件
  await publishDataUpdate('products', id, 'update');

  return Response.json({ success: true, data: product });
}
```

### 删除产品

```typescript
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  // 1. 删除产品
  await prisma.product.delete({ where: { id } });

  // 2. 失效缓存
  await revalidateProducts();

  // 3. 发布事件
  await publishDataUpdate('products', id, 'delete');

  return Response.json({ success: true });
}
```

### 查询产品

```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  // 构建缓存键
  const cacheKey = buildCacheKey('products:list', { page, limit });

  // 使用缓存
  const data = await getOrSetJSON(
    cacheKey,
    async () => {
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.product.count(),
      ]);

      return { products, total };
    },
    300 // TTL 5分钟
  );

  return Response.json({
    success: true,
    data: data.products,
    pagination: {
      page,
      limit,
      total: data.total,
      totalPages: Math.ceil(data.total / limit),
    },
  });
}
```

## 事件订阅初始化

### lib/cache/init.ts

```typescript
import {
  subscribeChannel,
  PubSubChannels,
  revalidateProducts,
  revalidateInventory,
  revalidateSalesOrders,
} from '@/lib/cache';
import { wsServer } from '@/lib/ws/ws-server';

export function initializeCacheSystem() {
  console.log('[Cache] 初始化缓存事件系统...');

  // 订阅缓存失效事件
  subscribeChannel(PubSubChannels.cacheInvalidation, async event => {
    console.log('[Cache] 失效标签:', event.tag);
    // Next.js 缓存失效由 revalidateTag 处理
  });

  // 订阅数据更新事件
  subscribeChannel(PubSubChannels.dataUpdate, async event => {
    console.log('[Cache] 数据更新:', event);

    // 根据资源类型失效缓存
    if (event.resource === 'products') {
      await revalidateProducts();
    } else if (event.resource === 'sales-orders') {
      await revalidateSalesOrders();
    }

    // 推送 WebSocket 通知
    wsServer.publish(event.resource, event);
  });

  // 订阅库存变更事件
  subscribeChannel(PubSubChannels.inventoryChange, async event => {
    console.log('[Cache] 库存变更:', event);

    // 失效库存缓存
    await revalidateInventory(event.productId);

    // 推送 WebSocket 通知
    wsServer.publish('inventory', event);
  });

  console.log('[Cache] 缓存事件系统初始化完成');
}
```

## 监控和调试

### 缓存统计

```typescript
import { getCacheStats } from '@/lib/cache';

const stats = await getCacheStats();
console.log('缓存统计:', {
  键总数: stats.totalKeys,
  内存使用: stats.memoryUsed,
  命中率: stats.hitRate ? `${stats.hitRate.toFixed(2)}%` : '未知',
});
```

### 开发环境日志

```typescript
if (process.env.NODE_ENV === 'development') {
  subscribeChannel(PubSubChannels.dataUpdate, async event => {
    console.log('[Debug] 数据更新事件:', event);
  });
}
```

## 常见问题

### Q: 如何选择缓存 TTL?

**A:** 根据数据变更频率:

- 静态数据 (产品详情): 1小时
- 列表数据 (产品列表): 5分钟
- 实时数据 (库存): 10秒
- 统计数据 (仪表盘): 10分钟

### Q: 何时使用分布式锁?

**A:** 热点数据、统计数据、计算开销大的数据

### Q: 缓存失效策略如何选择?

**A:**

- 简单场景: 直接调用 `revalidateProducts()`
- 复杂场景: 使用事件发布 `publishDataUpdate()`

### Q: WebSocket 和缓存如何配合?

**A:** 订阅缓存失效事件 → 推送 WebSocket 通知 → 客户端更新

## 性能优化建议

1. **使用随机 TTL** - 防止缓存雪崩
2. **启用空值缓存** - 防止缓存穿透
3. **使用分布式锁** - 防止缓存击穿
4. **合理设置 TTL** - 平衡性能和实时性
5. **批量操作** - 使用 `Promise.all` 并发
6. **监控缓存命中率** - 定期检查 `getCacheStats()`

## 参考文档

- 完整报告: `CACHE_REALTIME_REFACTOR_REPORT.md`
- 缓存模块: `lib/cache/*`
- WebSocket: `lib/ws/*`
