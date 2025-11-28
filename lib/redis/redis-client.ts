import Redis from 'ioredis';

import { env, redisConfig } from '@/lib/env';
import { logger } from '@/lib/logger';

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * 事务回调函数类型
 * 接收一个 Redis Pipeline 对象，返回 Promise
 */
export type TransactionCallback<T> = (
  pipeline: ReturnType<Redis['multi']>
) => Promise<T>;

export interface RedisClientWrapper {
  getClient(): Redis;
  ping(): Promise<string>;
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  scanDel(pattern: string): Promise<number>;
  transaction<T>(callback: TransactionCallback<T>): Promise<T>;
  getMemoryCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  };
  clearMemoryCache(): void;
  getPoolHealth(): {
    total: number;
    ready: number;
    connecting: number;
    reconnecting: number;
    disconnected: number;
    isRedisAvailable: boolean;
  };
  getConfig(): {
    url: string;
    poolSize: number;
    namespace: string;
    db: number;
    tlsEnabled: boolean;
    connectTimeout: number;
    commandTimeout: number;
    keepAlive: number;
    maxRetries: number;
  };
}

const poolSize = redisConfig.poolSize;
const redisUrl = redisConfig.url;
const namespace = redisConfig.namespace;

// 内存缓存作为Redis降级方案
interface MemoryCacheEntry {
  value: unknown;
  expiry: number;
  lastAccessed: number; // 用于LRU淘汰
}

// LRU缓存配置
const MAX_MEMORY_CACHE_SIZE = 1000; // 最多缓存1000个键
const memoryCache = new Map<string, MemoryCacheEntry>();
let isRedisAvailable = true;
let lastRedisCheckTime = 0;
let lastSuccessfulOperation = Date.now(); // 记录最后一次成功操作的时间
const REDIS_CHECK_INTERVAL = 60000; // 60秒检查一次Redis可用性
const OPERATION_SUCCESS_THRESHOLD = 30000; // 30秒内有成功操作则认为可用
const HEALTH_CHECK_TIMEOUT = 5000; // 健康检查超时时间5秒

// LRU淘汰策略：删除最久未访问的键
function evictLRU(): void {
  if (memoryCache.size < MAX_MEMORY_CACHE_SIZE) {
    return;
  }

  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    memoryCache.delete(oldestKey);
  }
}

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
type MaybeUnrefTimer = { unref?: () => void };
const maybeUnrefTimer = cleanupInterval as unknown as MaybeUnrefTimer;
if (typeof maybeUnrefTimer.unref === 'function') {
  maybeUnrefTimer.unref();
}

function createClient(url: string): Redis {
  const client = new Redis(url, {
    // 基本配置
    password: redisConfig.password,
    db: redisConfig.db,
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
    lazyConnect: false,

    // 连接超时配置
    connectTimeout: redisConfig.connectTimeout,
    commandTimeout: redisConfig.commandTimeout,
    keepAlive: redisConfig.keepAlive,

    // TLS/SSL 配置
    tls: redisConfig.tlsEnabled ? {} : undefined,
    // 生产环境建议配置证书验证：
    // tls: redisConfig.tlsEnabled ? {
    //   ca: fs.readFileSync('/path/to/ca.crt'),
    //   cert: fs.readFileSync('/path/to/client.crt'),
    //   key: fs.readFileSync('/path/to/client.key'),
    //   rejectUnauthorized: true,
    // } : undefined,

    // 优化重试策略，避免过于频繁的重连
    retryStrategy: (times: number) => {
      // 如果重试次数超过配置的最大值，标记 Redis 不可用并停止重试
      if (times > redisConfig.maxRetries) {
        isRedisAvailable = false;
        return null; // 停止重试
      }
      // 指数退避: 1s, 2s, 4s, 8s, 16s，最大30秒
      const delay = Math.min(Math.pow(2, times) * 1000, 30000);
      return delay;
    },

    // 添加重连延迟，避免立即重连
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
      logger.error('redis-client', 'Redis error', err);
      lastErrorTime = now;
    }
  });

  client.on('connect', () => {
    isRedisAvailable = true;
    lastRedisCheckTime = Date.now();
    if (env.NODE_ENV === 'development' && process.env.NODE_ENV !== 'test') {
      logger.info('redis-client', 'Redis connected');
    }
  });

  // 修复: 减少重连日志的打印频率
  let lastReconnectLogTime = 0;
  client.on('reconnecting', () => {
    const now = Date.now();
    if (
      env.NODE_ENV === 'development' &&
      process.env.NODE_ENV !== 'test' &&
      now - lastReconnectLogTime > ERROR_LOG_INTERVAL
    ) {
      logger.info('redis-client', 'Redis reconnecting');
      lastReconnectLogTime = now;
    }
  });

  client.on('close', () => {
    isRedisAvailable = false;
  });

  return client;
}

