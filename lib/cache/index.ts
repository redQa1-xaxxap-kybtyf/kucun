/**
 * 统一缓存管理系统
 * 集成 Next.js、React 和 Redis 的缓存策略
 *
 * 架构说明：
 * ┌─────────────────────────────────────────────────────────┐
 * │                   Client Components                      │
 * │              (TanStack Query + API)                      │
 * └──────────────────────┬──────────────────────────────────┘
 *                        │
 *                        ↓
 * ┌─────────────────────────────────────────────────────────┐
 * │                    API Routes                            │
 * │              (Redis 缓存 + Pub/Sub)                      │
 * └──────────────────────┬──────────────────────────────────┘
 *                        │
 *                        ↓
 * ┌─────────────────────────────────────────────────────────┐
 * │               Server Components                          │
 * │    React cache() + Next.js cache + Redis                 │
 * └──────────────────────┬──────────────────────────────────┘
 *                        │
 *                        ↓
 * ┌─────────────────────────────────────────────────────────┐
 * │                   Database                               │
 * └─────────────────────────────────────────────────────────┘
 *
 * 使用指南：
 *
 * 1. 客户端组件：
 *    ```typescript
 *    import { useQuery } from '@tanstack/react-query';
 *    import { CacheTags } from '@/lib/cache';
 *
 *    const { data } = useQuery({
 *      queryKey: [CacheTags.Products.list, params],
 *      queryFn: () => fetchProducts(params),
 *    });
 *    ```
 *
 * 2. 服务器组件：
 *    ```typescript
 *    import { cachedQuery, CacheTags } from '@/lib/cache';
 *
 *    const getProducts = cachedQuery(
 *      async (params) => prisma.product.findMany(params),
 *      { tags: [CacheTags.Products.list], revalidate: 60 }
 *    );
 *
 *    export default async function Page() {
 *      const products = await getProducts({ page: 1 });
 *      return <ProductList products={products} />;
 *    }
 *    ```
 *
 * 3. API 路由：
 *    ```typescript
 *    import { getOrSetJSON, buildCacheKey, revalidateProducts } from '@/lib/cache';
 *
 *    export async function GET(request: NextRequest) {
 *      const params = getSearchParams(request);
 *      const cacheKey = buildCacheKey('products:list', params);
 *
 *      const data = await getOrSetJSON(
 *        cacheKey,
 *        async () => {
 *          return await prisma.product.findMany(params);
 *        },
 *        300 // 5分钟 TTL
 *      );
 *
 *      return Response.json(data);
 *    }
 *
 *    export async function POST(request: NextRequest) {
 *      const body = await request.json();
 *      const product = await prisma.product.create({ data: body });
 *
 *      // 失效相关缓存
 *      await revalidateProducts();
 *
 *      return Response.json(product);
 *    }
 *    ```
 *
 * 4. 缓存失效：
 *    ```typescript
 *    import { revalidateProducts, revalidateInventory } from '@/lib/cache';
 *
 *    // 创建产品后
 *    await revalidateProducts();
 *
 *    // 更新库存后
 *    await revalidateInventory(productId);
 *
 *    // 级联失效会自动处理相关缓存
 *    ```
 */

// ==================== 核心缓存工具 ====================
export {
  buildCacheKey,
  getOrSetJSON,
  getOrSetWithLock,
  invalidateNamespace,
  getRandomTTL,
  NULL_CACHE_VALUE,
  NULL_CACHE_TTL,
} from './cache';

export type { CacheOptions } from './cache';

// ==================== 缓存标签 ====================
export { CacheTags, RedisCachePrefix, tagToRedisKey, redisKeyToTag } from './tags';
export type { CacheTag } from './tags';

// ==================== 缓存失效 ====================
export {
  revalidateCache,
  revalidateCaches,
  revalidateCachePath,
  subscribeCacheInvalidation,
  // 便捷失效函数
  revalidateProducts,
  revalidateInventory,
  revalidateCustomers,
  revalidateSuppliers,
  revalidateSalesOrders,
  revalidateReturnOrders,
  revalidateFinance,
  revalidateDashboard,
  revalidateCategories,
} from './revalidate';

export type { RevalidateOptions } from './revalidate';

// ==================== 服务器组件缓存 ====================
export {
  cachedServerFn,
  cachedQuery,
  cachedStats,
  cachedDetail,
  cachedList,
} from './server';

export type { ServerCacheOptions } from './server';

// ==================== 业务缓存模块 ====================
export * from './product-cache';
export * from './inventory-cache';
export * from './finance-cache';

// ==================== Pub/Sub 系统 ====================
export {
  PubSubChannels,
  publishEvent,
  subscribeChannel,
  subscribeChannels,
  publishCacheInvalidation,
  publishDataUpdate,
  publishInventoryChange,
  publishOrderStatusChange,
  publishFinanceChange,
} from './pubsub';

export type {
  PubSubEvent,
  CacheInvalidationEvent,
  DataUpdateEvent,
  InventoryChangeEvent,
  OrderStatusChangeEvent,
  FinanceChangeEvent,
} from './pubsub';

// ==================== 缓存初始化 ====================
export { initializeCacheSystem, setWsEventEmitter } from './init';

// ==================== Redis 客户端 ====================
export { redis } from '@/lib/redis/redis-client';
export type { RedisClientWrapper } from '@/lib/redis/redis-client';

// ==================== 缓存配置 ====================
import { cacheConfig } from '@/lib/env';

export { cacheConfig };

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG = {
  /** 产品缓存 TTL（秒） */
  product: cacheConfig.productTtl,

  /** 库存缓存 TTL（秒） */
  inventory: cacheConfig.inventoryTtl,

  /** 统计数据缓存 TTL（秒） */
  stats: 600,

  /** 列表数据缓存 TTL（秒） */
  list: 180,

  /** 详情数据缓存 TTL（秒） */
  detail: 3600,

  /** 搜索结果缓存 TTL（秒） */
  search: 300,
} as const;

/**
 * 缓存策略建议
 */
export const CACHE_STRATEGY = {
  /** 高频查询，低频变更（如产品详情） */
  staticData: {
    redis: true,
    redisTTL: 3600,
    revalidate: 1800,
  },

  /** 中频查询，中频变更（如产品列表） */
  dynamicData: {
    redis: true,
    redisTTL: 300,
    revalidate: 60,
  },

  /** 高频查询，高频变更（如库存） */
  volatileData: {
    redis: true,
    redisTTL: 60,
    revalidate: 30,
  },

  /** 统计数据，计算开销大 */
  aggregateData: {
    redis: true,
    redisTTL: 600,
    revalidate: 300,
  },

  /** 实时数据，不缓存 */
  realtimeData: {
    redis: false,
    revalidate: 0,
  },
} as const;
