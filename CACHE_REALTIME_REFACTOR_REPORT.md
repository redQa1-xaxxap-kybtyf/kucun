# 缓存与实时系统重构报告

## 执行日期

2025-10-04

## 重构目标

完善 Redis 缓存封装和 WebSocket 实时通信系统，实现缓存失效策略、Redis Pub/Sub 事件解耦，确保类型安全。

## 重构成果

### 1. ✅ 缓存系统完善 (`lib/cache/*`)

#### 核心缓存工具 (`lib/cache/cache.ts`)

**优化特性:**

- ✅ **防缓存穿透** - 空值缓存 (NULL_CACHE_VALUE)
- ✅ **防缓存雪崩** - 随机 TTL抖动 (±20%)
- ✅ **防缓存击穿** - 分布式锁 (getOrSetWithLock)
- ✅ **类型安全** - 泛型支持，无 any 类型
- ✅ **降级策略** - Redis 失败自动降级

**核心API:**

```typescript
// 基础缓存
await getOrSetJSON<Product>(
  'product:123',
  () => prisma.product.findUnique({ where: { id: '123' } }),
  300 // TTL 300秒，自动添加随机抖动
);

// 分布式锁缓存 (热点数据)
await getOrSetWithLock<DashboardStats>(
  'dashboard:stats',
  () => calculateStats(),
  600, // TTL
  { lockTTL: 30 } // 锁超时 30秒
);

// 批量失效
await invalidateNamespace('product:');
```

#### 缓存标签系统 (`lib/cache/tags.ts`)

**特性:**

- ✅ 集中管理所有缓存标签
- ✅ 支持资源级别和实例级别标签
- ✅ 便于缓存失效管理

**标签结构:**

```typescript
CacheTags = {
  Products: {
    all: 'products',
    list: 'products:list',
    detail: id => `products:${id}`,
    variants: id => `products:${id}:variants`,
  },
  Inventory: {
    all: 'inventory',
    summary: productId => `inventory:summary:${productId}`,
    alerts: 'inventory:alerts',
  },
  // ... 更多资源标签
};
```

#### 服务器组件缓存 (`lib/cache/server.ts`)

**三层缓存架构:**

```
React cache()        -> 请求级缓存
  ↓
Next.js cache()      -> 构建时和运行时缓存
  ↓
Redis                -> 跨进程持久化缓存
```

**API:**

```typescript
// 查询缓存
const getProducts = cachedQuery(
  async params => prisma.product.findMany(params),
  { tags: [CacheTags.Products.list], revalidate: 60 }
);

// 统计数据缓存
const getStats = cachedStats(async () => calculateDashboardStats(), {
  tags: [CacheTags.Dashboard.stats],
  redisTTL: 600,
});

// 详情页缓存
const getProduct = cachedDetail(
  async id => prisma.product.findUnique({ where: { id } }),
  id => [CacheTags.Products.detail(id)]
);
```

### 2. ✅ Redis Pub/Sub 事件系统 (`lib/cache/pubsub.ts`)

#### 事件通道定义

```typescript
const PubSubChannels = {
  cacheInvalidation: 'channel:cache:invalidate',
  dataUpdate: 'channel:data:update',
  inventoryChange: 'channel:inventory:change',
  orderStatusChange: 'channel:order:status',
  financeChange: 'channel:finance:change',
};
```

#### 事件类型 (完全类型安全)

```typescript
// 缓存失效事件
interface CacheInvalidationEvent {
  type: 'cache:invalidate';
  tag: string;
  timestamp: number;
  source?: string;
}

// 数据更新事件
interface DataUpdateEvent {
  type: 'data:update';
  resource: string;
  id: string;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
}

// 库存变更事件
interface InventoryChangeEvent {
  type: 'inventory:change';
  productId: string;
  variantId?: string;
  oldQuantity: number;
  newQuantity: number;
  reason: string;
  timestamp: number;
}
```

#### 发布订阅API

```typescript
// 发布事件
await publishInventoryChange({
  productId: '123',
  oldQuantity: 100,
  newQuantity: 95,
  reason: '销售出库',
});

// 订阅事件
subscribeChannel(
  PubSubChannels.inventoryChange,
  async (event: InventoryChangeEvent) => {
    // 失效相关缓存
    await revalidateInventory(event.productId);

    // 推送实时通知
    wsServer.publish('inventory', event);
  }
);
```

### 3. ✅ WebSocket 服务重构 (`lib/ws/ws-server.ts`)

#### 类型安全改进

**重构前:**

```typescript
// ❌ 使用 any 类型
const g = globalThis as any;
let redisSubscriber: typeof redis | null = null;
```

**重构后:**

