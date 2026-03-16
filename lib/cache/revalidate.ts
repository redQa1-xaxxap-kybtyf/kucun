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

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/redis-client';
import { publish, subscribe } from '@/lib/redis/redis-pubsub';
import { invalidateStatementsCache } from '@/lib/services/finance-statistics-cached';

import { invalidateNamespace } from './cache';
import { CacheTags, RedisCachePrefix } from './tags';

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
      // ✅ 修复：直接使用标签作为模式，不添加前缀
      // 因为缓存键已经是 'products:list:{hash}' 格式
      // scanDel 会自动添加命名空间前缀
      await redis.scanDel(`${tag}*`);
    }

    // 3. 通过 Pub/Sub 通知其他进程（使用新的 Pub/Sub 模块）
    if (opts.broadcast) {
      await publish(CACHE_INVALIDATION_CHANNEL, { tag, options: opts });
    }

    // 4. 级联失效相关缓存
    if (opts.cascade) {
      await cascadeInvalidate(tag);
    }
  } catch (error) {
    logger.error(
      'cache-revalidate',
      `Failed to revalidate cache for tag: ${tag}`,
      error,
      { tag }
    );
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
    logger.error(
      'cache-revalidate',
      `Failed to revalidate path: ${path}`,
      error,
      { path }
    );
  }
}

/**
 * 级联失效相关缓存 - 优化版
 *
 * 优化说明：
 * 1. 移除了过度级联：库存变更不再失效订单列表、产品列表
 * 2. 分级失效：立即失效关键缓存，延迟失效次要缓存
 * 3. 精准失效：只失效真正相关的缓存，不失效列表缓存
 * 4. 防止雪崩：使用延迟执行，避免同时失效大量缓存
 */
