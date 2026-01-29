import crypto from 'crypto';

import { logger } from '@/lib/logger';
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
 * 用于缓存“确实不存在”的结果，避免缓存穿透导致的反复回源
 */
export const NULL_CACHE_TTL = 3600;

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
  if (baseTTL <= 0) {
    return baseTTL;
  }

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
      if (v !== undefined && v !== null && v !== '') {
        acc[k] = v;
      }
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
  if (fetcher === null) {
    return null;
  }

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

  const namespace = redis.getConfig().namespace;
  const lockKey = `${namespace}:lock:${key}`;
  const lockValue = crypto.randomBytes(16).toString('hex');
  const lockTTLms = Math.max(1, Math.floor(lockTTL * 1000));
  const client = redis.getClient();

  const releaseScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const computeBackoffMs = (attempt: number) => {
    const maxDelayMs = 1000;
    const exp = Math.min(maxDelayMs, retryDelay * 2 ** attempt);
    const jitter = Math.floor(Math.random() * exp);
    return Math.max(1, jitter);
  };

  // 1. 先检查缓存（快路径）
  const cached = await redis.getJson<T>(key);
  if (cached !== null) {
    if (enableNullCache && cached === (NULL_CACHE_VALUE as unknown as T)) {
      return null;
    }
    return cached;
  }

  // 2. 分布式锁：重试获取锁（指数退避 + jitter）
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const locked = await client.set(lockKey, lockValue, 'PX', lockTTLms, 'NX');

    if (locked === 'OK') {
      try {
        // 3. 双重检查缓存（避免重复回源）
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

        // 4. 回源查询
        const fresh = await fetcher();

        // 5. 空值缓存（防穿透）
        if (fresh === null && enableNullCache) {
          await redis.setJson<T>(
            key,
            NULL_CACHE_VALUE as unknown as T,
            NULL_CACHE_TTL
          );
          return null;
        }

        // 6. 正常缓存
        if (fresh !== null) {
          const finalTTL = enableRandomTTL
            ? getRandomTTL(ttlSeconds)
            : ttlSeconds;
          await redis.setJson<T>(key, fresh, finalTTL);
        }

        return fresh;
      } finally {
        // 7. 释放锁：Lua compare-and-del，确保仅 token 持有者可释放
        try {
          const released = await client.eval(
            releaseScript,
            1,
            lockKey,
            lockValue
          );

          if (released !== 1) {
            logger.warn(
              'cache',
              `lock release token mismatch: ${key}`,
              undefined,
              {
                key,
                lockReleaseMismatch: 1,
              }
            );
          }
        } catch (error) {
          logger.error(
            'cache',
            `lock release failed: ${key}`,
            error,
            undefined,
            {
              key,
            }
          );
        }
      }
    }

    // 8. 未抢到锁：先读缓存再等待
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

    if (attempt < maxRetries) {
      await sleep(computeBackoffMs(attempt));
    }
  }

  // 9. 降级：重试用尽仍未命中缓存，直接回源
  return fetcher();
}

export async function invalidateNamespace(
  namespacePattern: string
): Promise<number> {
  // pattern example: 'products:list:*'
  return redis.scanDel(namespacePattern);
}
