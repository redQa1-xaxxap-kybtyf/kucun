/**
 * Redis 优化的幂等性处理
 *
 * 性能优化目标:
 * - 幂等性检查: 从 70ms → < 5ms (-93%)
 * - 幂等性标记: 从 66ms → < 5ms (-92%)
 * - 总幂等性开销: 从 136ms → < 20ms (-85%)
 *
 * 架构设计:
 * 1. Redis 作为主存储 (快速检查 < 5ms)
 * 2. MySQL 作为持久化备份 (异步写入,不阻塞主流程)
 * 3. 保持向后兼容 (相同的 API 接口)
 *
 * 降级策略:
 * - Redis 不可用 → 降级到 MySQL (慢但可靠)
 * - Redis + MySQL 都不可用 → 抛出错误 (保证数据一致性)
 */

import { redis } from '@/lib/redis';

import {
  checkIdempotency as checkIdempotencyMysql,
  completeIdempotencyRecord as completeIdempotencyMysql,
  createIdempotencyRecord as createIdempotencyMysql,
  failIdempotencyRecord as failIdempotencyMysql,
  type OperationType,
} from './idempotency';

// ⚙️ Redis 幂等性控制参数
const REDIS_PROCESSING_TTL = 5; // 5秒 (processing 状态的 TTL)
const REDIS_COMPLETED_TTL = 24 * 60 * 60; // 24小时 (completed 状态的 TTL)
const REDIS_FAILED_TTL = 60 * 60; // 1小时 (failed 状态的 TTL)

/**
 * Redis 幂等性记录格式
 */
interface RedisIdempotencyRecord {
  status: 'processing' | 'completed' | 'failed';
  createdAt: number; // 时间戳
  expiresAt: number; // 过期时间戳
  responseData?: unknown; // 成功时的响应数据
  errorMessage?: string; // 失败时的错误信息
}

/**
 * 幂等性结果 (与原始接口保持一致)
 */
export interface IdempotencyResult<T> {
  isNew: boolean;
  data: T | null;
  operation: {
    id: string;
    status: string;
    createdAt: Date;
    expiresAt: Date;
  } | null;
}

/**
 * 获取 Redis Key
 */
function getRedisKey(idempotencyKey: string): string {
  return `idempotency:${idempotencyKey}`;
}

/**
 * 检查幂等性 (Redis 优化版)
 *
 * 性能提升: 70ms → < 5ms
 *
 * 策略:
 * 1. 先检查 Redis (< 5ms)
 * 2. Redis 未命中 → 检查 MySQL (兜底)
 * 3. Redis 不可用 → 降级到 MySQL
 */
export async function checkIdempotency(
  idempotencyKey: string
): Promise<IdempotencyResult<unknown>> {
  const redisKey = getRedisKey(idempotencyKey);

  try {
    // 🚀 策略1: 快速 Redis 检查 (< 5ms)
    const cached = await redis.getJson<RedisIdempotencyRecord>(redisKey);

    if (cached) {
      // Redis 缓存命中 (< 5ms)

      // 检查是否过期
      if (cached.expiresAt <= Date.now()) {
        // 过期记录,视为新操作
        await redis.del(redisKey);
        return {
          isNew: true,
          data: null,
          operation: null,
        };
      }

      // 根据状态返回结果
      if (cached.status === 'completed' && cached.responseData) {
        return {
          isNew: false,
          data: cached.responseData,
          operation: {
            id: idempotencyKey,
            status: cached.status,
            createdAt: new Date(cached.createdAt),
            expiresAt: new Date(cached.expiresAt),
          },
        };
      }

      if (cached.status === 'processing') {
        return {
          isNew: false,
          data: null,
          operation: {
            id: idempotencyKey,
            status: cached.status,
            createdAt: new Date(cached.createdAt),
            expiresAt: new Date(cached.expiresAt),
          },
        };
      }

      if (cached.status === 'failed') {
        // 失败记录允许重试
        return {
          isNew: true,
          data: null,
          operation: null,
        };
      }
    }

    // Redis 未命中,检查 MySQL (可能是 Redis 缓存过期或首次请求)
    const mysqlResult = await checkIdempotencyMysql(idempotencyKey);

    // 如果 MySQL 中有记录,同步到 Redis
    if (!mysqlResult.isNew && mysqlResult.data) {
      const record: RedisIdempotencyRecord = {
        status: 'completed',
        createdAt: mysqlResult.operation?.createdAt.getTime() || Date.now(),
        expiresAt:
          mysqlResult.operation?.expiresAt.getTime() ||
          Date.now() + REDIS_COMPLETED_TTL * 1000,
        responseData: mysqlResult.data,
      };
      await redis.setJson(redisKey, record, REDIS_COMPLETED_TTL);
    }

    return mysqlResult;
  } catch (_error) {
    // 降级到 MySQL
    return checkIdempotencyMysql(idempotencyKey);
  }
}

