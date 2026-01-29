/**
 * 幂等性处理工具
 * 防止重复操作,确保操作的幂等性
 */

import { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';

// cspell:ignore MEDIUMTEXT

export type OperationType =
  | 'inbound'
  | 'outbound'
  | 'adjust'
  | 'return_order_status_change'
  | 'factory_shipment_status_change'
  | 'sales_order_create'
  | 'sales_order_update'
  | 'sales_order_status_change'
  | 'purchase_order_status_change'
  | 'payment_out_create';

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

const DEFAULT_ENTITY_TYPE_BY_OPERATION: Record<OperationType, string> = {
  inbound: 'product',
  outbound: 'product',
  adjust: 'product',
  return_order_status_change: 'return_order',
  factory_shipment_status_change: 'factory_shipment',
  sales_order_create: 'sales_order',
  sales_order_update: 'sales_order',
  sales_order_status_change: 'sales_order',
  purchase_order_status_change: 'purchase_order',
  payment_out_create: 'payment_out',
};

const resolveEntityType = (operationType: OperationType, override?: string) =>
  override ?? DEFAULT_ENTITY_TYPE_BY_OPERATION[operationType] ?? 'generic';

// ⚙️ 幂等性控制参数
// 结合最小化事务 (≈200-500ms) 后, 正常入库应在 < 1秒 完成。
// ⚠️ 厂家发货状态更新需要创建应收账款和应付账款，可能需要较长时间
// ⚠️ 尤其是在有多个供应商的情况下，需要为每个供应商生成应付账款记录
const MAX_PROCESSING_DURATION_MS = 25_000; // 单次操作允许的最大处理时长（增加到25秒）
const MAX_WAIT_FOR_EXISTING_OPERATION_MS = 30_000; // 并发等待的最大时长（增加到30秒）
const PROCESSING_RECORD_TTL_MS = MAX_PROCESSING_DURATION_MS + 5_000; // processing 记录的生命周期 (额外缓冲 5s)
const COMPLETED_RECORD_TTL_MS = 24 * 60 * 60 * 1_000; // completed 保留 24 小时, 支持客户端重放
const FAILED_RECORD_TTL_MS = 60 * 60 * 1_000; // failed 保留 1 小时, 方便排查

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const isIdempotencyKeyUniqueConstraintError = (
  error: Prisma.PrismaClientKnownRequestError
) => {
  if (error.code !== 'P2002') return false;

  const target = (error.meta as { target?: unknown } | undefined)?.target;

  if (Array.isArray(target)) {
    return target.some(
      item =>
        typeof item === 'string' &&
        /idempotency(_key)?|idempotencyKey/i.test(item)
    );
  }

  if (typeof target === 'string') {
    return /idempotency(_key)?|idempotencyKey/i.test(target);
  }

  return /inventory_operations_idempotency_key_key|idempotency(_key)?/i.test(
    error.message
  );
};

/**
 * 检查幂等性键是否已存在
 * @param idempotencyKey 幂等性键
 * @returns 如果存在返回操作记录,否则返回null
 */
export async function checkIdempotency(
  idempotencyKey: string
): Promise<IdempotencyResult<unknown>> {
  const operation = await prisma.inventoryOperation.findUnique({
    where: { idempotencyKey },
  });

  if (!operation) {
    return {
      isNew: true,
      data: null,
      operation: null,
    };
  }

  // 如果操作正在处理中,返回处理中状态
  if (operation.status === 'processing') {
    return {
      isNew: false,
      data: null,
      operation: {
        id: operation.id,
        status: operation.status,
        createdAt: operation.createdAt,
        expiresAt: operation.expiresAt,
      },
    };
  }

  // 如果操作已完成,返回之前的结果
  if (operation.status === 'completed' && operation.responseData) {
    try {
      const data = JSON.parse(operation.responseData);
      return {
        isNew: false,
        data,
        operation: {
          id: operation.id,
          status: operation.status,
          createdAt: operation.createdAt,
          expiresAt: operation.expiresAt,
        },
      };
    } catch {
      // JSON解析失败,视为新操作
      return {
        isNew: true,
        data: null,
        operation: null,
      };
    }
  }

  // 如果操作失败,允许重试
  // ✅ 修复：返回 isNew=false 且带上 operation 状态，便于上层逻辑识别并清理失败记录
  if (operation.status === 'failed') {
    return {
      isNew: false,
      data: null,
      operation: {
        id: operation.id,
        status: operation.status,
        createdAt: operation.createdAt,
        expiresAt: operation.expiresAt,
      },
    };
  }

  return {
    isNew: true,
    data: null,
    operation: null,
  };
}

/**
 * 创建幂等性记录
 * @param idempotencyKey 幂等性键
 * @param operationType 操作类型
 * @param entityId 关联实体ID（不再强绑定到产品）
 * @param operatorId 操作人ID
 * @param requestData 请求数据
 * @param options 可选参数
 * @returns 操作记录ID
 */
export async function createIdempotencyRecord(
  idempotencyKey: string,
  operationType: OperationType,
  entityId: string,
  operatorId: string,
  requestData: Record<string, unknown>,
  options?: { entityType?: string }
): Promise<string> {
  const expiresAt = new Date(Date.now() + PROCESSING_RECORD_TTL_MS);

  const entityType = resolveEntityType(operationType, options?.entityType);

  const operation = await prisma.inventoryOperation.create({
    data: {
      idempotencyKey,
      operationType,
      entityType,
      entityId,
      operatorId,
      status: 'processing',
      requestData: JSON.stringify(requestData),
      expiresAt,
    },
  });

  return operation.id;
}

/**
 * 更新幂等性记录为完成状态
 * @param idempotencyKey 幂等性键
 * @param responseData 响应数据
 */
export async function completeIdempotencyRecord(
  idempotencyKey: string,
  responseData: Record<string, unknown>
): Promise<void> {
  await prisma.inventoryOperation.update({
    where: { idempotencyKey },
    data: {
      status: 'completed',
      responseData: JSON.stringify(responseData),
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + COMPLETED_RECORD_TTL_MS),
    },
  });
}

