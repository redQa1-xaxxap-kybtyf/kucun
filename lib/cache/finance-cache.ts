/**
 * 财务数据缓存工具
 * 使用Redis缓存财务统计数据,提升查询性能
 * 严格遵循全局约定规范
 */

import { redis } from '@/lib/redis';

// 缓存键前缀
const CACHE_PREFIX = 'finance:';

// 缓存TTL(秒)
const CACHE_TTL = {
  statistics: 300, // 5分钟
  receivables: 180, // 3分钟
  payables: 180, // 3分钟
  statements: 300, // 5分钟
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
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('获取财务统计缓存失败:', error);
    return null;
  }
}

/**
 * 设置财务统计缓存
 */
export async function setFinanceStatisticsCache(data: unknown): Promise<void> {
  try {
    const key = getCacheKey('statistics');
    await redis.setex(key, CACHE_TTL.statistics, JSON.stringify(data));
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
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('获取应收款缓存失败:', error);
    return null;
  }
}

/**
 * 设置应收款列表缓存
 */
export async function setReceivablesCache(
  queryKey: string,
  data: unknown
): Promise<void> {
  try {
    const key = getCacheKey('receivables', queryKey);
    await redis.setex(key, CACHE_TTL.receivables, JSON.stringify(data));
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
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('获取应付款缓存失败:', error);
    return null;
  }
}

/**
 * 设置应付款列表缓存
 */
export async function setPayablesCache(
  queryKey: string,
  data: unknown
): Promise<void> {
  try {
    const key = getCacheKey('payables', queryKey);
    await redis.setex(key, CACHE_TTL.payables, JSON.stringify(data));
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
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('获取往来账单缓存失败:', error);
    return null;
  }
}

/**
 * 设置往来账单缓存
 */
export async function setStatementsCache(
  queryKey: string,
  data: unknown
): Promise<void> {
  try {
    const key = getCacheKey('statements', queryKey);
    await redis.setex(key, CACHE_TTL.statements, JSON.stringify(data));
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
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
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
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
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
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
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
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
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

