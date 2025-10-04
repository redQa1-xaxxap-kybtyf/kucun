# 缓存系统重构总结

## 完成的工作

### 1. 核心架构设计 ✅

创建了统一的多层缓存架构：

```
Client Components (TanStack Query)
         ↓
    API Routes (Redis)
         ↓
Server Components (React cache + Next.js + Redis)
         ↓
    Database (Prisma)
```

### 2. 核心模块实现 ✅

#### `lib/cache/tags.ts` - 缓存标签系统
- 定义了所有业务资源的缓存标签
- 统一的标签命名规范：`resource:action:id`
- 类型安全的标签定义

#### `lib/cache/revalidate.ts` - 缓存失效管理
- 统一的缓存失效 API
- 自动级联失效相关缓存
- 集成 Next.js `revalidateTag` 和 Redis 缓存清除
- 便捷的失效函数：`revalidateProducts()`, `revalidateInventory()` 等

#### `lib/cache/server.ts` - 服务器组件缓存包装器
- `cachedServerFn()` - 通用服务器函数缓存
- `cachedQuery()` - 查询函数缓存
- `cachedStats()` - 统计数据缓存
- `cachedDetail()` - 详情页缓存
- `cachedList()` - 列表页缓存

#### `lib/cache/pubsub.ts` - Redis Pub/Sub 事件系统
- 跨进程缓存失效通知
- 实时数据更新通知
- 事件类型定义和发布/订阅函数

#### `lib/cache/init.ts` - 缓存系统初始化
- 应用启动时初始化 Pub/Sub 订阅
- 事件处理器注册

#### `lib/cache/index.ts` - 统一导出
- 导出所有缓存相关函数和类型
- 提供预定义的缓存策略配置

### 3. 现有模块优化 ✅

#### `lib/cache/cache.ts` - 基础缓存工具
- 已有的 `getOrSetJSON()` - 获取或设置缓存
- 已有的 `getOrSetWithLock()` - 带分布式锁的缓存
- 已有的 `buildCacheKey()` - 缓存键生成
- 已有的防护机制：
  - 空值缓存（防止缓存穿透）
  - 随机 TTL（防止缓存雪崩）
  - 分布式锁（防止缓存击穿）

#### 业务缓存模块
- `lib/cache/product-cache.ts` - 产品缓存
- `lib/cache/inventory-cache.ts` - 库存缓存
- `lib/cache/finance-cache.ts` - 财务缓存

### 4. 文档完善 ✅

#### `docs/cache-system-guide.md` - 完整使用指南
- 架构概述
- 核心概念解释
- 5 个实际使用场景示例
- 缓存策略建议
- 最佳实践
- 常见问题解答

## 核心特性

### 1. 统一的缓存标签系统

```typescript
import { CacheTags } from '@/lib/cache';

// 预定义标签，类型安全
CacheTags.Products.list         // 'products:list'
CacheTags.Products.detail('123') // 'products:123'
CacheTags.Inventory.summary('p1') // 'inventory:summary:p1'
```

### 2. 自动级联失效

```typescript
// 只需失效库存缓存
await revalidateInventory(productId);

// 系统自动级联失效：
// - 产品列表
// - 仪表盘统计
// - 库存告警
// - 销售订单列表
```

### 3. 多层缓存策略

**L1: React cache()** - 请求级缓存
```typescript
const getCachedData = cache(async () => {
  return await prisma.product.findMany();
});
```

**L2: Next.js unstable_cache** - 应用级缓存
```typescript
const getProducts = cachedQuery(
  async () => prisma.product.findMany(),
  { tags: [CacheTags.Products.list], revalidate: 60 }
);
```

**L3: Redis** - 分布式缓存
```typescript
const data = await getOrSetJSON(
  cacheKey,
  async () => fetchFromDB(),
  300 // TTL
);
```

### 4. 跨进程缓存同步

```typescript
// 进程 A: 创建产品
await prisma.product.create({ data });
await revalidateProducts(); // 发布 Pub/Sub 事件

// 进程 B: 自动接收失效通知
// Next.js 缓存自动失效
```

### 5. 防护机制

**防止缓存穿透**（查询不存在的数据）
```typescript
await getOrSetJSON(key, fetcher, ttl, {
  enableNullCache: true, // 缓存 null 结果
});
```

**防止缓存雪崩**（大量缓存同时失效）
```typescript
await getOrSetJSON(key, fetcher, ttl, {
  enableRandomTTL: true, // TTL 随机抖动 ±20%
  jitterPercent: 20,
});
```

**防止缓存击穿**（热点数据失效时大量请求）
```typescript
await getOrSetWithLock(key, fetcher, ttl); // 分布式锁
```

## 使用示例

### 服务器组件

```typescript
// app/(dashboard)/products/page.tsx
import { cachedQuery, CacheTags } from '@/lib/cache';

const getProducts = cachedQuery(
  async (params) => {
    return await prisma.product.findMany(params);
  },
  {
    tags: [CacheTags.Products.list],
    revalidate: 60,
    redis: true,
    redisTTL: 180,
  }
);

export default async function ProductsPage() {
  const products = await getProducts({ page: 1, limit: 20 });
  return <ProductList products={products} />;
}
```

### API 路由

