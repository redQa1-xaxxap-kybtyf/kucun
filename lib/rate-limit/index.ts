/**
 * 速率限制模块主入口
 * 提供统一的速率限制器实例管理
 */

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

import { getRateLimitConfig, type RateLimitType } from './config';
import { createRateLimiter, type RateLimiter } from './rate-limiter';
import { createRateLimitStorage, type RateLimitStorage } from './storage';

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
 * 速率限制器实例缓存
 * 每种类型只创建一个实例
 */
const rateLimiterCache = new Map<RateLimitType, RateLimiter>();

/**
 * 存储适配器实例（单例）
 */
let storageInstance: RateLimitStorage | null = null;

/**
 * 获取存储适配器实例
 * 优先使用 Redis，失败时降级到内存存储
 *
 * @returns 存储适配器实例
 */
function getStorage(): RateLimitStorage {
  if (storageInstance) {
    return storageInstance;
  }

  try {
    // 尝试使用 Redis 存储
    const redisClient = redis.getClient();
    storageInstance = createRateLimitStorage(redisClient);

    if (env.NODE_ENV === 'development') {
      logger.info('rate-limit', '已初始化 Redis 存储适配器');
    }
  } catch (error) {
    // Redis 不可用，降级到内存存储
    if (env.NODE_ENV === 'development') {
      logger.warn('rate-limit', 'Redis 不可用，使用内存存储', undefined, {
        error: serializeError(error),
      });
    }
    storageInstance = createRateLimitStorage();
  }

  return storageInstance;
}

/**
 * 获取速率限制器实例
 * 单例模式，每种类型只创建一个实例
 *
 * @param type 速率限制类型
 * @returns 速率限制器实例
 */
export function getRateLimiter(type: RateLimitType): RateLimiter {
  // 从缓存获取
  let limiter = rateLimiterCache.get(type);

  if (limiter) {
    return limiter;
  }

  // 创建新实例
  const storage = getStorage();
  const config = getRateLimitConfig(type);
  limiter = createRateLimiter(storage, config);

  // 缓存实例
  rateLimiterCache.set(type, limiter);

  if (env.NODE_ENV === 'development') {
    logger.info('rate-limit', `已创建速率限制器: ${type}`, {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
    });
  }

  return limiter;
}

/**
 * 重置所有速率限制器缓存
 * 用于测试或重新配置场景
 */
export function resetRateLimiters(): void {
  rateLimiterCache.clear();
  storageInstance = null;

  if (env.NODE_ENV === 'development') {
    logger.info('rate-limit', '已重置所有速率限制器');
  }
}

/**
 * 获取所有速率限制器的统计信息
 * 用于监控和调试
 *
 * @returns 统计信息
 */
export function getRateLimitStats() {
  const stats = {
    types: Array.from(rateLimiterCache.keys()),
    count: rateLimiterCache.size,
    configs: Array.from(rateLimiterCache.entries()).map(([type, limiter]) => ({
      type,
      config: limiter.getConfig(),
    })),
  };

  return stats;
}

// 导出所有公共接口
export * from './config';
export * from './rate-limiter';
export * from './storage';
export * from './middleware';
