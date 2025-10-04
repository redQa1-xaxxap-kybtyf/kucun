/**
 * 统一的缓存失效管理
 * 集成 Next.js revalidateTag 和 Redis Pub/Sub
 *
 * 职责：
 * 1. 提供统一的缓存失效 API
 * 2. 同步失效 Next.js 缓存和 Redis 缓存
 * 3. 通过 Pub/Sub 跨进程通知缓存失效
 * 4. 集中管理失效策略和级联关系
 */

import { revalidatePath, revalidateTag } from 'next/cache';

import { redis } from '@/lib/redis/redis-client';

import { CacheTags, RedisCachePrefix, tagToRedisKey } from './tags';

/**
 * 缓存失效选项
 */
export interface RevalidateOptions {
  /** 是否同步失效 Redis 缓存 */
  redis?: boolean;
  /** 是否通过 Pub/Sub 通知其他进程 */
  broadcast?: boolean;
  /** 是否级联失效相关缓存 */
  cascade?: boolean;
}

const DEFAULT_OPTIONS: RevalidateOptions = {
  redis: true,
  broadcast: true,
  cascade: true,
};

/**
 * Redis Pub/Sub 频道
 */
const CACHE_INVALIDATION_CHANNEL = `${RedisCachePrefix.channel}cache:invalidate`;

/**
 * 失效单个缓存标签
 *
 * @param tag - 缓存标签
 * @param options - 失效选项
 *
 * @example
 * ```typescript
 * // 失效产品详情缓存
 * await revalidateCache(CacheTags.Products.detail('product-id'));
 *
 * // 只失效 Next.js 缓存，不失效 Redis
 * await revalidateCache(CacheTags.Products.list, { redis: false });
 * ```
 */
export async function revalidateCache(
  tag: string,
  options: RevalidateOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // 1. 失效 Next.js 缓存
    revalidateTag(tag);

    // 2. 失效 Redis 缓存
    if (opts.redis) {
      const redisKey = tagToRedisKey(tag);
      // 使用 scan 删除匹配的键
      await redis.scanDel(`${redisKey}*`);
    }

    // 3. 通过 Pub/Sub 通知其他进程
    if (opts.broadcast) {
      await redis
        .getClient()
        .publish(
          CACHE_INVALIDATION_CHANNEL,
          JSON.stringify({ tag, options: opts })
        );
    }

    // 4. 级联失效相关缓存
    if (opts.cascade) {
      await cascadeInvalidate(tag);
    }
  } catch (error) {
    console.error(`[Cache] Failed to revalidate cache for tag: ${tag}`, error);
    // 不抛出错误，避免阻塞业务逻辑
  }
}

/**
 * 失效多个缓存标签
 *
 * @param tags - 缓存标签数组
 * @param options - 失效选项
 */
export async function revalidateCaches(
  tags: string[],
  options: RevalidateOptions = {}
): Promise<void> {
  await Promise.all(tags.map(tag => revalidateCache(tag, options)));
}

/**
 * 失效路径缓存
 *
 * @param path - 路径
 * @param type - 失效类型：'page' 只失效该页面，'layout' 失效该布局及子页面
 *
 * @example
 * ```typescript
 * // 失效产品列表页面
 * await revalidateCachePath('/products', 'page');
 *
 * // 失效整个仪表盘布局
 * await revalidateCachePath('/dashboard', 'layout');
 * ```
 */
export async function revalidateCachePath(
  path: string,
  type: 'page' | 'layout' = 'page'
): Promise<void> {
  try {
    revalidatePath(path, type);
  } catch (error) {
    console.error(`[Cache] Failed to revalidate path: ${path}`, error);
  }
}

/**
 * 级联失效相关缓存
 * 根据业务逻辑自动失效相关的缓存标签
 */