```typescript
// ✅ 完全类型安全
interface GlobalWithWsServer {
  [key: symbol]: ServerApi;
}
const g = globalThis as GlobalWithWsServer;

let redisSubscriber: ReturnType<typeof redis.getClient> | null = null;
let redisPublisher: ReturnType<typeof redis.getClient> | null = null;
```

#### Redis Pub/Sub 集成

```typescript
// WebSocket 服务器集成 Redis Pub/Sub
function setupWebSocketHandlers() {
  // 订阅 Redis 频道
  redisSubscriber.on('message', (channel: string, message: string) => {
    if (channel.startsWith('ws:')) {
      const wsChannel = channel.slice(3);
      const data = JSON.parse(message);

      // 广播到所有 WebSocket 客户端
      broadcast(wsChannel, data);
    }
  });

  // WebSocket 消息转发到 Redis
  wss.on('connection', (socket, request) => {
    socket.on('message', data => {
      const msg = JSON.parse(String(data));

      if (msg.type === 'subscribe') {
        subscribe(client, msg.channel);
      }
    });
  });
}
```

### 4. ✅ 缓存失效策略

#### TTL 失效

```typescript
// 自动过期
await redis.setJson('product:123', data, 300);

// 随机 TTL (防雪崩)
const ttl = getRandomTTL(300, 20); // 240-360秒
await redis.setJson('product:123', data, ttl);
```

#### 标签失效

```typescript
// Next.js 标签失效
import { revalidateTag } from 'next/cache';

await revalidateTag(CacheTags.Products.list);
await revalidateTag(CacheTags.Products.detail('123'));
```

#### 命名空间失效

```typescript
// Redis 模式匹配失效
await invalidateNamespace('product:'); // 失效所有产品缓存
await invalidateNamespace('inventory:*'); // 失效所有库存缓存
```

#### 依赖失效 (级联)

```typescript
// 创建产品时，失效相关缓存
export async function revalidateProducts() {
  await Promise.all([
    revalidateTag(CacheTags.Products.all),
    revalidateTag(CacheTags.Products.list),
    revalidateTag(CacheTags.Products.search),
    invalidateNamespace('products:list:'), // Redis 缓存
  ]);
}

// 更新库存时，级联失效
export async function revalidateInventory(productId: string) {
  await Promise.all([
    revalidateTag(CacheTags.Inventory.summary(productId)),
    revalidateTag(CacheTags.Products.detail(productId)),
    revalidateTag(CacheTags.Dashboard.overview),
  ]);
}
```

### 5. ✅ 业务事件解耦

#### 事件驱动架构

```
业务逻辑 -> 发布事件 -> Redis Pub/Sub -> 订阅者
                                         ├─ 缓存失效
                                         ├─ WebSocket 推送
                                         └─ 审计日志
```

#### 示例：创建订单流程

```typescript
// app/api/sales-orders/route.ts
export async function POST(req: Request) {
  // 1. 创建订单
  const order = await prisma.salesOrder.create({ data });

  // 2. 发布事件 (解耦)
  await publishDataUpdate('sales-orders', order.id, 'create');
  await publishInventoryChange({
    productId: item.productId,
    oldQuantity: 100,
    newQuantity: 95,
    reason: '销售出库',
  });

  // 3. 返回响应
  return Response.json(order);
}

// lib/cache/init.ts - 事件订阅
subscribeChannel(PubSubChannels.dataUpdate, async event => {
  if (event.resource === 'sales-orders') {
    // 失效订单相关缓存
    await revalidateSalesOrders();
  }
});

subscribeChannel(PubSubChannels.inventoryChange, async event => {
  // 失效库存缓存
  await revalidateInventory(event.productId);

  // 推送实时通知到 WebSocket 客户端
  wsServer.publish('inventory', event);
});
```

## 架构图

### 缓存架构

```
┌─────────────────────────────────────────────────┐
│          Client Components (React)               │
│       TanStack Query (客户端缓存)               │
└────────────┬────────────────────────────────────┘
             │ HTTP API
             ↓
┌─────────────────────────────────────────────────┐
│              API Routes (Next.js)                │
│         Redis 缓存 (getOrSetJSON)                │
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│         Server Components (Next.js)              │
│  React cache() + Next.js cache() + Redis         │
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│              Database (Prisma)                   │
└─────────────────────────────────────────────────┘
```

### 实时通信架构

