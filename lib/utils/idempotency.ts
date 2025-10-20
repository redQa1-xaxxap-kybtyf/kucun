/**
 * 幂等性处理工具
 * 防止重复操作,确保操作的幂等性
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

export type OperationType =
  | 'inbound'
  | 'outbound'
  | 'adjust'
  | 'return_order_status_change'
  | 'factory_shipment_status_change'
  | 'sales_order_create'
  | 'sales_order_update'
  | 'sales_order_status_change';

export interface IdempotencyResult<T> {
  isNew: boolean;
  data: T | null;
  operation: {
    id: string;
    status: string;
    createdAt: Date;
  } | null;
}

const MAX_PROCESSING_DURATION_MS = 15_000;

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
  if (operation.status === 'failed') {
    return {
      isNew: true,
      data: null,
      operation: null,
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
 * @param productId 产品ID
 * @param operatorId 操作人ID
 * @param requestData 请求数据
 * @returns 操作记录ID
 */
export async function createIdempotencyRecord(
  idempotencyKey: string,
  operationType: OperationType,
  productId: string,
  operatorId: string,
  requestData: Record<string, unknown>
): Promise<string> {
  // 设置过期时间为24小时后
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const operation = await prisma.inventoryOperation.create({
    data: {
      idempotencyKey,
      operationType,
      productId,
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
export async function withIdempotency<T>(
  idempotencyKey: string,
  operationType: OperationType,
  productId: string,
  operatorId: string,
  requestData: Record<string, unknown>,
  operation: () => Promise<T>
): Promise<T> {
  const maxRetries = 20; // 最大重试次数（总等待时间约2-4秒）
  const retryDelayMs = 100; // 初始重试延迟(毫秒)
  const maxRetryDelayMs = 500; // 最大重试延迟(毫秒)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 策略1：乐观锁 - 先尝试创建记录
      // 优点：在无并发时性能最优，避免了先检查后创建的竞态窗口
      // 如果创建成功，说明是第一个请求，直接执行操作
      await prisma.inventoryOperation.create({
        data: {
          idempotencyKey,
          operationType,
          productId,
          operatorId,
          status: 'processing',
          requestData: JSON.stringify(requestData),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
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
          if (
            createdAt &&
            Date.now() - createdAt.getTime() > MAX_PROCESSING_DURATION_MS
          ) {
            await failIdempotencyRecord(
              idempotencyKey,
              'processing timeout, record auto reset'
            );
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
          }

          // 使用指数退避策略，避免过度轮询
          const delay = Math.min(
            retryDelayMs * Math.pow(1.5, attempt),
            maxRetryDelayMs
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // 继续下一次重试
        }

        // 情况3：操作失败，允许重试
        // 直接进入下一轮循环，尝试重新创建记录
        if (!existing.isNew && existing.operation?.status === 'failed') {
          // 稍微延迟后重试创建
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }

        // 情况4：其他未知状态，等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      // SQLite 在高并发下可能返回超时/事务关闭错误 (P2024/P2034) 或未知的超时错误
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2024' || error.code === 'P2034')) ||
        (error instanceof Prisma.PrismaClientUnknownRequestError &&
          /timed out/i.test(error.message))
      ) {
        const delay = Math.min(
          retryDelayMs * Math.pow(1.5, attempt + 1),
          maxRetryDelayMs
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // 其他数据库错误直接抛出，不重试
      throw error;
    }
  }

  // 超过最大重试次数，说明操作持续时间过长或系统负载过高
  throw new Error(
    `操作超时：请求处理时间过长（超过${maxRetries}次重试），请稍后重试。` +
      `这可能是由于系统繁忙或操作耗时过长导致的。`
  );
}
