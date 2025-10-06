/**
 * Redis Pub/Sub 模块
 * 用于实现分布式缓存失效通知和实时消息传递
 * 遵循 Redis 8.0.3 最佳实践
 */

import type Redis from 'ioredis';

import { env } from '@/lib/env';
import { redis } from './redis-client';

/**
 * 订阅回调函数类型
 */
export type SubscribeCallback = (message: string, channel: string) => void;

/**
 * 模式订阅回调函数类型
 */
export type PSubscribeCallback = (
  message: string,
  channel: string,
  pattern: string
) => void;

/**
 * 订阅者管理器
 * 维护所有订阅连接和回调函数
 */
class SubscriberManager {
  private subscribers: Map<string, Redis> = new Map();
  private callbacks: Map<string, Set<SubscribeCallback>> = new Map();
  private patternCallbacks: Map<string, Set<PSubscribeCallback>> = new Map();

  /**
   * 获取或创建订阅者连接
   * 每个频道使用独立的连接，避免阻塞
   */
  private getOrCreateSubscriber(channel: string): Redis {
    let subscriber = this.subscribers.get(channel);

    if (!subscriber) {
      // 使用 duplicate() 创建独立连接
      subscriber = redis.getClient().duplicate();

      // 错误处理
      subscriber.on('error', (err: unknown) => {
        if (env.NODE_ENV === 'development') {
          console.error(
            `[Redis Pub/Sub] Subscriber error for ${channel}:`,
            err
          );
        }
      });

      // 重连处理
      subscriber.on('reconnecting', () => {
        if (env.NODE_ENV === 'development') {
          console.log(
            `[Redis Pub/Sub] Reconnecting subscriber for ${channel}...`
          );
        }
      });

      // 连接成功
      subscriber.on('connect', () => {
        if (env.NODE_ENV === 'development') {
          console.log(`[Redis Pub/Sub] Subscriber connected for ${channel}`);
        }
      });

      this.subscribers.set(channel, subscriber);
    }

    return subscriber;
  }

