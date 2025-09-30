/**
 * 幂等性处理工具
 * 防止重复操作,确保操作的幂等性
 */

import { prisma } from '@/lib/db';

export type OperationType = 'inbound' | 'outbound' | 'adjust';

export interface IdempotencyResult<T> {
  isNew: boolean;
  data: T | null;
  operation: {
    id: string;
    status: string;
    createdAt: Date;
  } | null;
}

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
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  operationType: OperationType,
  productId: string,
  operatorId: string,
  requestData: Record<string, unknown>,
  operation: () => Promise<T>
): Promise<T> {
  // 1. 检查幂等性
  const check = await checkIdempotency(idempotencyKey);

  // 如果操作已完成,直接返回之前的结果
  if (!check.isNew && check.data) {
    return check.data as T;
  }

  // 如果操作正在处理中,抛出错误
  if (!check.isNew && check.operation?.status === 'processing') {
    throw new Error('操作正在处理中,请稍后重试');
  }

  // 2. 创建幂等性记录
  await createIdempotencyRecord(
    idempotencyKey,
    operationType,
    productId,
    operatorId,
    requestData
  );

  try {
    // 3. 执行操作
    const result = await operation();

    // 4. 标记为完成
    await completeIdempotencyRecord(
      idempotencyKey,
      result as Record<string, unknown>
    );

    return result;
  } catch (error) {
    // 5. 标记为失败
    const errorMessage = error instanceof Error ? error.message : '操作失败';
    await failIdempotencyRecord(idempotencyKey, errorMessage);
    throw error;
  }
}
