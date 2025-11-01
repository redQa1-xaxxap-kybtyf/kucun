/**
 * Rate Limiter Service
 * 基于 Redis 的访问频率限制服务
 *
 * SOLID-S: 单一职责 - 只负责访问频率控制
 * DRY: 统一的频率限制逻辑
 *
 * 使用场景：
 * - 限制对运输查询网站的访问频率
 * - 防止被目标网站封禁
 * - 保护系统资源
 */

import Redis from 'ioredis';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Rate Limiter 配置
 */
export interface RateLimiterConfig {
  /** 时间窗口（秒） */
  windowSeconds: number;
  /** 时间窗口内最大请求数 */
  maxRequests: number;
  /** 超限时的等待策略 */
  waitStrategy: 'reject' | 'wait';
  /** 最大等待时间（毫秒），仅在 waitStrategy='wait' 时有效 */
  maxWaitMs?: number;
}

/**
 * Rate Limiter 结果
 */
export interface RateLimiterResult {
  /** 是否允许请求 */
  allowed: boolean;
  /** 剩余请求数 */
  remaining: number;
  /** 窗口重置时间（Unix 时间戳，秒） */
  resetAt: number;
  /** 建议等待时间（毫秒），仅在 allowed=false 时有效 */
  retryAfterMs?: number;
}

/**
 * Rate Limiter Service
 * 使用 Redis 实现滑动窗口算法
 */
export class RateLimiterService {
  private redis: Redis;

  constructor(redis?: Redis) {
    this.redis =
      redis ||
      new Redis(env.REDIS_URL, {
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
  }

  /**
   * 检查是否允许请求
   *
   * @param key - 限流键（例如：'shipping-query:site:123'）
   * @param config - 限流配置
   * @returns 限流结果
   */
  async checkLimit(
    key: string,
    config: RateLimiterConfig
  ): Promise<RateLimiterResult> {
    const now = Date.now();
    const windowStart = now - config.windowSeconds * 1000;
    const redisKey = `rate-limit:${key}`;

    try {
      // 使用 Redis 事务执行滑动窗口算法
      const pipeline = this.redis.pipeline();

      // 1. 移除窗口外的旧记录
      pipeline.zremrangebyscore(redisKey, 0, windowStart);

      // 2. 统计当前窗口内的请求数
      pipeline.zcard(redisKey);

      // 3. 添加当前请求时间戳
      pipeline.zadd(redisKey, now, `${now}`);

      // 4. 设置过期时间（窗口大小 + 1秒）
      pipeline.expire(redisKey, config.windowSeconds + 1);

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      // 获取当前窗口内的请求数（在添加当前请求之前）
      const currentCount = (results[1]?.[1] as number) || 0;

      // 计算剩余请求数
      const remaining = Math.max(0, config.maxRequests - currentCount - 1);

      // 计算窗口重置时间
      const resetAt = Math.ceil((now + config.windowSeconds * 1000) / 1000);

      // 判断是否允许请求
      const allowed = currentCount < config.maxRequests;

      // 如果不允许，计算建议等待时间
      let retryAfterMs: number | undefined;
      if (!allowed) {
        // 获取最早的请求时间戳
        const oldestTimestamps = await this.redis.zrange(redisKey, 0, 0);
        if (oldestTimestamps.length > 0) {
          const oldestTimestamp = parseInt(oldestTimestamps[0] || '0');
          retryAfterMs = Math.max(
            0,
            oldestTimestamp + config.windowSeconds * 1000 - now
          );
        } else {
          retryAfterMs = config.windowSeconds * 1000;
        }

        // 如果超限，移除刚才添加的请求记录
        await this.redis.zrem(redisKey, `${now}`);
      }

      return {
        allowed,
        remaining,
        resetAt,
        retryAfterMs,
      };
    } catch (error) {
      logger.error('rate-limiter', 'Rate limiter check failed', error);

      // 发生错误时，默认允许请求（避免影响业务）
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: Math.ceil((now + config.windowSeconds * 1000) / 1000),
      };
    }
  }

  /**
   * 等待直到允许请求
   *
   * @param key - 限流键
   * @param config - 限流配置
   * @returns 限流结果
   * @throws 如果超过最大等待时间
   */
  async waitForLimit(
    key: string,
    config: RateLimiterConfig
  ): Promise<RateLimiterResult> {
    const maxWaitMs = config.maxWaitMs || 60000; // 默认最大等待 60 秒
    const startTime = Date.now();

    while (true) {
      const result = await this.checkLimit(key, config);

      if (result.allowed) {
        return result;
      }

      // 检查是否超过最大等待时间
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= maxWaitMs) {
        throw new Error(
          `Rate limit exceeded: max wait time ${maxWaitMs}ms reached`
        );
      }

      // 等待建议的时间（最少 100ms）
      const waitMs = Math.max(100, Math.min(result.retryAfterMs || 1000, 5000));
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  /**
   * 重置限流计数器
   *
   * @param key - 限流键
   */
  async reset(key: string): Promise<void> {
    const redisKey = `rate-limit:${key}`;
    await this.redis.del(redisKey);
  }

  /**
   * 获取当前限流状态（不增加计数）
   *
   * @param key - 限流键
   * @param config - 限流配置
   * @returns 限流结果
   */
  async getStatus(
    key: string,
    config: RateLimiterConfig
  ): Promise<RateLimiterResult> {
    const now = Date.now();
    const windowStart = now - config.windowSeconds * 1000;
    const redisKey = `rate-limit:${key}`;

    try {
      // 移除窗口外的旧记录
      await this.redis.zremrangebyscore(redisKey, 0, windowStart);

      // 统计当前窗口内的请求数
      const currentCount = await this.redis.zcard(redisKey);

      // 计算剩余请求数
      const remaining = Math.max(0, config.maxRequests - currentCount);

      // 计算窗口重置时间
      const resetAt = Math.ceil((now + config.windowSeconds * 1000) / 1000);

      // 判断是否允许请求
      const allowed = currentCount < config.maxRequests;

      // 如果不允许，计算建议等待时间
      let retryAfterMs: number | undefined;
      if (!allowed) {
        const oldestTimestamps = await this.redis.zrange(redisKey, 0, 0);
        if (oldestTimestamps.length > 0) {
          const oldestTimestamp = parseInt(oldestTimestamps[0] || '0');
          retryAfterMs = Math.max(
            0,
            oldestTimestamp + config.windowSeconds * 1000 - now
          );
        } else {
          retryAfterMs = config.windowSeconds * 1000;
        }
      }

      return {
        allowed,
        remaining,
        resetAt,
        retryAfterMs,
      };
    } catch (error) {
      logger.error('rate-limiter', 'Get rate limiter status failed', error);

      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: Math.ceil((now + config.windowSeconds * 1000) / 1000),
      };
    }
  }

  /**
   * 关闭 Redis 连接
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * 默认的 Rate Limiter 实例
 */
export const rateLimiter = new RateLimiterService();