async function cascadeInvalidate(tag: string): Promise<void> {
  const cascadeMap: Record<string, string[]> = {
    // 产品变更 → 失效库存、订单相关缓存
    [CacheTags.Products.all]: [
      CacheTags.Inventory.all,
      CacheTags.SalesOrders.list,
      CacheTags.Dashboard.overview,
    ],

    // 库存变更 → 失效产品、仪表盘缓存
    [CacheTags.Inventory.all]: [
      CacheTags.Products.list,
      CacheTags.Dashboard.overview,
      CacheTags.Dashboard.alerts,
      CacheTags.SalesOrders.list,
    ],

    // 客户变更 → 失效订单、财务缓存
    [CacheTags.Customers.all]: [
      CacheTags.SalesOrders.list,
      CacheTags.Finance.receivablesList,
      CacheTags.Finance.statementsList,
    ],

    // 供应商变更 → 失效采购、财务缓存
    [CacheTags.Suppliers.all]: [
      CacheTags.Finance.payablesList,
      CacheTags.Finance.statementsList,
    ],

    // 销售订单变更 → 失效财务、库存、仪表盘缓存
    [CacheTags.SalesOrders.all]: [
      CacheTags.Finance.receivablesList,
      CacheTags.Finance.statementsList,
      CacheTags.Inventory.all,
      CacheTags.Dashboard.overview,
      CacheTags.Dashboard.stats,
    ],

    // 退货订单变更 → 失效财务、库存缓存
    [CacheTags.ReturnOrders.all]: [
      CacheTags.Finance.refundsList,
      CacheTags.Inventory.all,
      CacheTags.SalesOrders.list,
    ],

    // 财务数据变更 → 失效仪表盘、往来账单缓存
    [CacheTags.Finance.receivables]: [
      CacheTags.Dashboard.overview,
      CacheTags.Finance.statementsList,
      CacheTags.Finance.receivablesStats,
    ],

    [CacheTags.Finance.payables]: [
      CacheTags.Dashboard.overview,
      CacheTags.Finance.statementsList,
      CacheTags.Finance.payablesStats,
    ],

    [CacheTags.Finance.refunds]: [
      CacheTags.Dashboard.overview,
      CacheTags.Finance.statementsList,
      CacheTags.Finance.refundsStats,
    ],

    // 支付记录变更 → 失效应收款、往来账单、仪表盘
    [CacheTags.Finance.payments]: [
      CacheTags.Finance.receivablesList,
      CacheTags.Finance.statementsList,
      CacheTags.Dashboard.overview,
    ],

    // 付款记录变更 → 失效应付款、往来账单、仪表盘
    [CacheTags.Finance.paymentsOut]: [
      CacheTags.Finance.payablesList,
      CacheTags.Finance.statementsList,
      CacheTags.Dashboard.overview,
    ],
  };

  // 查找级联规则（支持前缀匹配）
  const cascadeKeys = Object.keys(cascadeMap);
  for (const key of cascadeKeys) {
    if (tag === key || tag.startsWith(`${key}:`)) {
      const relatedTags = cascadeMap[key];
      // 递归失效相关标签（但禁用级联，避免循环）
      await Promise.all(
        relatedTags.map(relatedTag =>
          revalidateCache(relatedTag, { cascade: false })
        )
      );
      break;
    }
  }
}

/**
 * 订阅 Redis Pub/Sub 缓存失效通知
 * 在应用启动时调用，用于跨进程缓存同步
 */
export function subscribeCacheInvalidation(): void {
  const subscriber = redis.getClient().duplicate();

  subscriber.subscribe(CACHE_INVALIDATION_CHANNEL, err => {
    if (err) {
      console.error(
        '[Cache] Failed to subscribe to cache invalidation channel:',
        err
      );
      return;
    }
    console.log('[Cache] Subscribed to cache invalidation channel');
  });

  subscriber.on('message', async (channel, message) => {
    if (channel !== CACHE_INVALIDATION_CHANNEL) {
      return;
    }

    try {
      const { tag } = JSON.parse(message) as {
        tag: string;
        options: RevalidateOptions;
      };

      // 只失效本地 Next.js 缓存，不再广播（避免循环）
      revalidateTag(tag);
    } catch (error) {
      console.error(
        '[Cache] Failed to process cache invalidation message:',
        error
      );
    }
  });
}

