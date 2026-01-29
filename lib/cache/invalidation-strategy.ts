/**
 * 分级缓存失效策略
 *
 * 目标：
 * 1. 避免缓存雪崩：不一次性清除所有缓存
 * 2. 精准失效：只清除真正需要失效的缓存
 * 3. 分级失效：立即失效关键缓存，延迟失效次要缓存
 * 4. 异步预热：失效后异步重建常用缓存
 *
 * 使用示例：
 * ```typescript
 * import { executeInvalidation, INVENTORY_CHANGE_INVALIDATION } from '@/lib/cache/invalidation-strategy';
 *
 * // 库存变更时
 * await executeInvalidation(INVENTORY_CHANGE_INVALIDATION, {
 *   productId: 'product-123',
 * });
 * ```
 */

import { logger } from '@/lib/logger';

import { invalidateNamespace } from './cache';

/**
 * 缓存失效级别定义
 */
export interface InvalidationLevel {
  /** 立即失效的缓存（阻塞主流程） */
  immediate: string[];

  /** 延迟失效的缓存（后台异步执行，不阻塞） */
  deferred: string[];

  /** 可选失效的缓存（仅在明确需要时执行） */
  optional: string[];
}

/**
 * 失效执行选项
 */
export interface InvalidationOptions {
  /** 是否执行可选失效，默认 false */
  includeOptional?: boolean;

  /** 延迟失效的延迟时间（毫秒），默认 1000ms */
  deferredDelay?: number;

  /** 失效后是否预热缓存，默认 false */
  warmup?: boolean;

  /** 产品ID（用于精准失效） */
  productId?: string;

  /** 客户ID（用于精准失效） */
  customerId?: string;

  /** 订单ID（用于精准失效） */
  orderId?: string;
}

/**
 * 库存变更的失效策略
 *
 * 场景：产品入库、出库、调整库存
 * 影响范围：库存汇总、库存统计
 * 不影响：财务数据、订单列表（由订单变更触发）
 */
export const INVENTORY_CHANGE_INVALIDATION: InvalidationLevel = {
  immediate: [
    'inventory:summary:*', // 库存汇总必须立即失效
  ],
  deferred: [
    'dashboard:stats:*', // 仪表盘统计可以延迟失效
    'dashboard:alerts:*', // 库存预警可以延迟失效
  ],
  optional: [
    'dashboard:overview:*', // 仪表盘概览可选失效
  ],
};

/**
 * 产品变更的失效策略
 *
 * 场景：创建、更新、删除产品
 * 影响范围：产品详情、产品列表、库存汇总
 */
export const PRODUCT_CHANGE_INVALIDATION: InvalidationLevel = {
  immediate: [
    'products:detail:*', // 产品详情必须立即失效
    'inventory:summary:*', // 库存汇总必须立即失效
  ],
  deferred: [
    'dashboard:stats:*', // 仪表盘统计延迟失效
  ],
  optional: [],
};

/**
 * 订单状态变更的失效策略
 *
 * 场景：订单创建、确认、取消、完成
 * 影响范围：库存、财务、仪表盘
 */
export const ORDER_STATUS_CHANGE_INVALIDATION: InvalidationLevel = {
  immediate: [
    'sales-orders:detail:*', // 订单详情必须立即失效
    'inventory:summary:*', // 库存汇总必须立即失效（预留、实际库存变化）
  ],
  deferred: [
    'finance:receivables:*', // 财务数据延迟失效
    'dashboard:stats:*', // 仪表盘统计延迟失效
  ],
  optional: [
    'dashboard:overview:*', // 仪表盘概览可选失效
  ],
};

/**
 * 财务数据变更的失效策略
 *
 * 场景：收款、付款、退款
 * 影响范围：财务统计、往来账单、仪表盘
 */
export const FINANCE_CHANGE_INVALIDATION: InvalidationLevel = {
  immediate: [
    'finance:receivables:*', // 应收账款必须立即失效
    'finance:statements:list*', // 往来账单列表必须立即失效
  ],
  deferred: [
    'dashboard:overview:*', // 仪表盘概览延迟失效
    'finance:receivables:stats:*', // 统计数据延迟失效
  ],
  optional: [],
};

/**
 * 执行分级缓存失效
 *
 * @param strategy 失效策略
 * @param options 失效选项
 */