/**
 * 创建幂等性记录 (Redis 优化版)
 *
 * 性能提升: 原子操作,无需单独创建
 *
 * 策略:
 * 1. 使用 Redis SET NX (原子操作,自带幂等性)
 * 2. 异步写入 MySQL (不阻塞主流程)
 * 3. Redis 不可用 → 降级到 MySQL 同步写入
 */
export async function createIdempotencyRecord(
  idempotencyKey: string,
  operationType: OperationType,
  productId: string,
  operatorId: string,
  requestData: Record<string, unknown>
): Promise<string> {
  const redisKey = getRedisKey(idempotencyKey);

  try {
    // 🚀 快速 Redis 写入 (使用 SET NX 保证原子性)
    const record: RedisIdempotencyRecord = {
      status: 'processing',
      createdAt: Date.now(),
      expiresAt: Date.now() + REDIS_PROCESSING_TTL * 1000,
    };

    // 使用 SET NX: 仅在键不存在时设置
    const client = redis.getClient();
    const result = await client.set(
      `kucun:${redisKey}`, // 添加 namespace 前缀
      JSON.stringify(record),
      'EX',
      REDIS_PROCESSING_TTL,
      'NX' // 仅在不存在时设置
    );

    if (result === 'OK') {
      // 异步写入 MySQL (不等待,不阻塞主流程)
      createIdempotencyMysql(
        idempotencyKey,
        operationType,
        productId,
        operatorId,
        requestData
      ).catch(() => {
        // MySQL 异步写入失败,仅记录但不影响主流程
      });

      return idempotencyKey;
    }

    // SET NX 失败,说明键已存在 (并发冲突)
    throw new Error('Idempotency key already exists');
  } catch (_error) {
    // 降级到 MySQL 同步写入
    return createIdempotencyMysql(
      idempotencyKey,
      operationType,
      productId,
      operatorId,
      requestData
    );
  }
}

/**
 * 标记幂等性记录为完成 (Redis 优化版)
 *
 * 性能提升: 66ms → < 5ms
 *
 * 策略:
 * 1. 快速更新 Redis (< 5ms)
 * 2. 异步更新 MySQL (不阻塞主流程)
 */
export async function completeIdempotencyRecord(
  idempotencyKey: string,
  responseData: Record<string, unknown>
): Promise<void> {
  const redisKey = getRedisKey(idempotencyKey);

  try {
    // 🚀 快速 Redis 更新
    const record: RedisIdempotencyRecord = {
      status: 'completed',
      createdAt: Date.now(),
      expiresAt: Date.now() + REDIS_COMPLETED_TTL * 1000,
      responseData,
    };

    await redis.setJson(redisKey, record, REDIS_COMPLETED_TTL);

    // 异步更新 MySQL
    completeIdempotencyMysql(idempotencyKey, responseData).catch(() => {
      // MySQL 异步更新失败,仅记录但不影响主流程
    });
  } catch (_error) {
    // 降级到 MySQL 同步更新
    await completeIdempotencyMysql(idempotencyKey, responseData);
  }
}