```typescript
// app/api/products/route.ts
import { getOrSetJSON, buildCacheKey, revalidateProducts } from '@/lib/cache';

export const GET = withAuth(async (request) => {
  const params = getSearchParams(request);
  const cacheKey = buildCacheKey('products:list', params);

  const data = await getOrSetJSON(
    cacheKey,
    async () => await queryDatabase(params),
    300
  );

  return successResponse(data);
});

export const POST = withAuth(async (request) => {
  const product = await createProduct(data);

  // 失效缓存
  await revalidateProducts();

  return successResponse(product);
});
```

### 客户端组件

```typescript
// components/products/product-list.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { CacheTags } from '@/lib/cache';

export function ProductList() {
  const { data } = useQuery({
    queryKey: [CacheTags.Products.list, params],
    queryFn: () => fetchProducts(params),
    staleTime: 60000,
  });

  return <Table data={data} />;
}
```

## 迁移指南

### 1. 现有代码迁移

**旧代码：**
```typescript
// 手动构建缓存键
const cacheKey = `products:list:${JSON.stringify(params)}`;

// 手动失效缓存
await redis.del('products:list:*');
await redis.del('inventory:*');
await redis.del('dashboard:*');
```

**新代码：**
```typescript
// 使用统一的缓存键构建
const cacheKey = buildCacheKey('products:list', params);

// 使用统一的失效函数（自动级联）
await revalidateProducts();
```

### 2. 服务器组件添加缓存

**旧代码：**
```typescript
export default async function Page() {
  // 每次请求都查询数据库
  const products = await prisma.product.findMany();
  return <List products={products} />;
}
```

**新代码：**
```typescript
import { cachedQuery, CacheTags } from '@/lib/cache';

const getProducts = cachedQuery(
  async () => prisma.product.findMany(),
  { tags: [CacheTags.Products.list], revalidate: 60 }
);

export default async function Page() {
  const products = await getProducts();
  return <List products={products} />;
}
```

### 3. 应用启动时初始化

在 `middleware.ts` 或应用入口添加：

```typescript
import { initializeCacheSystem } from '@/lib/cache';

// 初始化缓存系统（只需调用一次）
initializeCacheSystem();
```

## 性能改进预期

### 1. 数据库查询减少
- **列表查询**：缓存 3-5 分钟，减少 80% 数据库查询
- **详情查询**：缓存 1 小时，减少 95% 数据库查询
- **统计查询**：缓存 10 分钟，减少 90% 聚合查询

### 2. API 响应时间
- **缓存命中**：< 10ms（Redis）
- **缓存未命中**：100-500ms（数据库查询）
- **平均响应时间减少**：60-80%

### 3. 并发处理能力
- **分布式锁**：防止热点数据击穿
- **Pub/Sub**：跨进程缓存同步，支持水平扩展
- **级联失效**：自动维护缓存一致性

## 监控和维护

### 1. 缓存命中率监控

```typescript
// 添加监控中间件
export async function cacheMetrics(key: string, hit: boolean) {
  // 记录到监控系统
  await metrics.record('cache.hit', hit ? 1 : 0, { key });
}
```

### 2. 缓存大小监控

```bash
# Redis CLI
redis-cli INFO memory
redis-cli DBSIZE
```

### 3. 缓存清理

```typescript
// app/api/admin/cache/route.ts
export async function DELETE(request: NextRequest) {
  const { pattern } = await request.json();

  // 清除匹配的缓存
  const deleted = await redis.scanDel(pattern);

  return Response.json({ success: true, deleted });
}
```

## 下一步优化建议

### 1. 缓存预热
在应用启动或低峰期预加载热点数据：

```typescript
async function warmupCache() {
  // 预加载产品列表
  await getProducts({ page: 1, limit: 20 });

  // 预加载仪表盘统计
  await getDashboardStats();
}
```

### 2. 缓存指标收集
集成 Prometheus/Grafana 监控缓存性能：

```typescript
import { Counter, Histogram } from 'prom-client';

const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_prefix'],
});

const cacheDuration = new Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Cache operation duration',
  labelNames: ['operation'],
});
```

### 3. 智能缓存 TTL
根据数据访问频率动态调整 TTL：

```typescript
async function getSmartTTL(key: string, baseT TL: number): Promise<number> {
  const hitCount = await redis.get(`metrics:${key}:hits`);
  const hits = Number(hitCount) || 0;

  // 访问频率高的数据，TTL 更长
  if (hits > 1000) return baseTTL * 3;
  if (hits > 100) return baseTTL * 2;
  return baseTTL;
}
```

## 总结

本次重构完成了：

✅ **统一的缓存管理系统**
  - 集中管理所有缓存标签
  - 统一的失效策略
  - 类型安全的 API

✅ **多层缓存架构**
  - React cache（请求级）
  - Next.js cache（应用级）
  - Redis（分布式）

✅ **跨进程缓存同步**
  - Redis Pub/Sub
  - 自动失效通知

✅ **完善的防护机制**
  - 防缓存穿透
  - 防缓存雪崩
  - 防缓存击穿

✅ **级联失效**
  - 自动维护缓存一致性
  - 减少手动管理成本

✅ **完整的文档**
  - 使用指南
  - 最佳实践
  - 迁移示例

现有代码可以逐步迁移到新系统，保持向后兼容的同时享受新特性带来的性能提升和开发体验改善。