export async function executeInvalidation(
  strategy: InvalidationLevel,
  options: InvalidationOptions = {}
): Promise<void> {
  const {
    includeOptional = false,
    deferredDelay = 1000,
    productId,
    customerId,
    orderId,
  } = options;

  // 1. 替换通配符为具体ID（精准失效）
  const replaceWildcard = (pattern: string): string => {
    if (productId && pattern.includes('inventory:summary:')) {
      return `inventory:summary:${productId}`;
    }
    if (productId && pattern.includes('products:detail:')) {
      return `products:detail:${productId}`;
    }
    if (orderId && pattern.includes('sales-orders:detail:')) {
      return `sales-orders:detail:${orderId}`;
    }
    if (customerId && pattern.includes('customers:detail:')) {
      return `customers:detail:${customerId}`;
    }
    return pattern;
  };

  // 2. 立即失效关键缓存（同步执行，阻塞主流程）
  const immediatePatterns = strategy.immediate.map(replaceWildcard);
  await Promise.all(
    immediatePatterns.map(pattern => invalidateNamespace(pattern))
  );

  // 3. 延迟失效次要缓存（异步执行，不阻塞主流程）
  if (strategy.deferred.length > 0) {
    // 使用 setTimeout 确保不阻塞主流程
    setTimeout(async () => {
      try {
        const deferredPatterns = strategy.deferred.map(replaceWildcard);
        await Promise.all(
          deferredPatterns.map(pattern => invalidateNamespace(pattern))
        );
      } catch (error) {
        logger.error('cache:invalidation', '缓存延迟失效执行失败', error, {
          deferredPatternCount: strategy.deferred.length,
        });
        // 不抛出错误，避免影响后台任务
      }
    }, deferredDelay);
  }

  // 4. 可选失效（仅在明确需要时执行）
  if (includeOptional && strategy.optional.length > 0) {
    const optionalPatterns = strategy.optional.map(replaceWildcard);
    await Promise.all(
      optionalPatterns.map(pattern => invalidateNamespace(pattern))
    );
  }
}

/**
 * 缓存预热：异步重建常用缓存
 *
 * 目标：失效缓存后，异步预热常用数据，避免缓存击穿
 *
 * @param cacheKey 缓存键
 * @param fetchFn 数据获取函数
 * @param ttl 缓存TTL（秒）
 */
export async function warmupCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<void> {
  try {
    const { getOrSetJSON } = await import('./cache');
    const data = await fetchFn();

    if (data !== null) {
      await getOrSetJSON(cacheKey, () => Promise.resolve(data), ttl);
    }
  } catch (error) {
    logger.error('cache:invalidation', '缓存预热失败', error, {
      cacheKey,
    });
    // 不抛出错误，预热失败不影响业务
  }
}

/**
 * 批量预热缓存
 *
 * @param items 预热项数组
 */
export async function warmupCacheBatch<T>(
  items: Array<{
    cacheKey: string;
    fetchFn: () => Promise<T>;
    ttl: number;
  }>
): Promise<void> {
  // 并行预热，但限制并发数避免数据库压力
  const CONCURRENCY = 5;

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(item => warmupCache(item.cacheKey, item.fetchFn, item.ttl))
    );
  }
}

/**
 * 创建带预热的失效函数
 *
 * @param invalidationStrategy 失效策略
 * @param warmupFn 预热函数
 */
export function createInvalidationWithWarmup<_T>(
  invalidationStrategy: InvalidationLevel,
  warmupFn?: (options: InvalidationOptions) => Promise<void>
) {
  return async (options: InvalidationOptions = {}): Promise<void> => {
    // 1. 执行失效
    await executeInvalidation(invalidationStrategy, options);

    // 2. 异步预热（如果提供了预热函数）
    if (warmupFn) {
      setTimeout(async () => {
        try {
          await warmupFn(options);
        } catch (error) {
          logger.error('cache:invalidation', '缓存预热执行失败', error, {
            // 记录当前失效策略的模式集合，便于排查问题
            immediatePatternCount: invalidationStrategy.immediate.length,
            deferredPatternCount: invalidationStrategy.deferred.length,
            optionalPatternCount: invalidationStrategy.optional.length,
          });
        }
      }, 100); // 延迟100ms执行预热
    }
  };
}

/**
 * 监控缓存失效效果
 *
 * 记录失效次数，用于分析缓存失效频率和效果
 */
export const invalidationMetrics = {
  immediate: 0,
  deferred: 0,
  optional: 0,
  total: 0,
};

/**
 * 记录失效指标
 */
export function recordInvalidation(
  type: 'immediate' | 'deferred' | 'optional'
): void {
  invalidationMetrics[type]++;
  invalidationMetrics.total++;
}

/**
 * 获取失效统计
 */
export function getInvalidationMetrics() {
  return { ...invalidationMetrics };
}

/**
 * 重置失效统计
 */
export function resetInvalidationMetrics(): void {
  invalidationMetrics.immediate = 0;
  invalidationMetrics.deferred = 0;
  invalidationMetrics.optional = 0;
  invalidationMetrics.total = 0;
}