// ==================== 便捷失效函数 ====================

/**
 * 失效产品相关缓存
 */
export async function revalidateProducts(productId?: string): Promise<void> {
  if (productId) {
    await revalidateCaches([
      CacheTags.Products.detail(productId),
      CacheTags.Products.variants(productId),
      CacheTags.Products.list,
    ]);
  } else {
    await revalidateCache(CacheTags.Products.all);
  }
}

/**
 * 失效库存相关缓存
 */
export async function revalidateInventory(productId?: string): Promise<void> {
  if (productId) {
    await revalidateCaches([
      CacheTags.Inventory.summary(productId),
      CacheTags.Inventory.list,
    ]);
  } else {
    await revalidateCache(CacheTags.Inventory.all);
  }
}

/**
 * 失效客户相关缓存
 */
export async function revalidateCustomers(customerId?: string): Promise<void> {
  if (customerId) {
    await revalidateCaches([
      CacheTags.Customers.detail(customerId),
      CacheTags.Customers.hierarchy(customerId),
      CacheTags.Customers.list,
    ]);
  } else {
    await revalidateCache(CacheTags.Customers.all);
  }
}

/**
 * 失效供应商相关缓存
 */
export async function revalidateSuppliers(supplierId?: string): Promise<void> {
  if (supplierId) {
    await revalidateCaches([
      CacheTags.Suppliers.detail(supplierId),
      CacheTags.Suppliers.list,
    ]);
  } else {
    await revalidateCache(CacheTags.Suppliers.all);
  }
}

/**
 * 失效销售订单相关缓存
 */
export async function revalidateSalesOrders(orderId?: string): Promise<void> {
  if (orderId) {
    await revalidateCaches([
      CacheTags.SalesOrders.detail(orderId),
      CacheTags.SalesOrders.items(orderId),
      CacheTags.SalesOrders.list,
      CacheTags.SalesOrders.stats,
    ]);
  } else {
    await revalidateCache(CacheTags.SalesOrders.all);
  }
}

/**
 * 失效退货订单相关缓存
 */
export async function revalidateReturnOrders(orderId?: string): Promise<void> {
  if (orderId) {
    await revalidateCaches([
      CacheTags.ReturnOrders.detail(orderId),
      CacheTags.ReturnOrders.list,
      CacheTags.ReturnOrders.stats,
    ]);
  } else {
    await revalidateCache(CacheTags.ReturnOrders.all);
  }
}

/**
 * 失效财务相关缓存
 */
export async function revalidateFinance(
  type?: 'receivables' | 'payables' | 'refunds' | 'payments'
): Promise<void> {
  if (type) {
    switch (type) {
      case 'receivables':
        await revalidateCache(CacheTags.Finance.receivables);
        break;
      case 'payables':
        await revalidateCache(CacheTags.Finance.payables);
        break;
      case 'refunds':
        await revalidateCache(CacheTags.Finance.refunds);
        break;
      case 'payments':
        await revalidateCaches([
          CacheTags.Finance.payments,
          CacheTags.Finance.paymentsOut,
        ]);
        break;
    }
  } else {
    await revalidateCache(CacheTags.Finance.all);
  }
}

/**
 * 失效仪表盘缓存
 */
export async function revalidateDashboard(): Promise<void> {
  await revalidateCache(CacheTags.Dashboard.all);
}

/**
 * 失效分类缓存
 */
export async function revalidateCategories(categoryId?: string): Promise<void> {
  if (categoryId) {
    await revalidateCaches([
      CacheTags.Categories.detail(categoryId),
      CacheTags.Categories.list,
      CacheTags.Categories.tree,
    ]);
  } else {
    await revalidateCache(CacheTags.Categories.all);
  }
}
