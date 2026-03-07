/**
 * BullMQ 队列配置
 * 用于异步处理入库后处理任务
 */

import type { QueueOptions, WorkerOptions } from 'bullmq';
import Redis from 'ioredis';

import { env } from '@/lib/env';
import { getRedisAuthOptions } from '@/lib/redis/redis-options';

let redisConnection: Redis | null = null;

function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    ...getRedisAuthOptions(env.REDIS_URL, env.REDIS_PASSWORD),
    maxRetriesPerRequest: null, // BullMQ 要求设置为 null
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });
}

/**
 * Redis 连接配置（懒加载）
 * 避免模块导入时立即建立连接，减少构建阶段副作用
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = createRedisConnection();
  }
  return redisConnection;
}

export function closeRedisConnection(): void {
  if (!redisConnection) {
    return;
  }
  redisConnection.disconnect();
  redisConnection = null;
}

/**
 * 队列默认配置
 */
export function getDefaultQueueConfig(): QueueOptions {
  return {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3, // 失败重试3次
      backoff: {
        type: 'exponential',
        delay: 2000, // 初始延迟 2 秒
      },
      removeOnComplete: {
        age: 24 * 3600, // 保留完成的任务 24 小时
        count: 1000, // 最多保留 1000 个完成的任务
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // 保留失败的任务 7 天
      },
    },
  };
}

export const defaultQueueConfig: QueueOptions = {
  get connection() {
    return getRedisConnection();
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
};

/**
 * Worker 默认配置
 */
export function getDefaultWorkerConfig(): WorkerOptions {
  return {
    connection: getRedisConnection(),
    concurrency: 10, // 并发处理 10 个任务
    limiter: {
      max: 50, // 每个时间窗口最多处理 50 个任务
      duration: 1000, // 时间窗口 1 秒
    },
    autorun: true,
  };
}

export const defaultWorkerConfig: WorkerOptions = {
  get connection() {
    return getRedisConnection();
  },
  concurrency: 10,
  limiter: {
    max: 50,
    duration: 1000,
  },
  autorun: true,
};

/**
 * 队列名称常量
 */
export const QUEUE_NAMES = {
  INBOUND_POST_PROCESSING: 'inbound-post-processing',
  OUTBOUND_POST_PROCESSING: 'outbound-post-processing',
  ADJUSTMENT_POST_PROCESSING: 'adjustment-post-processing',
  SHIPPING_QUERY: 'shipping-query',
} as const;

/**
 * 任务类型常量
 */
export const JOB_TYPES = {
  BATCH_SPECIFICATION_SYNC: 'batch-specification-sync',
  PRODUCT_SPECIFICATION_SYNC: 'product-specification-sync',
  CACHE_INVALIDATION: 'cache-invalidation',
  WEBSOCKET_NOTIFICATION: 'websocket-notification',
} as const;
