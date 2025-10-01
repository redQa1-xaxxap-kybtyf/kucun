import crypto from 'node:crypto';

import { redis } from '@/lib/redis/redis-client';

export interface CacheOptions {
  ttlSeconds?: number;
  namespace: 'products:list' | 'inventory:list' | string;
}

/**
 * 空值缓存标记
 * 用于标识缓存中的空值，防止缓存穿透
 */
export const NULL_CACHE_VALUE = '__NULL__';

/**
 * 空值缓存TTL（秒）
 * 空值缓存时间短一些，避免占用过多缓存空间
 */
export const NULL_CACHE_TTL = 10;

/**
 * 生成随机TTL，防止缓存雪崩
 * @param baseTTL 基础TTL（秒）
 * @param jitterPercent 抖动百分比（0-100），默认20%
 * @returns 随机TTL（秒）
 *
 * @example
 * const ttl = getRandomTTL(60, 20); // 返回 48-72 秒之间的随机值
 */
export function getRandomTTL(baseTTL: number, jitterPercent = 20): number {
  if (baseTTL <= 0) return baseTTL;

  const jitter = Math.floor(baseTTL * (jitterPercent / 100));
  const randomJitter = Math.floor(Math.random() * jitter * 2) - jitter;
  return Math.max(1, baseTTL + randomJitter); // 确保TTL至少为1秒
}

export function buildCacheKey(
  namespace: string,
  params: Record<string, unknown>
): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      // Only include defined & primitive-like values
      const v = (params as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && v !== '') acc[k] = v;
      return acc;
    }, {});
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(sorted))
    .digest('hex')
    .slice(0, 16);
  return `${namespace}:${hash}`;
}

/**
 * 获取或设置JSON缓存
 * 支持空值缓存和随机TTL，防止缓存穿透和缓存雪崩
 *
 * @param key 缓存键
 * @param fetcher 数据获取函数，为null时只返回缓存结果
 * @param ttlSeconds 缓存TTL（秒），会自动添加随机抖动
 * @param options 缓存选项
 * @returns 缓存数据或null
 */
export async function getOrSetJSON<T>(
  key: string,
  fetcher: (() => Promise<T>) | null,
  ttlSeconds?: number,
  options?: {
    enableNullCache?: boolean; // 是否启用空值缓存，默认true
    enableRandomTTL?: boolean; // 是否启用随机TTL，默认true
    jitterPercent?: number; // TTL抖动百分比，默认20%
  }
): Promise<T | null> {
  const {
    enableNullCache = true,
    enableRandomTTL = true,
    jitterPercent = 20,
  } = options || {};

  // 1. 尝试从缓存获取
  const cached = await redis.getJson<T>(key);

  // 2. 检查是否是缓存的空值
  if (cached !== null) {
    if (enableNullCache && cached === (NULL_CACHE_VALUE as unknown as T)) {
      return null; // 返回null，不查询数据库
    }
    return cached;
  }

  // 3. 如果fetcher为null，只返回缓存结果
  if (fetcher === null) return null;

  // 4. 从数据库获取数据
  const fresh = await fetcher();

  // 5. 处理空值缓存
  if (fresh === null && enableNullCache) {
    // 缓存空值，防止缓存穿透
    await redis.setJson<T>(
      key,
      NULL_CACHE_VALUE as unknown as T,
      NULL_CACHE_TTL
    );
    return null;
  }

  // 6. 缓存正常数据，使用随机TTL防止缓存雪崩
  if (fresh !== null) {
    const finalTTL =
      ttlSeconds && enableRandomTTL
        ? getRandomTTL(ttlSeconds, jitterPercent)
        : ttlSeconds;

    await redis.setJson<T>(key, fresh, finalTTL);
  }

  return fresh;
}

/**
 * 使用分布式锁获取或设置缓存
 * 防止缓存击穿（热点数据失效时大量请求同时查询数据库）
 *
 * @param key 缓存键
 * @param fetcher 数据获取函数
 * @param ttlSeconds 缓存TTL（秒）
 * @param options 缓存选项
 * @returns 缓存数据或null
 */
export async function getOrSetWithLock<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number,
  options?: {
    lockTTL?: number; // 锁超时时间（秒），默认10秒
    retryDelay?: number; // 重试延迟（毫秒），默认100ms
    maxRetries?: number; // 最大重试次数，默认30次
    enableNullCache?: boolean; // 是否启用空值缓存，默认true
    enableRandomTTL?: boolean; // 是否启用随机TTL，默认true
  }
): Promise<T | null> {
  const {
    lockTTL = 10,
    retryDelay = 100,
    maxRetries = 30,
    enableNullCache = true,
    enableRandomTTL = true,
  } = options || {};

  // 1. 尝试从缓存获取
  const cached = await redis.getJson<T>(key);
  if (cached !== null) {
    if (enableNullCache && cached === (NULL_CACHE_VALUE as unknown as T)) {
      return null;
    }
    return cached;
  }

  // 2. 尝试获取分布式锁
  const lockKey = `lock:${key}`;
  const lockValue = `${Date.now()}-${Math.random()}`;

  const locked = await redis.getClient().set(
    lockKey,
    lockValue,
    'EX',
    lockTTL,
    'NX' // 只在键不存在时设置
  );

  if (locked === 'OK') {
    try {
      // 3. 获取锁成功，再次检查缓存（双重检查）
      const cachedAgain = await redis.getJson<T>(key);
      if (cachedAgain !== null) {
        if (
          enableNullCache &&
          cachedAgain === (NULL_CACHE_VALUE as unknown as T)
        ) {
          return null;
        }
        return cachedAgain;
      }

      // 4. 查询数据库
      const fresh = await fetcher();

      // 5. 处理空值缓存
      if (fresh === null && enableNullCache) {
        await redis.setJson<T>(
          key,
          NULL_CACHE_VALUE as unknown as T,
          NULL_CACHE_TTL
        );
        return null;
      }

      // 6. 缓存正常数据
      if (fresh !== null) {
        const finalTTL = enableRandomTTL
          ? getRandomTTL(ttlSeconds)
          : ttlSeconds;
        await redis.setJson<T>(key, fresh, finalTTL);
      }

      return fresh;
    } finally {
      // 7. 释放锁（只释放自己的锁）
      const currentLock = await redis.getClient().get(lockKey);
      if (currentLock === lockValue) {
        await redis.del(lockKey);
      }
    }
  } else {
    // 8. 获取锁失败，等待并重试
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));

      // 重试时先检查缓存
      const cachedRetry = await redis.getJson<T>(key);
      if (cachedRetry !== null) {
        if (
          enableNullCache &&
          cachedRetry === (NULL_CACHE_VALUE as unknown as T)
        ) {
          return null;
        }
        return cachedRetry;
      }
    }

    // 9. 重试次数用尽，直接查询数据库（降级策略）
    return fetcher();
  }
}

export async function invalidateNamespace(
  namespacePattern: string
): Promise<number> {
  // pattern example: 'products:list:*'
  return redis.scanDel(namespacePattern);
}