async function cascadeInvalidate(tag: string): Promise<void> {
  /**
   * 立即失效的级联规则（直接相关，必须同步失效）
   */
  const immediateCascadeMap: Record<string, string[]> = {
    // 产品变更 → 只失效库存汇总（产品详情已在调用方失效）
    [CacheTags.Products.all]: [
      CacheTags.Inventory.all, // 库存汇总需要立即失效
    ],

    // 库存变更 → 只失效仪表盘预警（不失效列表和订单）
    [CacheTags.Inventory.all]: [
      CacheTags.Dashboard.alerts, // 库存预警需要立即更新
    ],

    // 客户变更 → 失效订单、财务缓存
    [CacheTags.Customers.all]: [
      CacheTags.Finance.receivablesList,
      CacheTags.Finance.statementsList,
    ],

    // 供应商变更 → 失效财务缓存
    [CacheTags.Suppliers.all]: [
      CacheTags.Finance.payablesList,
      CacheTags.Finance.statementsList,
    ],

    // 销售订单变更 → 失效财务、库存汇总
    [CacheTags.SalesOrders.all]: [
      CacheTags.Finance.receivables, // ✅ 修复: 使用 receivables 而不是 receivablesList
      CacheTags.Finance.statementsList,
      CacheTags.Inventory.all, // 订单影响库存预留
    ],

    // 退货订单变更 → 失效财务、库存
    [CacheTags.ReturnOrders.all]: [
      CacheTags.Finance.refundsList,
      CacheTags.Inventory.all,
    ],

    // 财务数据变更 → 失效往来账单、统计
    [CacheTags.Finance.receivables]: [
      CacheTags.Finance.statementsList,
      CacheTags.Finance.receivablesStats,
    ],

    [CacheTags.Finance.payables]: [
      CacheTags.Finance.statementsList,
      CacheTags.Finance.payablesStats,
    ],

    [CacheTags.Finance.refunds]: [
      CacheTags.Finance.statementsList,
      CacheTags.Finance.refundsStats,
    ],

    // 支付记录变更 → 失效应收款、往来账单
    [CacheTags.Finance.payments]: [
      CacheTags.Finance.receivablesList,
      CacheTags.Finance.statementsList,
    ],

    // 付款记录变更 → 失效应付款、往来账单
    [CacheTags.Finance.paymentsOut]: [
      CacheTags.Finance.payablesList,
      CacheTags.Finance.statementsList,
    ],
  };

  /**
   * 延迟失效的级联规则（间接相关，异步失效）
   */
  const deferredCascadeMap: Record<string, string[]> = {
    // 产品变更 → 延迟失效仪表盘概览
    [CacheTags.Products.all]: [CacheTags.Dashboard.overview],

    // 库存变更 → 延迟失效仪表盘统计
    [CacheTags.Inventory.all]: [CacheTags.Dashboard.stats],

    // 销售订单变更 → 延迟失效仪表盘
    [CacheTags.SalesOrders.all]: [
      CacheTags.Dashboard.overview,
      CacheTags.Dashboard.stats,
    ],

    // 财务数据变更 → 延迟失效仪表盘
    [CacheTags.Finance.receivables]: [CacheTags.Dashboard.overview],
    [CacheTags.Finance.payables]: [CacheTags.Dashboard.overview],
    [CacheTags.Finance.refunds]: [CacheTags.Dashboard.overview],
    [CacheTags.Finance.payments]: [CacheTags.Dashboard.overview],
    [CacheTags.Finance.paymentsOut]: [CacheTags.Dashboard.overview],
  };

  // 1. 立即失效直接相关的缓存
  const immediateKeys = Object.keys(immediateCascadeMap);
  for (const key of immediateKeys) {
    if (tag === key || tag.startsWith(`${key}:`)) {
      const relatedTags = immediateCascadeMap[key];
      const hasStatementsList = relatedTags.includes(
        CacheTags.Finance.statementsList
      );

      if (hasStatementsList) {
        await Promise.all([
          invalidateStatementsCache(),
          revalidateCache(CacheTags.Finance.statementsList, {
            cascade: false,
          }),
        ]);
      }

      const tagsToRevalidate = relatedTags.filter(
        tagItem => tagItem !== CacheTags.Finance.statementsList
      );

      if (tagsToRevalidate.length > 0) {
        await Promise.all(
          tagsToRevalidate.map(relatedTag =>
            revalidateCache(relatedTag, { cascade: false })
          )
        );
      }
      break; // 只执行第一个匹配的规则
    }
  }

  // 2. 延迟失效间接相关的缓存（不阻塞主流程）
  const deferredKeys = Object.keys(deferredCascadeMap);
  for (const key of deferredKeys) {
    if (tag === key || tag.startsWith(`${key}:`)) {
      const relatedTags = deferredCascadeMap[key];

      // 异步执行（不阻塞主流程），且不再使用 setTimeout 延迟
      void (async () => {
        try {
          await Promise.all(
            relatedTags.map(relatedTag =>
              revalidateCache(relatedTag, { cascade: false, broadcast: false })
            )
          );
        } catch (error) {
          logger.error('cache-revalidate', '级联失效执行失败', error, {
            tag,
            relatedTags: relatedTags.join(','),
          });
        }
      })();

      break; // 只执行第一个匹配的规则
    }
  }
}

/**
 * 订阅 Redis Pub/Sub 缓存失效通知
 * 在应用启动时调用，用于跨进程缓存同步
 * 使用新的 Pub/Sub 模块，自动处理重连和错误
 */
export async function subscribeCacheInvalidation(): Promise<void> {
  try {
    await subscribe(CACHE_INVALIDATION_CHANNEL, (message: string) => {
      try {
        const { tag } = JSON.parse(message) as {
          tag: string;
          options: RevalidateOptions;
        };

        // 只失效本地 Next.js 缓存，不再广播（避免循环）
        revalidateTag(tag);

        logger.debug('cache-revalidate', '接收到缓存失效通知', { tag });
      } catch (error) {
        logger.error('cache-revalidate', '处理缓存失效消息失败', error, {
          message,
        });
      }
    });

    logger.info('cache-revalidate', '已订阅缓存失效频道');
  } catch (error) {
    logger.error('cache-revalidate', '订阅缓存失效频道失败', error);
  }
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

    // 产品级库存变更同样会影响全局库存统计卡片，否则仪表盘可能继续显示旧值
    await revalidateCache(CacheTags.Dashboard.stats, { cascade: false });
  } else {
    await revalidateCache(CacheTags.Inventory.all);
  }

  // 失效基于 hash 的可用性查询缓存
  await invalidateNamespace('inventory:availability:*');
  // 同步刷新库存预警数据，避免出现旧状态
  await revalidateCache(CacheTags.Inventory.alerts, { cascade: false });
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
