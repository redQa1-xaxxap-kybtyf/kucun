import Redis from 'ioredis';

import { env, redisConfig } from '@/lib/env';

export interface RedisClientWrapper {
  getClient(): Redis;
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  scanDel(pattern: string): Promise<number>;
}

const poolSize = redisConfig.poolSize;
const redisUrl = redisConfig.url;
const namespace = redisConfig.namespace;

// 内存缓存作为Redis降级方案
interface MemoryCacheEntry {
  value: unknown;
  expiry: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();
let isRedisAvailable = true;
let lastRedisCheckTime = 0;
const REDIS_CHECK_INTERVAL = 30000; // 30秒检查一次Redis可用性

// 清理过期的内存缓存
function cleanExpiredMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiry > 0 && entry.expiry < now) {
      memoryCache.delete(key);
    }
  }
}

// 定期清理过期缓存
setInterval(cleanExpiredMemoryCache, 60000); // 每分钟清理一次

function createClient(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
    lazyConnect: false,
    connectTimeout: 10000,
    keepAlive: 30000,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 1000, 30000);
      if (times > 10) {
        isRedisAvailable = false;
        return null; // 停止重试
      }
      return delay;
    },
  });

  client.on('error', (err: unknown) => {
    isRedisAvailable = false;
    if (env.NODE_ENV === 'development') {
       
      console.error('[Redis] error:', err);
    }
  });

  client.on('connect', () => {
    isRedisAvailable = true;
    lastRedisCheckTime = Date.now();
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Redis] connected');
    }
  });

  client.on('reconnecting', () => {
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Redis] reconnecting...');
    }
  });

  client.on('close', () => {
    isRedisAvailable = false;
  });

  return client;
}

// Simple round-robin pool
const pool: Redis[] = Array.from({ length: poolSize }, () =>
  createClient(redisUrl)
);
let rrIndex = 0;

function prefixed(key: string): string {
  return `${namespace}:${key}`;
}

// 检查Redis是否可用
async function checkRedisAvailability(): Promise<boolean> {
  const now = Date.now();
  if (now - lastRedisCheckTime < REDIS_CHECK_INTERVAL) {
    return isRedisAvailable;
  }

  try {
    const client = pool[0];
    await client.ping();
    isRedisAvailable = true;
    lastRedisCheckTime = now;
    return true;
  } catch {
    isRedisAvailable = false;
    return false;
  }
}

export const redis: RedisClientWrapper = {
  getClient(): Redis {
    rrIndex = (rrIndex + 1) % pool.length;
    return pool[rrIndex];
  },

  async getJson<T>(key: string): Promise<T | null> {
    const prefixedKey = prefixed(key);

    // 优先从Redis获取
    if (await checkRedisAvailability()) {
      try {
        const raw = await this.getClient().get(prefixedKey);
        if (raw) {
          try {
            return JSON.parse(raw) as T;
          } catch {
            return null;
          }
        }
      } catch (error) {
        if (env.NODE_ENV === 'development') {
           
          console.warn(
            '[Redis] getJson failed, falling back to memory:',
            error
          );
        }
      }
    }

    // 降级到内存缓存
    const cached = memoryCache.get(prefixedKey);
    if (cached) {
      if (cached.expiry === 0 || cached.expiry > Date.now()) {
        return cached.value as T;
      }
      memoryCache.delete(prefixedKey);
    }

    return null;
  },

  async setJson<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<'OK' | null> {
    const payload = JSON.stringify(value);
    const prefixedKey = prefixed(key);
    const expiry =
      ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;

    // 始终写入内存缓存作为备份
    memoryCache.set(prefixedKey, { value, expiry });

    // 尝试写入Redis
    if (await checkRedisAvailability()) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          return await this.getClient().set(
            prefixedKey,
            payload,
            'EX',
            ttlSeconds
          );
        }
        return await this.getClient().set(prefixedKey, payload);
      } catch (error) {
        if (env.NODE_ENV === 'development') {
           
          console.warn(
            '[Redis] setJson failed, using memory cache only:',
            error
          );
        }
      }
    }

    return 'OK'; // 内存缓存写入成功
  },

  async del(key: string): Promise<number> {
    const prefixedKey = prefixed(key);

    // 从内存缓存删除
    const memDeleted = memoryCache.delete(prefixedKey) ? 1 : 0;

    // 尝试从Redis删除
    if (await checkRedisAvailability()) {
      try {
        return await this.getClient().del(prefixedKey);
      } catch (error) {
        if (env.NODE_ENV === 'development') {
           
          console.warn('[Redis] del failed:', error);
        }
      }
    }

    return memDeleted;
  },

  async scanDel(pattern: string): Promise<number> {
    const patt = prefixed(pattern);
    let deleted = 0;

    // 从内存缓存删除匹配的键
    const regex = new RegExp(patt.replace(/\*/g, '.*'));
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
        deleted++;
      }
    }

    // 尝试从Redis删除
    if (await checkRedisAvailability()) {
      try {
        const client = this.getClient();
        let cursor = '0';
        do {
           
          const [next, keys] = await client.scan(
            cursor,
            'MATCH',
            patt,
            'COUNT',
            100
          );
          cursor = next;
          if (keys.length > 0) {
             
            const n = await client.unlink(...keys);
            deleted += n;
          }
        } while (cursor !== '0');
      } catch (error) {
        if (env.NODE_ENV === 'development') {
           
          console.warn('[Redis] scanDel failed:', error);
        }
      }
    }

    return deleted;
  },
};