// 修复: 防止热重载时的连接泄漏
// 在开发环境中，可以使用全局变量缓存连接池；
// 但在生产环境，必须始终使用进程私有的连接池，避免资源泄漏或跨请求意外共享。
declare global {
  // 仅在开发环境下使用，用于 Next.js HMR
  // 不在生产环境写入或依赖此变量

  var __redisPool: Redis[] | undefined;
}

// Simple round-robin pool
const pool: Redis[] =
  env.NODE_ENV === 'development' &&
  typeof global !== 'undefined' &&
  global.__redisPool
    ? global.__redisPool
    : Array.from({ length: poolSize }, () => createClient(redisUrl));

// 仅在开发环境中把连接池挂到全局，避免 HMR 重复创建连接；
// 生产环境禁止写入全局，防止长生命周期资源泄漏。
if (env.NODE_ENV === 'development' && typeof global !== 'undefined') {
  global.__redisPool = pool;
}

let rrIndex = 0;

// 修复: 添加优雅关闭函数
function gracefulShutdown(): void {
  if (env.NODE_ENV === 'development' && process.env.NODE_ENV !== 'test') {
    logger.info(
      'redis-client',
      'Gracefully shutting down Redis connection pool'
    );
  }
  pool.forEach(client => {
    client.disconnect();
  });
}

// 修复: 监听进程退出事件，确保连接正确关闭
// 使用全局标记防止热重载时重复添加监听器
declare global {
  var __redisShutdownRegistered: boolean | undefined;
}

if (typeof process !== 'undefined' && !global.__redisShutdownRegistered) {
  global.__redisShutdownRegistered = true;
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  process.on('beforeExit', gracefulShutdown);
}

function prefixed(key: string): string {
  return `${namespace}:${key}`;
}

/**
 * 非阻塞异步健康检查
 * 在后台执行，不阻塞主流程
 */
async function checkHealthAsync(): Promise<void> {
  try {
    const client = pool[0];
    // 使用 Promise.race 实现超时控制
    await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Health check timeout')),
          HEALTH_CHECK_TIMEOUT
        )
      ),
    ]);
    isRedisAvailable = true;
    lastSuccessfulOperation = Date.now();
  } catch {
    isRedisAvailable = false;
  } finally {
    lastRedisCheckTime = Date.now();
  }
}

/**
 * 检查Redis是否可用（优化版本）
 * 策略：
 * 1. 如果最近有成功操作（30秒内），直接返回 true（快速路径）
 * 2. 避免频繁健康检查（60秒间隔）
 * 3. 使用非阻塞异步检查，不影响主流程
 */
