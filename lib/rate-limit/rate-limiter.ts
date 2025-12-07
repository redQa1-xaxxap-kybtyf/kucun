/**
 * 速率限制器核心实现
 * 使用滑动窗口算法实现精确的速率限制
 */

import { logger } from '@/lib/logger';

import type { RateLimitConfig } from './config';
import type { RateLimitStorage } from './storage';

/**
 * 速率限制检查结果
 */
export interface RateLimitResult {
  /** 是否允许请求 */
  allowed: boolean;
  /** 剩余请求数 */
  remaining: number;
  /** 限制重置时间 */
  resetAt: Date;
  /** 当前窗口内的请求数 */
  current: number;
  /** 最大请求数 */
  limit: number;
}

/**
 * 速率限制器类
 * 实现滑动窗口算法，比固定窗口更精确
 */
export class RateLimiter {
  constructor(
    private storage: RateLimitStorage,
    private config: RateLimitConfig
  ) {}

  /**
   * 检查速率限制
   * 核心逻辑：滑动窗口算法
   *
   * @param identifier 唯一标识符（IP地址或用户ID）
   * @returns 速率限制检查结果
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = this.buildKey(identifier);

    try {
      // 1. 清理过期数据（优化存储空间）
      await this.storage.cleanup(key, windowStart);

      // 2. 获取当前窗口内的请求数
      const requests = await this.storage.getRequestsInWindow(
        key,
        windowStart,
        now
      );
      const currentCount = requests.length;

      // 3. 判断是否超过限制
      const allowed = currentCount < this.config.maxRequests;

      // 4. 如果允许，记录本次请求
      if (allowed) {
        await this.storage.addRequest(key, now, this.config.windowMs);
      }

      // 5. 计算剩余请求数
      // 如果本次请求被允许，剩余数需要减1
      const remaining = Math.max(
        0,
        this.config.maxRequests - currentCount - (allowed ? 1 : 0)
      );

      // 6. 计算重置时间（窗口结束时间）
      const resetAt = new Date(now + this.config.windowMs);

      return {
        allowed,
        remaining,
        resetAt,
        current: currentCount,
        limit: this.config.maxRequests,
      };
    } catch (error) {
      logger.error(
        'rate-limit',
        '速率限制检查错误',
        error,
        { key },
        { config: this.config }
      );

      // 发生错误时，为了系统可用性，允许请求通过
      // 但记录错误日志便于排查问题
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: new Date(now + this.config.windowMs),
        current: 0,
        limit: this.config.maxRequests,
      };
    }
  }

  /**
   * 重置指定标识符的速率限制
   * 用于管理员操作或特殊情况
   *
   * @param identifier 唯一标识符
   */
  async reset(identifier: string): Promise<void> {
    const key = this.buildKey(identifier);
    const now = Date.now();

    try {
      // 清理所有请求记录
      await this.storage.cleanup(key, now + this.config.windowMs);
    } catch (error) {
      logger.error('rate-limit', '速率限制重置错误', error, {
        key,
      });
    }
  }

  /**
   * 获取当前限制状态（不记录请求）
   * 用于查询剩余额度
   *
   * @param identifier 唯一标识符
   * @returns 速率限制状态
   */
  async getStatus(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = this.buildKey(identifier);

    try {
      const requests = await this.storage.getRequestsInWindow(
        key,
        windowStart,
        now
      );
      const currentCount = requests.length;
      const allowed = currentCount < this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - currentCount);

      return {
        allowed,
        remaining,
        resetAt: new Date(now + this.config.windowMs),
        current: currentCount,
        limit: this.config.maxRequests,
      };
    } catch (error) {
      logger.error('rate-limit', '速率限制状态获取错误', error, {
        key,
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs),
        current: 0,
        limit: this.config.maxRequests,
      };
    }
  }

  /**
   * 构建存储键
   * 格式：{keyPrefix}:{identifier}
   *
   * @param identifier 唯一标识符
   * @returns 存储键
   */
  private buildKey(identifier: string): string {
    return `${this.config.keyPrefix}:${identifier}`;
  }

  /**
   * 获取配置信息
   * 用于调试和监控
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

/**
 * 创建速率限制器实例
 *
 * @param storage 存储适配器
 * @param config 速率限制配置
 * @returns 速率限制器实例
 */
export function createRateLimiter(
  storage: RateLimitStorage,
  config: RateLimitConfig
): RateLimiter {
  return new RateLimiter(storage, config);
}
