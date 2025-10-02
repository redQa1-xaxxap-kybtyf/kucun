/**
 * 财务数据缓存工具
 * 使用Redis缓存财务统计数据,提升查询性能
 * 严格遵循全局约定规范
 *
 * 优化说明:
 * - 集成统一缓存工具，使用随机TTL防止缓存雪崩
 * - 支持空值缓存，防止缓存穿透
 * - 所有缓存操作遵循唯一真理原则
 */

import { getOrSetJSON } from '@/lib/cache/cache';
import { redis } from '@/lib/redis/redis-client';

// 缓存键前缀
const CACHE_PREFIX = 'finance:';

// 缓存基础TTL(秒) - 实际TTL会添加±20%随机抖动
const CACHE_TTL = {
  statistics: 300, // 5分钟 → 实际 240-360秒
  receivables: 180, // 3分钟 → 实际 144-216秒
  payables: 180, // 3分钟 → 实际 144-216秒
  statements: 300, // 5分钟 → 实际 240-360秒
};

/**
 * 生成缓存键
 */
function getCacheKey(type: string, id?: string): string {
  return id ? `${CACHE_PREFIX}${type}:${id}` : `${CACHE_PREFIX}${type}`;
}

/**
 * 获取财务统计缓存
 */
export async function getFinanceStatisticsCache(): Promise<unknown | null> {
  try {
    const key = getCacheKey('statistics');
    return await redis.getJson(key);
  } catch (error) {
    console.error('获取财务统计缓存失败:', error);
    return null;
  }
}

/**
 * 设置财务统计缓存
 * 使用随机TTL防止缓存雪崩
 */
export async function setFinanceStatisticsCache(data: unknown): Promise<void> {
  try {
    const key = getCacheKey('statistics');
    // 使用统一缓存工具，自动添加随机TTL
    await getOrSetJSON(key, async () => data, CACHE_TTL.statistics, {
      enableRandomTTL: true, // 启用随机TTL，防止缓存雪崩
      jitterPercent: 20, // 20%抖动
      enableNullCache: true, // 启用空值缓存，防止缓存穿透
    });
  } catch (error) {
    console.error('设置财务统计缓存失败:', error);
  }
}

/**
 * 获取应收款列表缓存
 */
export async function getReceivablesCache(
  queryKey: string
): Promise<unknown | null> {
  try {
    const key = getCacheKey('receivables', queryKey);
    return await redis.getJson(key);
  } catch (error) {
    console.error('获取应收款缓存失败:', error);
    return null;
  }
}

/**
 * 设置应收款列表缓存
 * 使用随机TTL防止缓存雪崩
 */
export async function setReceivablesCache(
  queryKey: string,
  data: unknown
): Promise<void> {
  try {
    const key = getCacheKey('receivables', queryKey);
    // 使用统一缓存工具，自动添加随机TTL
    await getOrSetJSON(key, async () => data, CACHE_TTL.receivables, {
      enableRandomTTL: true,
      jitterPercent: 20,
      enableNullCache: true,
    });
  } catch (error) {
    console.error('设置应收款缓存失败:', error);
  }
}

/**
 * 获取应付款列表缓存
 */
export async function getPayablesCache(
  queryKey: string
): Promise<unknown | null> {
  try {
    const key = getCacheKey('payables', queryKey);
    return await redis.getJson(key);
  } catch (error) {
    console.error('获取应付款缓存失败:', error);
    return null;
  }
}

/**
 * 设置应付款列表缓存
 * 使用随机TTL防止缓存雪崩
 */
export async function setPayablesCache(
  queryKey: string,
  data: unknown
): Promise<void> {
  try {
    const key = getCacheKey('payables', queryKey);
    // 使用统一缓存工具，自动添加随机TTL
    await getOrSetJSON(key, async () => data, CACHE_TTL.payables, {
      enableRandomTTL: true,
      jitterPercent: 20,
      enableNullCache: true,
    });
  } catch (error) {
    console.error('设置应付款缓存失败:', error);
  }
}

/**
 * 获取往来账单缓存
 */
export async function getStatementsCache(
  queryKey: string
): Promise<unknown | null> {
  try {
    const key = getCacheKey('statements', queryKey);
    return await redis.getJson(key);
  } catch (error) {
    console.error('获取往来账单缓存失败:', error);
    return null;
  }
}

/**
 * 设置往来账单缓存
 * 使用随机TTL防止缓存雪崩
 */
export async function setStatementsCache(
  queryKey: string,
  data: unknown
): Promise<void> {
  try {
    const key = getCacheKey('statements', queryKey);
    // 使用统一缓存工具，自动添加随机TTL
    await getOrSetJSON(key, async () => data, CACHE_TTL.statements, {
      enableRandomTTL: true,
      jitterPercent: 20,
      enableNullCache: true,
    });
  } catch (error) {
    console.error('设置往来账单缓存失败:', error);
  }
}

/**
 * 清除所有财务缓存
 */
export async function clearAllFinanceCache(): Promise<void> {
  try {
    const pattern = `${CACHE_PREFIX}*`;
    await redis.scanDel(pattern);
  } catch (error) {
    console.error('清除财务缓存失败:', error);
  }
}

/**
 * 清除财务统计缓存
 */
export async function clearFinanceStatisticsCache(): Promise<void> {
  try {
    const key = getCacheKey('statistics');
    await redis.del(key);
  } catch (error) {
    console.error('清除财务统计缓存失败:', error);
  }
}

/**
 * 清除应收款缓存
 */
export async function clearReceivablesCache(): Promise<void> {
  try {
    const pattern = getCacheKey('receivables', '*');
    await redis.scanDel(pattern);
  } catch (error) {
    console.error('清除应收款缓存失败:', error);
  }
}

/**
 * 清除应付款缓存
 */
export async function clearPayablesCache(): Promise<void> {
  try {
    const pattern = getCacheKey('payables', '*');
    await redis.scanDel(pattern);
  } catch (error) {
    console.error('清除应付款缓存失败:', error);
  }
}

/**
 * 清除往来账单缓存
 */
export async function clearStatementsCache(): Promise<void> {
  try {
    const pattern = getCacheKey('statements', '*');
    await redis.scanDel(pattern);
  } catch (error) {
    console.error('清除往来账单缓存失败:', error);
  }
}

/**
 * 收款后清除相关缓存
 */
export async function clearCacheAfterPayment(): Promise<void> {
  await Promise.all([
    clearFinanceStatisticsCache(),
    clearReceivablesCache(),
    clearStatementsCache(),
  ]);
}

/**
 * 付款后清除相关缓存
 */
export async function clearCacheAfterPaymentOut(): Promise<void> {
  await Promise.all([
    clearFinanceStatisticsCache(),
    clearPayablesCache(),
    clearStatementsCache(),
  ]);
}