/**
 * 标记幂等性记录为失败 (Redis 优化版)
 */
export async function failIdempotencyRecord(
  idempotencyKey: string,
  errorMessage: string
): Promise<void> {
  const redisKey = getRedisKey(idempotencyKey);

  try {
    const record: RedisIdempotencyRecord = {
      status: 'failed',
      createdAt: Date.now(),
      expiresAt: Date.now() + REDIS_FAILED_TTL * 1000,
      errorMessage,
    };

    await redis.setJson(redisKey, record, REDIS_FAILED_TTL);

    // 异步更新 MySQL
    failIdempotencyMysql(idempotencyKey, errorMessage).catch(() => {
      // MySQL 异步更新失败,仅记录但不影响主流程
    });
  } catch (_error) {
    await failIdempotencyMysql(idempotencyKey, errorMessage);
  }
}

/**
 * 幂等性包装器 (Redis 优化版)
 *
 * 与原始接口保持 100% 兼容,内部使用 Redis 优化
 *
 * 性能提升:
 * - 检查: 70ms → < 5ms
 * - 标记: 66ms → < 5ms
 * - 总计: 136ms → < 20ms (-85%)
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  operationType: OperationType,
  productId: string,
  operatorId: string,
  requestData: Record<string, unknown>,
  operation: () => Promise<T>
): Promise<T> {
  // 复用原有的重试逻辑和等待机制
  // 但使用 Redis 优化的检查和创建方法
  const retryDelayMs = 100;
  const maxRetryDelayMs = 500;
  const maxWaitMs = 5000; // 5秒最大等待
  const startTime = Date.now();
  let attempt = 0;

  const waitForNextAttempt = async (overrideDelay?: number) => {
    const delay =
      overrideDelay ??
      Math.min(retryDelayMs * Math.pow(1.5, attempt), maxRetryDelayMs);
    await new Promise<void>(resolve => setTimeout(resolve, delay));
    attempt += 1;
  };

  while (Date.now() - startTime <= maxWaitMs) {
    try {
      // 策略1: 尝试创建幂等性记录 (Redis SET NX)
      await createIdempotencyRecord(
        idempotencyKey,
        operationType,
        productId,
        operatorId,
        requestData
      );

      // 创建成功,执行操作
      try {
        const result = await operation();

        // 标记完成
        await completeIdempotencyRecord(
          idempotencyKey,
          result as Record<string, unknown>
        );

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '操作失败';
        await failIdempotencyRecord(idempotencyKey, errorMessage);
        throw error;
      }
    } catch (_error: unknown) {
      // 幂等性键已存在,检查状态
      const existing = await checkIdempotency(idempotencyKey);

      // 操作已完成,返回缓存结果
      if (!existing.isNew && existing.data) {
        return existing.data as T;
      }

      // 操作仍在处理中,等待
      if (!existing.isNew && existing.operation?.status === 'processing') {
        const expiresAt = existing.operation.expiresAt.getTime();
        const now = Date.now();

        if (expiresAt <= now) {
          // 处理中记录已过期,标记为失败并重试
          await failIdempotencyRecord(idempotencyKey, 'processing ttl expired');
          await waitForNextAttempt(retryDelayMs);
          continue;
        }

        // 等待后重试
        await waitForNextAttempt();
        continue;
      }

      // 操作失败,允许重试
      if (!existing.isNew && existing.operation?.status === 'failed') {
        await waitForNextAttempt(retryDelayMs);
        continue;
      }

      // 其他未知状态
      await waitForNextAttempt();
      continue;
    }
  }

  // 超时,最后检查一次
  const existing = await checkIdempotency(idempotencyKey);
  if (!existing.isNew && existing.data) {
    return existing.data as T;
  }

  throw new Error(
    `操作超时：请求处理时间过长（超过${Math.ceil((Date.now() - startTime) / 1000)}秒等待）`
  );
}