```
┌─────────────────────────────────────────────────┐
│          业务操作 (CRUD)                         │
└────────────┬────────────────────────────────────┘
             │ publishEvent()
             ↓
┌─────────────────────────────────────────────────┐
│          Redis Pub/Sub (事件总线)                │
└─────┬──────────────────────────┬────────────────┘
      │                          │
      ↓                          ↓
┌─────────────┐          ┌─────────────────────┐
│ 缓存失效    │          │  WebSocket 服务器   │
│ revalidate  │          │  (ws-server.ts)     │
└─────────────┘          └──────────┬──────────┘
                                    │ broadcast()
                                    ↓
                         ┌─────────────────────┐
                         │  WebSocket 客户端   │
                         │  (实时UI更新)       │
                         └─────────────────────┘
```

## 类型安全改进

### 消除的 any 类型

1. ✅ `ws-server.ts:23` - `globalThis as any` → `globalThis as GlobalWithWsServer`
2. ✅ `ws-server.ts:31-32` - Redis客户端类型 → `ReturnType<typeof redis.getClient>`
3. ✅ 所有缓存函数使用泛型 `<T>` 替代 any

### 类型安全示例

```typescript
// ✅ 完全类型推断
const product = await getOrSetJSON<Product>(
  'product:123',
  () => prisma.product.findUnique({ where: { id: '123' } }),
  300
);
// product 类型: Product | null

// ✅ 事件类型检查
await publishInventoryChange({
  productId: '123',
  oldQuantity: 100,
  newQuantity: 95,
  reason: '销售出库',
}); // 类型安全，缺少字段会报错

// ✅ 订阅处理器类型检查
subscribeChannel(
  PubSubChannels.inventoryChange,
  async (event: InventoryChangeEvent) => {
    // event 类型完全推断
    console.log(event.productId, event.newQuantity);
  }
);
```

## 性能优化

### 1. 缓存命中率提升

- 随机 TTL 防止雪崩
- 空值缓存防止穿透
- 分布式锁防止击穿

### 2. Redis 连接池

- 连接池大小: 3 (默认)
- 自动重连机制
- 降级到内存缓存

### 3. WebSocket 优化

- Redis Pub/Sub 跨实例通信
- 心跳检测 (25秒)
- 自动重连 (客户端)

## 使用指南

### 缓存最佳实践

#### 1. 静态数据 (低频变更)

```typescript
// 产品详情 - 缓存1小时
const getProduct = cachedDetail(
  async id => prisma.product.findUnique({ where: { id } }),
  id => [CacheTags.Products.detail(id)]
);
```

#### 2. 动态数据 (中频变更)

```typescript
// 产品列表 - 缓存5分钟
const getProducts = cachedList(
  async params => prisma.product.findMany(params),
  { tags: [CacheTags.Products.list], revalidate: 60 }
);
```

#### 3. 高频数据 (实时性要求高)

```typescript
// 库存数据 - 缓存10秒
await getOrSetJSON(
  'inventory:123',
  () => getInventory('123'),
  10 // 短 TTL
);
```

#### 4. 统计数据 (计算开销大)

```typescript
// 仪表盘统计 - 缓存10分钟，使用分布式锁
await getOrSetWithLock('dashboard:stats', () => calculateStats(), 600, {
  lockTTL: 30,
});
```

### 缓存失效示例

```typescript
// API Route 示例
export async function POST(req: Request) {
  const product = await prisma.product.create({ data });

  // 发布事件 (推荐)
  await publishDataUpdate('products', product.id, 'create');

  // 或直接失效 (简单场景)
  await revalidateProducts();

  return Response.json(product);
}
```

## 监控和调试

### 缓存统计

```typescript
const stats = await getCacheStats();
console.log({
  totalKeys: stats.totalKeys,
  memoryUsed: stats.memoryUsed,
  hitRate: stats.hitRate, // 命中率百分比
});
```

### 事件日志

```typescript
// 启用开发环境日志
subscribeChannel(PubSubChannels.dataUpdate, async event => {
  console.log('[Event] Data updated:', event);
});
```

## 遵循规范

✅ 类型安全 - 消除所有 any 类型
✅ 代码质量 - 遵循 ESLint 规则
✅ 缓存策略 - TTL、标签、依赖失效
✅ 事件解耦 - Redis Pub/Sub 解耦业务
✅ 性能优化 - 防穿透、防雪崩、防击穿

## 关键文件清单

- ✅ `lib/cache/cache.ts` - 核心缓存工具 (已优化)
- ✅ `lib/cache/server.ts` - 服务器组件缓存 (已优化)
- ✅ `lib/cache/tags.ts` - 缓存标签系统 (已优化)
- ✅ `lib/cache/pubsub.ts` - Redis Pub/Sub (已优化)
- ✅ `lib/cache/revalidate.ts` - 缓存失效策略 (已有)
- ✅ `lib/ws/ws-server.ts` - WebSocket 服务 (类型安全)
- ✅ `lib/ws/ws-client.ts` - WebSocket 客户端 (已有)