/**
 * 更新幂等性记录为失败状态
 * @param idempotencyKey 幂等性键
 * @param errorMessage 错误信息
 */
export async function failIdempotencyRecord(
  idempotencyKey: string,
  errorMessage: string
): Promise<void> {
  await prisma.inventoryOperation.update({
    where: { idempotencyKey },
    data: {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + FAILED_RECORD_TTL_MS),
    },
  });
}

/**
 * 清理过期的幂等性记录
 * 应该通过定时任务定期调用
 */
export async function cleanupExpiredIdempotencyRecords(): Promise<number> {
  const result = await prisma.inventoryOperation.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * 幂等性包装器
 * 自动处理幂等性检查和记录
 *
 * 实现说明：
 * - 使用乐观锁策略（先创建后检查）避免检查-创建竞态条件
 * - 当检测到并发请求时，实现轮询等待机制而非直接抛出错误
 * - 添加重试计数和超时保护，防止无限等待
 * - 利用数据库唯一约束保证原子性
 * - 存储完整的请求和响应数据（遵循行业最佳实践）
 * - 使用MEDIUMTEXT字段类型(16MB)确保足够的存储空间
 */
/* eslint-disable-next-line max-lines-per-function */
export async function withIdempotency<T>(
  idempotencyKey: string,
  operationType: OperationType,
  entityId: string,
  operatorId: string,
  requestData: Record<string, unknown>,
  operation: () => Promise<T>,
  options?: { entityType?: string }
): Promise<T> {
  const retryDelayMs = 100; // 初始重试延迟(毫秒)
  const maxRetryDelayMs = 500; // 最大重试延迟(毫秒)
  const maxWaitMs = MAX_WAIT_FOR_EXISTING_OPERATION_MS;
  const startTime = Date.now();
  let attempt = 0;

  const waitForNextAttempt = async (overrideDelay?: number) => {
    const delay =
      overrideDelay ??
      Math.min(retryDelayMs * Math.pow(1.5, attempt), maxRetryDelayMs);
    await sleep(delay);
    attempt += 1;
  };

  while (Date.now() - startTime <= maxWaitMs) {
    try {
      const entityType = resolveEntityType(operationType, options?.entityType);

      // 策略1：乐观锁 - 先尝试创建记录
      // 优点：在无并发时性能最优，避免了先检查后创建的竞态窗口
      // 如果创建成功，说明是第一个请求，直接执行操作
      await prisma.inventoryOperation.create({
        data: {
          idempotencyKey,
          operationType,
          entityType,
          entityId,
          operatorId,
          status: 'processing',
          requestData: JSON.stringify(requestData),
          expiresAt: new Date(Date.now() + PROCESSING_RECORD_TTL_MS), // 使用常量定义的过期时间
        },
      });

      // 创建成功，说明这是第一个请求，执行实际操作
      try {
        const result = await operation();

        // 操作成功，标记为完成
        await completeIdempotencyRecord(
          idempotencyKey,
          result as Record<string, unknown>
        );

        return result;
      } catch (error) {
        // 操作失败，标记为失败状态
        const errorMessage =
          error instanceof Error ? error.message : '操作失败';
        await failIdempotencyRecord(idempotencyKey, errorMessage);
        throw error;
      }
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (!isIdempotencyKeyUniqueConstraintError(error)) {
          throw error;
        }

        // 策略2：处理唯一约束冲突 - 说明已有其他请求在处理
        // Prisma唯一约束错误码: P2002
        // 查询现有记录的状态
        const existing = await checkIdempotency(idempotencyKey);

        // 情况1：操作已完成，直接返回之前的结果
        if (!existing.isNew && existing.data) {
          return existing.data as T;
        }

        // 情况2：操作仍在处理中，等待后重试
        if (!existing.isNew && existing.operation?.status === 'processing') {
          const createdAt = existing.operation.createdAt;
          const expiresAt = existing.operation.expiresAt.getTime();
          const now = Date.now();

          const isExpiredByTtl = expiresAt <= now;

          if (
            createdAt &&
            now - createdAt.getTime() > MAX_PROCESSING_DURATION_MS
          ) {
            await failIdempotencyRecord(
              idempotencyKey,
              'processing timeout, record auto reset'
            );
            await waitForNextAttempt(retryDelayMs);
            continue;
          }

          if (isExpiredByTtl) {
            await failIdempotencyRecord(
              idempotencyKey,
              'processing ttl expired, record auto reset'
            );
            await waitForNextAttempt(retryDelayMs);
            continue;
          }

          // 使用指数退避策略，避免过度轮询
          await waitForNextAttempt();
          continue; // 继续下一次重试
        }

        // 情况3：操作失败，允许重试
        // ✅ 修复：删除(或重置)失败记录后再重试，否则会因为唯一约束导致一直 P2002
        if (!existing.isNew && existing.operation?.status === 'failed') {
          try {
            await prisma.inventoryOperation.delete({
              where: { idempotencyKey },
            });
          } catch (_cleanupErr) {
            // 如果删除时发现记录已不存在，忽略即可
          }
          // 短暂等待，避免立刻与其他并发再次竞争
          await waitForNextAttempt(retryDelayMs);
          continue;
        }

        // 情况4：其他未知状态，等待后重试
        await waitForNextAttempt();
        continue;
      }

      // 外键约束错误：产品不存在等场景（如测试中的无效产品ID）
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        // 幂等性记录已不再强绑定 productId，P2003 一般来自 operatorId 等外键。
        throw new Error('幂等性记录写入失败：关联数据不存在');
      }

      // SQLite 在高并发下可能返回超时/事务关闭错误 (P2024/P2034) 或未知的超时错误
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2024' || error.code === 'P2034')) ||
        (error instanceof Prisma.PrismaClientUnknownRequestError &&
          /timed out/i.test(error.message))
      ) {
        await waitForNextAttempt();
        continue;
      }

      // 其他数据库错误直接抛出，不重试
      throw error;
    }
  }

  const existing = await checkIdempotency(idempotencyKey);
  if (!existing.isNew && existing.data) {
    return existing.data as T;
  }

  const elapsedSeconds = Math.ceil((Date.now() - startTime) / 1000);

  // 超过最大等待时间，说明操作持续时间过长或系统负载过高
  throw ApiError.internalError(
    `操作超时：请求处理时间过长（超过${elapsedSeconds}秒等待），请稍后重试。` +
      `这可能是由于系统繁忙或操作耗时过长导致的。`
  );
}
