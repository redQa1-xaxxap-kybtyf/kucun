/**
 * React Server Components 缓存包装器
 * 为服务器组件提供 React cache() + Next.js 缓存标签的统一封装
 *
 * 使用说明：
 * - 用于 React Server Components 的数据获取函数
 * - 自动应用 React cache() 进行请求记忆化
 * - 支持 Next.js 缓存标签，便于精确失效
 * - 集成 Redis 缓存作为二级缓存
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { getOrSetJSON } from './cache';
import type { CacheTag } from './tags';

/**
 * 服务器组件缓存选项
 */
export interface ServerCacheOptions {
  /** 缓存标签，用于精确失效 */
  tags?: string[];
  /** 缓存时间（秒），默认使用 Next.js 默认值 */
  revalidate?: number | false;
  /** 是否启用 Redis 二级缓存 */
  redis?: boolean;
  /** Redis 缓存 TTL（秒） */
  redisTTL?: number;
}

/**
 * 为服务器组件数据获取函数添加缓存
 *
 * 缓存层级：
 * 1. React cache() - 请求级缓存（同一请求内复用）
 * 2. Next.js unstable_cache - 构建时和运行时缓存
 * 3. Redis - 跨进程缓存
 *
 * @param fn - 数据获取函数
 * @param options - 缓存选项
 * @returns 缓存包装后的函数
 *
 * @example
 * ```typescript
 * // 基础用法
 * const getProduct = cachedServerFn(
 *   async (id: string) => {
 *     return await prisma.product.findUnique({ where: { id } });
 *   },
 *   {
 *     tags: [CacheTags.Products.detail('product-id')],
 *     revalidate: 60,
 *   }
 * );
 *
 * // 在服务器组件中使用
 * export default async function ProductPage({ params }: { params: { id: string } }) {
 *   const product = await getProduct(params.id);
 *   return <div>{product.name}</div>;
 * }
 * ```
 */
export function cachedServerFn<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: ServerCacheOptions = {}
): (...args: Args) => Promise<Result> {
  const { tags = [], revalidate, redis: useRedis = false, redisTTL = 300 } = options;

  // 1. 应用 React cache() - 请求级缓存
  const reactCached = cache(fn);

  // 2. 如果不需要 Next.js 或 Redis 缓存，直接返回
  if (!tags.length && revalidate === undefined && !useRedis) {
    return reactCached;
  }

  // 3. 生成缓存键（用于 Next.js 和 Redis）
  const generateCacheKey = (...args: Args): string => {
    return `${fn.name}:${JSON.stringify(args)}`;
  };

  // 4. 应用 Next.js unstable_cache
  if (tags.length > 0 || revalidate !== undefined) {
    const nextCached = unstable_cache(
      reactCached,
      [fn.name],
      {
        tags,
        revalidate,
      }
    );

    // 5. 如果需要 Redis 缓存
    if (useRedis) {
      return async (...args: Args): Promise<Result> => {
        const cacheKey = generateCacheKey(...args);

        // 尝试从 Redis 获取
        const result = await getOrSetJSON<Result>(
          cacheKey,
          async () => {
            // Redis 未命中，调用 Next.js 缓存
            return await nextCached(...args);
          },
          redisTTL
        );

        return result!;
      };
    }

    return nextCached;
  }

  // 6. 只使用 Redis 缓存（不使用 Next.js 缓存）
  if (useRedis) {
    return async (...args: Args): Promise<Result> => {
      const cacheKey = generateCacheKey(...args);

      const result = await getOrSetJSON<Result>(
        cacheKey,
        async () => await reactCached(...args),
        redisTTL
      );

      return result!;
    };
  }

  return reactCached;
}

/**
 * 为查询函数添加缓存（简化版）
 * 自动使用函数名作为缓存键前缀
 *
 * @example
 * ```typescript
 * const getProducts = cachedQuery(
 *   async (params: ProductQueryParams) => {
 *     return await prisma.product.findMany({ ...params });
 *   },
 *   { tags: [CacheTags.Products.list], revalidate: 60 }
 * );
 * ```
 */
export function cachedQuery<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: ServerCacheOptions = {}
): (...args: Args) => Promise<Result> {
  return cachedServerFn(fn, {
    ...options,
    redis: options.redis ?? true, // 默认启用 Redis 缓存
    redisTTL: options.redisTTL ?? 300, // 默认 5 分钟
  });
}

/**
 * 为聚合统计函数添加缓存
 * 通常统计数据计算开销大，适合较长的缓存时间
 *
 * @example
 * ```typescript
 * const getDashboardStats = cachedStats(
 *   async () => {
 *     const [orders, revenue, inventory] = await Promise.all([
 *       prisma.salesOrder.count(),
 *       prisma.salesOrder.aggregate({ _sum: { totalAmount: true } }),
 *       prisma.inventory.aggregate({ _sum: { quantity: true } }),
 *     ]);
 *     return { orders, revenue, inventory };
 *   },
 *   { tags: [CacheTags.Dashboard.stats], revalidate: 300 }
 * );
 * ```
 */
export function cachedStats<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: Omit<ServerCacheOptions, 'redis' | 'redisTTL'> & {
    redisTTL?: number;
  } = {}
): (...args: Args) => Promise<Result> {
  return cachedServerFn(fn, {
    ...options,
    redis: true,
    redisTTL: options.redisTTL ?? 600, // 统计数据默认缓存 10 分钟
    revalidate: options.revalidate ?? 300, // Next.js 缓存 5 分钟
  });
}

/**
 * 为详情页数据获取添加缓存
 * 详情页数据变更频率低，可以缓存较长时间
 *
 * @example
 * ```typescript
 * const getProductDetail = cachedDetail(
 *   async (id: string) => {
 *     return await prisma.product.findUnique({
 *       where: { id },
 *       include: { category: true, variants: true },
 *     });
 *   },
 *   (id: string) => [CacheTags.Products.detail(id)]
 * );
 * ```
 */
export function cachedDetail<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  tagsBuilder: (...args: Args) => string[]
): (...args: Args) => Promise<Result> {
  // 创建包装函数，动态生成 tags
  const wrapped = cache(fn);

  return async (...args: Args): Promise<Result> => {
    const tags = tagsBuilder(...args);
    const cacheKey = `detail:${fn.name}:${JSON.stringify(args)}`;

    // 先检查 Redis
    const cached = await getOrSetJSON<Result>(
      cacheKey,
      async () => {
        // Redis 未命中，查询数据库
        return await wrapped(...args);
      },
      3600 // 详情数据缓存 1 小时
    );

    return cached!;
  };
}

/**
 * 为列表数据添加缓存
 * 列表数据变更频率较高，使用较短的缓存时间
 *
 * @example
 * ```typescript
 * const getProductList = cachedList(
 *   async (params: ProductQueryParams) => {
 *     return await prisma.product.findMany({ ...params });
 *   },
 *   { tags: [CacheTags.Products.list], revalidate: 30 }
 * );
 * ```
 */
export function cachedList<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: ServerCacheOptions = {}
): (...args: Args) => Promise<Result> {
  return cachedServerFn(fn, {
    ...options,
    redis: options.redis ?? true,
    redisTTL: options.redisTTL ?? 180, // 列表数据默认缓存 3 分钟
    revalidate: options.revalidate ?? 60, // Next.js 缓存 1 分钟
  });
}
