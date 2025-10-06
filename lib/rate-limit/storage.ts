/**
 * 速率限制存储适配器
 * 支持 Redis 和内存双存储，自动降级
 */

import type Redis from 'ioredis';

import { env } from '@/lib/env';

/**
 * 速率限制存储接口
 */
export interface RateLimitStorage {
  /**
   * 获取时间窗口内的请求时间戳
   * @param key 存储键
   * @param windowStart 窗口开始时间（毫秒时间戳）
   * @param windowEnd 窗口结束时间（毫秒时间戳）
   * @returns 请求时间戳数组
   */
  getRequestsInWindow(
    key: string,
    windowStart: number,
    windowEnd: number
  ): Promise<number[]>;

  /**
   * 添加请求记录
   * @param key 存储键
   * @param timestamp 时间戳（毫秒）
   * @param ttl 过期时间（毫秒）
   */
  addRequest(key: string, timestamp: number, ttl: number): Promise<void>;

  /**
   * 清理过期数据
   * @param key 存储键
   * @param before 清理此时间之前的数据
   */
  cleanup(key: string, before: number): Promise<void>;
}

/**
 * Redis 速率限制存储实现
 * 使用 Redis Sorted Set (ZSET) 实现滑动窗口算法
 */
export class RedisRateLimitStorage implements RateLimitStorage {
  constructor(private redis: Redis) {}

  /**
   * 获取时间窗口内的请求数量
   * 使用 ZCOUNT 命令高效统计
   */
  async getRequestsInWindow(
    key: string,
    windowStart: number,
    windowEnd: number
  ): Promise<number[]> {
    try {
      // 使用 ZCOUNT 统计指定分数范围内的成员数量
      const count = await this.redis.zcount(key, windowStart, windowEnd);

      // 返回数量对应的时间戳数组（只需要长度，不需要实际值）
      return Array(count).fill(0);
    } catch (error) {
      if (env.NODE_ENV === 'development') {
        console.error('[RedisRateLimitStorage] getRequestsInWindow 错误:', error);
      }
      throw error;
    }
  }

  /**
   * 添加请求记录
   * 使用 ZADD 添加成员，分数为时间戳
   */
  async addRequest(key: string, timestamp: number, ttl: number): Promise<void> {
    try {
      // 使用管道批量执行命令
      const pipeline = this.redis.pipeline();

      // 添加成员到有序集合，分数为时间戳，成员为 timestamp-随机数
      // 随机数确保同一时间戳的多个请求不会被覆盖
      const member = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
      pipeline.zadd(key, timestamp, member);

      // 设置过期时间（秒）
      pipeline.expire(key, Math.ceil(ttl / 1000));

      await pipeline.exec();
    } catch (error) {
      if (env.NODE_ENV === 'development') {
        console.error('[RedisRateLimitStorage] addRequest 错误:', error);
      }
      throw error;
    }
  }

  /**
   * 清理过期数据
   * 使用 ZREMRANGEBYSCORE 删除指定分数范围的成员
   */
  async cleanup(key: string, before: number): Promise<void> {
    try {
      // 删除分数小于 before 的所有成员
      await this.redis.zremrangebyscore(key, '-inf', before);
    } catch (error) {
      if (env.NODE_ENV === 'development') {
        console.error('[RedisRateLimitStorage] cleanup 错误:', error);
      }
      // 清理失败不抛出错误，避免影响主流程
    }
  }
}

/**
 * 内存缓存条目接口
 */
interface MemoryCacheEntry {
  /** 请求时间戳数组 */
  requests: number[];
  /** 过期时间（毫秒时间戳） */
  expiry: number;
}

/**
 * 内存速率限制存储实现
 * 作为 Redis 不可用时的降级方案
 */
export class MemoryRateLimitStorage implements RateLimitStorage {
  /** 内存缓存 Map */
  private cache = new Map<string, MemoryCacheEntry>();

  constructor() {
    // 定期清理过期数据
    this.startCleanupInterval();
  }

  /**
   * 获取时间窗口内的请求时间戳
   */
  async getRequestsInWindow(
    key: string,
    windowStart: number,
    windowEnd: number
  ): Promise<number[]> {
    const entry = this.cache.get(key);

    if (!entry) {
      return [];
    }

    // 检查是否过期
    if (entry.expiry > 0 && entry.expiry < Date.now()) {
      this.cache.delete(key);
      return [];
    }

    // 过滤出时间窗口内的请求
    return entry.requests.filter(
      timestamp => timestamp >= windowStart && timestamp <= windowEnd
    );
  }

  /**
   * 添加请求记录
   */
  async addRequest(key: string, timestamp: number, ttl: number): Promise<void> {
    const entry = this.cache.get(key);
    const expiry = Date.now() + ttl;

    if (entry) {
      // 追加时间戳
      entry.requests.push(timestamp);
      entry.expiry = expiry;
    } else {
      // 创建新条目
      this.cache.set(key, {
        requests: [timestamp],
        expiry,
      });
    }
  }

  /**
   * 清理过期数据
   */
  async cleanup(key: string, before: number): Promise<void> {
    const entry = this.cache.get(key);

    if (!entry) {
      return;
    }

    // 过滤掉过期的时间戳
    const validRequests = entry.requests.filter(timestamp => timestamp >= before);

    if (validRequests.length === 0) {
      this.cache.delete(key);
    } else {
      entry.requests = validRequests;
    }
  }

  /**
   * 启动定期清理任务
   * 每分钟清理一次过期数据
   */
  private startCleanupInterval(): void {
    const interval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // 60秒

    // 使用 unref 防止阻止进程退出
    interval.unref();
  }

  /**
   * 清理所有过期条目
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();

    // 使用 Array.from 避免迭代器兼容性问题
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expiry > 0 && entry.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息（用于调试）
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * 创建存储适配器
 * 优先使用 Redis，失败时降级到内存存储
 *
 * @param redisClient Redis 客户端（可选）
 * @returns 存储适配器实例
 */
export function createRateLimitStorage(
  redisClient?: Redis
): RateLimitStorage {
  if (redisClient) {
    try {
      return new RedisRateLimitStorage(redisClient);
    } catch (error) {
      if (env.NODE_ENV === 'development') {
        console.warn(
          '[RateLimit] Redis 存储初始化失败，降级到内存存储:',
          error
        );
      }
    }
  }

  // 降级到内存存储
  if (env.NODE_ENV === 'development') {
    console.log('[RateLimit] 使用内存存储（适合开发环境）');
  }

  return new MemoryRateLimitStorage();
}
