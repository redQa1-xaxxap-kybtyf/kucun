import Redis from 'ioredis';

import { env, redisConfig } from '@/lib/env';

export interface RedisClientWrapper {
  getClient(): Redis;
  ping(): Promise<string>;
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
// 使用 unref() 防止此定时器阻止 Node.js 进程退出
const cleanupInterval = setInterval(cleanExpiredMemoryCache, 60000); // 每分钟清理一次
cleanupInterval.unref();

function createClient(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
    lazyConnect: false,
    connectTimeout: 10000,
    // 修复: 增加 keepAlive 时间，避免频繁断开连接
    keepAlive: 60000, // 60秒
    // 修复: 添加命令超时设置
    commandTimeout: 5000,
    // 修复: 优化重试策略，避免过于频繁的重连
    retryStrategy: (times: number) => {
      // 如果重试次数过多，标记 Redis 不可用并停止重试
      if (times > 5) {
        isRedisAvailable = false;
        return null; // 停止重试
      }
      // 指数退避: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(Math.pow(2, times) * 1000, 30000);
      return delay;
    },
    // 修复: 添加重连延迟，避免立即重连
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // 只在特定错误时重连
        return true;
      }
      return false;
    },
  });

  // 修复: 优化错误处理，避免每次错误都打印日志
  let lastErrorTime = 0;
  const ERROR_LOG_INTERVAL = 10000; // 10秒内只打印一次错误

  client.on('error', (err: unknown) => {
    isRedisAvailable = false;
    const now = Date.now();
    if (
      env.NODE_ENV === 'development' &&
      now - lastErrorTime > ERROR_LOG_INTERVAL
    ) {
      console.error('[Redis] error:', err);
      lastErrorTime = now;
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

  // 修复: 减少重连日志的打印频率
  let lastReconnectLogTime = 0;
  client.on('reconnecting', () => {
    const now = Date.now();
    if (
      env.NODE_ENV === 'development' &&
      now - lastReconnectLogTime > ERROR_LOG_INTERVAL
    ) {
      // eslint-disable-next-line no-console
      console.log('[Redis] reconnecting...');
      lastReconnectLogTime = now;
    }
  });

  client.on('close', () => {
    isRedisAvailable = false;
  });

  return client;
}

// 修复: 防止热重载时的连接泄漏
// 在开发环境中，使用全局变量存储连接池，避免每次热重载都创建新连接
declare global {
  var __redisPool: Redis[] | undefined;
}

// Simple round-robin pool
const pool: Redis[] =
  global.__redisPool ||
  Array.from({ length: poolSize }, () => createClient(redisUrl));

// 在开发环境中保存连接池到全局变量
if (env.NODE_ENV === 'development') {
  global.__redisPool = pool;
}

let rrIndex = 0;

// 修复: 添加优雅关闭函数
function gracefulShutdown(): void {
  if (env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[Redis] Gracefully shutting down connection pool...');
  }
  pool.forEach(client => {
    client.disconnect();
  });
}

// 修复: 监听进程退出事件，确保连接正确关闭
if (typeof process !== 'undefined') {
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  process.on('beforeExit', gracefulShutdown);
}

function prefixed(key: string): string {
  return `${namespace}:${key}`;
}

// 检查Redis是否可用
async function checkRedisAvailability(): Promise<boolean> {
  const now = Date.now();

  // 早期退出：如果Redis已知不可用且在检查间隔内，直接返回false
  if (!isRedisAvailable && now - lastRedisCheckTime < REDIS_CHECK_INTERVAL) {
    return false;
  }

  // 如果Redis可用且在检查间隔内，直接返回true
  if (isRedisAvailable && now - lastRedisCheckTime < REDIS_CHECK_INTERVAL) {
    return true;
  }

  try {
    const client = pool[0];
    await client.ping();
    isRedisAvailable = true;
    lastRedisCheckTime = now;
    return true;
  } catch {
    isRedisAvailable = false;
    // 🔥 关键修复：在 catch 块中也要设置检查时间，避免每次调用都执行 ping
    lastRedisCheckTime = now;
    return false;
  }
}

export const redis: RedisClientWrapper = {
  getClient(): Redis {
    rrIndex = (rrIndex + 1) % pool.length;
    return pool[rrIndex];
  },

  async ping(): Promise<string> {
    try {
      const client = this.getClient();
      return await client.ping();
    } catch (error) {
      if (env.NODE_ENV === 'development') {
        console.error('[Redis] ping failed:', error);
      }
      throw error;
    }
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

    // 防止 TTL=0 导致内存泄漏：要求明确的 TTL 或使用默认值
    const DEFAULT_TTL = 3600; // 默认 1 小时
    const effectiveTTL =
      ttlSeconds && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL;
    const expiry = Date.now() + effectiveTTL * 1000;

    // 始终写入内存缓存作为备份
    memoryCache.set(prefixedKey, { value, expiry });

    // 尝试写入Redis
    if (await checkRedisAvailability()) {
      try {
        return await this.getClient().set(
          prefixedKey,
          payload,
          'EX',
          effectiveTTL
        );
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