  /**
   * 订阅指定频道
   * @param channel - 频道名称
   * @param callback - 消息回调函数
   */
  async subscribe(channel: string, callback: SubscribeCallback): Promise<void> {
    try {
      // 获取或创建订阅者
      const subscriber = this.getOrCreateSubscriber(channel);

      // 添加回调函数
      if (!this.callbacks.has(channel)) {
        this.callbacks.set(channel, new Set());
      }
      this.callbacks.get(channel)!.add(callback);

      // 如果是第一次订阅，设置消息监听器
      if (this.callbacks.get(channel)!.size === 1) {
        subscriber.on('message', (ch: string, message: string) => {
          if (ch === channel) {
            const callbacks = this.callbacks.get(channel);
            if (callbacks) {
              callbacks.forEach(cb => {
                try {
                  cb(message, channel);
                } catch (error) {
                  console.error(
                    `[Redis Pub/Sub] Callback error for ${channel}:`,
                    error
                  );
                }
              });
            }
          }
        });

        // 订阅频道
        await subscriber.subscribe(channel);

        if (env.NODE_ENV === 'development') {
          console.log(`[Redis Pub/Sub] Subscribed to channel: ${channel}`);
        }
      }
    } catch (error) {
      console.error(
        `[Redis Pub/Sub] Failed to subscribe to ${channel}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 取消订阅指定频道
   * @param channel - 频道名称
   * @param callback - 可选的回调函数，如果提供则只移除该回调
   */
  async unsubscribe(
    channel: string,
    callback?: SubscribeCallback
  ): Promise<void> {
    try {
      const callbacks = this.callbacks.get(channel);
      if (!callbacks) {
        return; // 没有订阅该频道
      }

      if (callback) {
        // 只移除指定的回调
        callbacks.delete(callback);
      } else {
        // 移除所有回调
        callbacks.clear();
      }

      // 如果没有回调了，取消订阅
      if (callbacks.size === 0) {
        const subscriber = this.subscribers.get(channel);
        if (subscriber) {
          await subscriber.unsubscribe(channel);
          await subscriber.quit();
          this.subscribers.delete(channel);
          this.callbacks.delete(channel);

          if (env.NODE_ENV === 'development') {
            console.log(
              `[Redis Pub/Sub] Unsubscribed from channel: ${channel}`
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `[Redis Pub/Sub] Failed to unsubscribe from ${channel}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 模式订阅（支持通配符）
   * @param pattern - 频道模式（如 'cache:*'）
   * @param callback - 消息回调函数
   */
  async psubscribe(
    pattern: string,
    callback: PSubscribeCallback
  ): Promise<void> {
    try {
      // 获取或创建订阅者
      const subscriber = this.getOrCreateSubscriber(`pattern:${pattern}`);

      // 添加回调函数
      if (!this.patternCallbacks.has(pattern)) {
        this.patternCallbacks.set(pattern, new Set());
      }
      this.patternCallbacks.get(pattern)!.add(callback);

      // 如果是第一次订阅，设置消息监听器
      if (this.patternCallbacks.get(pattern)!.size === 1) {
        subscriber.on(
          'pmessage',
          (pat: string, ch: string, message: string) => {
            if (pat === pattern) {
              const callbacks = this.patternCallbacks.get(pattern);
              if (callbacks) {
                callbacks.forEach(cb => {
                  try {
                    cb(message, ch, pattern);
                  } catch (error) {
                    console.error(
                      `[Redis Pub/Sub] Pattern callback error for ${pattern}:`,
                      error
                    );
                  }
                });
              }
            }
          }
        );

        // 订阅模式
        await subscriber.psubscribe(pattern);

        if (env.NODE_ENV === 'development') {
          console.log(`[Redis Pub/Sub] Subscribed to pattern: ${pattern}`);
        }
      }
    } catch (error) {
      console.error(
        `[Redis Pub/Sub] Failed to psubscribe to ${pattern}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 取消模式订阅
   * @param pattern - 频道模式
   * @param callback - 可选的回调函数
   */
  async punsubscribe(
    pattern: string,
    callback?: PSubscribeCallback
  ): Promise<void> {
    try {
      const callbacks = this.patternCallbacks.get(pattern);
      if (!callbacks) {
        return;
      }

      if (callback) {
        callbacks.delete(callback);
      } else {
        callbacks.clear();
      }

      if (callbacks.size === 0) {
        const subscriber = this.subscribers.get(`pattern:${pattern}`);
        if (subscriber) {
          await subscriber.punsubscribe(pattern);
          await subscriber.quit();
          this.subscribers.delete(`pattern:${pattern}`);
          this.patternCallbacks.delete(pattern);

          if (env.NODE_ENV === 'development') {
            console.log(
              `[Redis Pub/Sub] Unsubscribed from pattern: ${pattern}`
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `[Redis Pub/Sub] Failed to punsubscribe from ${pattern}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 清理所有订阅
   */
  async cleanup(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [channel, subscriber] of this.subscribers.entries()) {
      promises.push(
        subscriber
          .quit()
          .then(() => {
            // 成功退出
          })
          .catch(err => {
            console.error(
              `[Redis Pub/Sub] Failed to quit subscriber for ${channel}:`,
              err
            );
          })
      );
    }

    await Promise.all(promises);

    this.subscribers.clear();
    this.callbacks.clear();
    this.patternCallbacks.clear();

    if (env.NODE_ENV === 'development') {
      console.log('[Redis Pub/Sub] All subscribers cleaned up');
    }
  }
}

// 全局订阅者管理器实例
const subscriberManager = new SubscriberManager();

/**
 * 发布消息到指定频道
 * @param channel - 频道名称
 * @param message - 消息内容（字符串或对象）
 * @returns 接收到消息的订阅者数量
 */
export async function publish(
  channel: string,
  message: string | object
): Promise<number> {
  try {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);
    const client = redis.getClient();
    const count = await client.publish(channel, payload);

    if (env.NODE_ENV === 'development') {
      console.log(
        `[Redis Pub/Sub] Published to ${channel}, ${count} subscribers received`
      );
    }

    return count;
  } catch (error) {
    console.error(`[Redis Pub/Sub] Failed to publish to ${channel}:`, error);
    throw error;
  }
}

/**
 * 订阅指定频道
 * @param channel - 频道名称
 * @param callback - 消息回调函数
 */
export async function subscribe(
  channel: string,
  callback: SubscribeCallback
): Promise<void> {
  return subscriberManager.subscribe(channel, callback);
}

/**
 * 取消订阅指定频道
 * @param channel - 频道名称
 * @param callback - 可选的回调函数
 */
export async function unsubscribe(
  channel: string,
  callback?: SubscribeCallback
): Promise<void> {
  return subscriberManager.unsubscribe(channel, callback);
}

/**
 * 模式订阅（支持通配符）
 * @param pattern - 频道模式（如 'cache:*'）
 * @param callback - 消息回调函数
 */
export async function psubscribe(
  pattern: string,
  callback: PSubscribeCallback
): Promise<void> {
  return subscriberManager.psubscribe(pattern, callback);
}

/**
 * 取消模式订阅
 * @param pattern - 频道模式
 * @param callback - 可选的回调函数
 */
export async function punsubscribe(
  pattern: string,
  callback?: PSubscribeCallback
): Promise<void> {
  return subscriberManager.punsubscribe(pattern, callback);
}

/**
 * 清理所有订阅（用于应用关闭时）
 */
export async function cleanup(): Promise<void> {
  return subscriberManager.cleanup();
}

// 监听进程退出事件，清理订阅
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    cleanup().catch(console.error);
  });
  process.on('SIGINT', () => {
    cleanup().catch(console.error);
  });
}