async function checkRedisAvailability(): Promise<boolean> {
  const now = Date.now();

  // 快速路径：最近有成功操作，直接认为可用
  if (now - lastSuccessfulOperation < OPERATION_SUCCESS_THRESHOLD) {
    return true;
  }

  // 避免频繁健康检查
  if (now - lastRedisCheckTime < REDIS_CHECK_INTERVAL) {
    return isRedisAvailable;
  }

  // 触发非阻塞健康检查（不等待结果）
  checkHealthAsync().catch(() => {
    // 静默处理错误，避免未捕获的 Promise rejection
  });

  return isRedisAvailable;
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
        logger.error('redis-client', 'Redis ping failed', error);
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
          // 记录成功操作
          lastSuccessfulOperation = Date.now();
          try {
            return JSON.parse(raw) as T;
          } catch {
            return null;
          }
        }
        // 即使值为空，操作成功也要记录
        lastSuccessfulOperation = Date.now();
      } catch (error) {
        if (env.NODE_ENV === 'development') {
          logger.warn(
            'redis-client',
            'getJson failed, falling back to memory cache',
            undefined,
            { error: serializeError(error) }
          );
        }
      }
    }

    // 降级到内存缓存
    const cached = memoryCache.get(prefixedKey);
    if (cached) {
      if (cached.expiry === 0 || cached.expiry > Date.now()) {
        // 更新最后访问时间（LRU）
        cached.lastAccessed = Date.now();
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

    // 在写入前执行LRU淘汰
    evictLRU();

    // 始终写入内存缓存作为备份
    memoryCache.set(prefixedKey, {
      value,
      expiry,
      lastAccessed: Date.now(),
    });

    // 尝试写入Redis
    if (await checkRedisAvailability()) {
      try {
        const result = await this.getClient().set(
          prefixedKey,
          payload,
          'EX',
          effectiveTTL
        );
        // 记录成功操作
        lastSuccessfulOperation = Date.now();
        return result;
      } catch (error) {
        if (env.NODE_ENV === 'development') {
          logger.warn(
            'redis-client',
            'setJson failed, using memory cache only',
            undefined,
            { error: serializeError(error) }
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
        const result = await this.getClient().del(prefixedKey);
        // 记录成功操作
        lastSuccessfulOperation = Date.now();
        return result;
      } catch (error) {
        if (env.NODE_ENV === 'development') {
          logger.warn('redis-client', 'del failed', undefined, {
            error: serializeError(error),
          });
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
          logger.warn('redis-client', 'scanDel failed', undefined, {
            error: serializeError(error),
          });
        }
      }
    }

    return deleted;
  },

  /**
   * 执行 Redis 事务（MULTI/EXEC）
   * 提供原子性保证，所有命令要么全部执行，要么全部不执行
   *
   * @param callback - 事务回调函数，接收 Pipeline 对象
   * @returns 事务执行结果
   *
   * @example
   * ```typescript
   * // 原子性地增加库存和减少预留
   * const result = await redis.transaction(async (pipeline) => {
   *   pipeline.hincrby('inventory:product-1', 'quantity', 10);
   *   pipeline.hincrby('inventory:product-1', 'reserved', -10);
   *   return pipeline.exec();
   * });
   * ```
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!(await checkRedisAvailability())) {
      throw new Error('[Redis] Transaction failed: Redis is not available');
    }

    try {
      const client = this.getClient();
      const pipeline = client.multi();

      // 执行回调函数，构建事务命令
      const result = await callback(pipeline);

      return result;
    } catch (error) {
      if (env.NODE_ENV === 'development') {
        logger.error('redis-client', 'Redis transaction failed', error);
      }
      throw error;
    }
  },

  // 获取内存缓存统计信息（用于监控）
  getMemoryCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: memoryCache.size,
      maxSize: MAX_MEMORY_CACHE_SIZE,
      hitRate: 0, // 可以后续添加命中率统计
    };
  },

  // 清空内存缓存（用于测试或紧急情况）
  clearMemoryCache(): void {
    memoryCache.clear();
  },

  // 获取连接池健康状态（用于监控）
  getPoolHealth(): {
    total: number;
    ready: number;
    connecting: number;
    reconnecting: number;
    disconnected: number;
    isRedisAvailable: boolean;
  } {
    const statusCounts = {
      ready: 0,
      connecting: 0,
      reconnecting: 0,
      disconnected: 0,
    };

    pool.forEach(client => {
      const status = client.status;
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts]++;
      }
    });

    return {
      total: pool.length,
      ...statusCounts,
      isRedisAvailable,
    };
  },

  // 获取 Redis 配置信息（用于调试）
  getConfig(): {
    url: string;
    poolSize: number;
    namespace: string;
    db: number;
    tlsEnabled: boolean;
    connectTimeout: number;
    commandTimeout: number;
    keepAlive: number;
    maxRetries: number;
  } {
    return {
      url: redisConfig.url,
      poolSize: redisConfig.poolSize,
      namespace: redisConfig.namespace,
      db: redisConfig.db,
      tlsEnabled: redisConfig.tlsEnabled,
      connectTimeout: redisConfig.connectTimeout,
      commandTimeout: redisConfig.commandTimeout,
      keepAlive: redisConfig.keepAlive,
      maxRetries: redisConfig.maxRetries,
    };
  },
};
