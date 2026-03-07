/**
 * Shipping Query Cache Service
 * 基于 Redis 的运输查询结果缓存服务
 *
 * SOLID-S: 单一职责 - 只负责查询结果缓存
 * DRY: 统一的缓存逻辑
 *
 * 使用场景：
 * - 缓存运输查询结果，减少重复查询
 * - 提升查询响应速度
 * - 降低对目标网站的访问压力
 */

import Redis from 'ioredis';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getRedisAuthOptions } from '@/lib/redis/redis-options';

/**
 * 缓存的查询结果类型（内部使用，日期字段为 Date 对象）
 */
interface CachedQueryResult {
  status?: string;
  destination?: string;
  estimatedArrival?: Date;
  lastUpdateTime?: Date;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 缓存过期时间（秒） */
  ttlSeconds: number;
  /** 缓存键前缀 */
  keyPrefix?: string;
}

/**
 * 默认缓存配置
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlSeconds: 3600, // 1小时
  keyPrefix: 'shipping-query',
};

/**
 * Shipping Query Cache Service
 */
export class ShippingQueryCacheService {
  private redis: Redis;
  private config: CacheConfig;

  constructor(redis?: Redis, config?: Partial<CacheConfig>) {
    this.redis =
      redis ||
      new Redis(env.REDIS_URL, {
        ...getRedisAuthOptions(env.REDIS_URL, env.REDIS_PASSWORD),
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

    this.config = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
    };
  }

  /**
   * 生成缓存键
   *
   * @param siteId - 站点ID
   * @param keyword - 查询关键词（已转换为大写拼音）
   * @returns 缓存键
   */
  private generateCacheKey(siteId: string, keyword: string): string {
    const prefix = this.config.keyPrefix || 'shipping-query';
    // 使用 siteId 和 keyword 生成唯一键
    return `${prefix}:${siteId}:${keyword.toLowerCase()}`;
  }

  /**
   * 获取缓存的查询结果
   *
   * @param siteId - 站点ID
   * @param keyword - 查询关键词
   * @returns 缓存的查询结果，如果不存在则返回 null
   */
  async get(
    siteId: string,
    keyword: string
  ): Promise<CachedQueryResult | null> {
    const cacheKey = this.generateCacheKey(siteId, keyword);

    try {
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        logger.debug('shipping-query-cache', `Cache miss: ${cacheKey}`);
        return null;
      }

      logger.debug('shipping-query-cache', `Cache hit: ${cacheKey}`);

      // 解析 JSON
      const result = JSON.parse(cached) as CachedQueryResult;

      // 转换日期字符串为 Date 对象
      if (result.estimatedArrival) {
        result.estimatedArrival = new Date(result.estimatedArrival);
      }
      if (result.lastUpdateTime) {
        result.lastUpdateTime = new Date(result.lastUpdateTime);
      }

      return result;
    } catch (error) {
      logger.error(
        'shipping-query-cache',
        `Failed to get cache: ${cacheKey}`,
        error
      );
      return null;
    }
  }

  /**
   * 设置缓存的查询结果
   *
   * @param siteId - 站点ID
   * @param keyword - 查询关键词
   * @param result - 查询结果
   * @param ttlSeconds - 缓存过期时间（秒），可选，默认使用配置的 TTL
   */
  async set(
    siteId: string,
    keyword: string,
    result: CachedQueryResult,
    ttlSeconds?: number
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(siteId, keyword);
    const ttl = ttlSeconds || this.config.ttlSeconds;

    try {
      // 序列化为 JSON
      const serialized = JSON.stringify(result);

      // 设置缓存，带过期时间
      await this.redis.setex(cacheKey, ttl, serialized);

      logger.debug(
        'shipping-query-cache',
        `Cache set: ${cacheKey} (TTL: ${ttl}s)`
      );
    } catch (error) {
      logger.error(
        'shipping-query-cache',
        `Failed to set cache: ${cacheKey}`,
        error
      );
      // 缓存失败不影响业务，只记录日志
    }
  }

  /**
   * 删除缓存的查询结果
   *
   * @param siteId - 站点ID
   * @param keyword - 查询关键词
   */
  async delete(siteId: string, keyword: string): Promise<void> {
    const cacheKey = this.generateCacheKey(siteId, keyword);

    try {
      await this.redis.del(cacheKey);
      logger.debug('shipping-query-cache', `Cache deleted: ${cacheKey}`);
    } catch (error) {
      logger.error(
        'shipping-query-cache',
        `Failed to delete cache: ${cacheKey}`,
        error
      );
    }
  }

  /**
   * 清空所有缓存
   *
   * @param pattern - 缓存键模式，默认清空所有运输查询缓存
   */
  async clear(pattern?: string): Promise<void> {
    const prefix = this.config.keyPrefix || 'shipping-query';
    const searchPattern = pattern || `${prefix}:*`;

    try {
      // 使用 SCAN 命令查找所有匹配的键
      const keys: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, foundKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          searchPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
      } while (cursor !== '0');

      // 批量删除
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(
          'shipping-query-cache',
          `Cleared ${keys.length} cache entries`
        );
      } else {
        logger.debug('shipping-query-cache', 'No cache entries to clear');
      }
    } catch (error) {
      logger.error('shipping-query-cache', 'Failed to clear cache', error);
    }
  }

  /**
   * 获取缓存统计信息
   *
   * @returns 缓存统计信息
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
  }> {
    const prefix = this.config.keyPrefix || 'shipping-query';
    const searchPattern = `${prefix}:*`;

    try {
      // 统计键数量
      let totalKeys = 0;
      let cursor = '0';

      do {
        const [nextCursor, foundKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          searchPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        totalKeys += foundKeys.length;
      } while (cursor !== '0');

      // 获取内存使用情况
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1]?.trim() || 'N/A' : 'N/A';

      return {
        totalKeys,
        memoryUsage,
      };
    } catch (error) {
      logger.error('shipping-query-cache', 'Failed to get cache stats', error);
      return {
        totalKeys: 0,
        memoryUsage: 'N/A',
      };
    }
  }

  /**
   * 检查缓存是否存在
   *
   * @param siteId - 站点ID
   * @param keyword - 查询关键词
   * @returns 是否存在缓存
   */
  async exists(siteId: string, keyword: string): Promise<boolean> {
    const cacheKey = this.generateCacheKey(siteId, keyword);

    try {
      const exists = await this.redis.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      logger.error(
        'shipping-query-cache',
        `Failed to check cache existence: ${cacheKey}`,
        error
      );
      return false;
    }
  }

  /**
   * 获取缓存的剩余过期时间
   *
   * @param siteId - 站点ID
   * @param keyword - 查询关键词
   * @returns 剩余过期时间（秒），如果不存在则返回 -1
   */
  async getTTL(siteId: string, keyword: string): Promise<number> {
    const cacheKey = this.generateCacheKey(siteId, keyword);

    try {
      const ttl = await this.redis.ttl(cacheKey);
      return ttl;
    } catch (error) {
      logger.error(
        'shipping-query-cache',
        `Failed to get cache TTL: ${cacheKey}`,
        error
      );
      return -1;
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
 * 默认的缓存服务实例
 */
export const shippingQueryCache = new ShippingQueryCacheService();
