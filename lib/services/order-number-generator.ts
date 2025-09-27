import { prisma } from '@/lib/db';
import { salesOrderConfig } from '@/lib/env';

/**
 * 订单号生成服务
 * 使用数据库序列表保证并发安全的唯一订单号生成
 */

export interface OrderNumberConfig {
  prefix: string;
  numberLength: number;
  sequenceType: string;
}

/**
 * 默认配置
 */
export const ORDER_NUMBER_CONFIGS = {
  SALES_ORDER: {
    prefix: salesOrderConfig.orderPrefix || 'SO',
    numberLength: salesOrderConfig.numberLength || 4,
    sequenceType: 'sales_order',
  },
  PURCHASE_ORDER: {
    prefix: 'PO',
    numberLength: 4,
    sequenceType: 'purchase_order',
  },
  RETURN_ORDER: {
    prefix: 'RO',
    numberLength: 4,
    sequenceType: 'return_order',
  },
} as const;

/**
 * 生成唯一的订单号
 * 使用数据库原子操作保证并发安全
 *
 * @param config 订单号配置
 * @returns Promise<string> 生成的订单号
 */
export async function generateUniqueOrderNumber(
  config: OrderNumberConfig = ORDER_NUMBER_CONFIGS.SALES_ORDER
): Promise<string> {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(
        async tx => {
          const today = new Date();
          const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

          // SQLite兼容的原子操作：先尝试插入，如果失败则更新
          try {
            // 尝试插入新记录
            await tx.orderSequence.create({
              data: {
                sequenceType: config.sequenceType,
                dateKey,
                currentSequence: 1,
              },
            });
          } catch (error) {
            // 如果记录已存在，则更新序列号
            await tx.orderSequence.updateMany({
              where: {
                sequenceType: config.sequenceType,
                dateKey,
              },
              data: {
                currentSequence: {
                  increment: 1,
                },
              },
            });
          }

          // 获取更新后的序列号
          const result = await tx.orderSequence.findFirst({
            where: {
              sequenceType: config.sequenceType,
              dateKey,
            },
            select: {
              currentSequence: true,
            },
          });

          if (!result) {
            throw new Error('无法获取序列号');
          }

          const currentSequence = result.currentSequence;
          const orderNumber = `${config.prefix}${dateKey}${currentSequence
            .toString()
            .padStart(config.numberLength, '0')}`;

          // 双重检查：确保生成的订单号在目标表中不存在
          if (config.sequenceType === 'sales_order') {
            const existingOrder = await tx.salesOrder.findFirst({
              where: { orderNumber },
              select: { id: true },
            });

            if (existingOrder) {
              throw new Error('订单号冲突，正在重试...');
            }
          }

          return orderNumber;
        },
        {
          isolationLevel: 'Serializable',
          timeout: 10000, // 10秒超时
        }
      );
    } catch (error) {
      attempt++;

      // 如果是序列化错误或死锁，等待随机时间后重试
      if (
        error instanceof Error &&
        (error.message.includes('Deadlock') ||
          error.message.includes('Serialization failure') ||
          error.message.includes('订单号冲突'))
      ) {
        if (attempt < maxRetries) {
          // 随机等待 50-200ms 避免重试风暴
          await new Promise(resolve =>
            setTimeout(resolve, 50 + Math.random() * 150)
          );
          continue;
        }
      }

      // 其他错误或达到最大重试次数
      if (attempt >= maxRetries) {
        throw new Error(
          `生成订单号失败，已重试${maxRetries}次: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }
    }
  }

  throw new Error('生成订单号失败：超出最大重试次数');
}

/**
 * 生成销售订单号
 */
export async function generateSalesOrderNumber(): Promise<string> {
  return generateUniqueOrderNumber(ORDER_NUMBER_CONFIGS.SALES_ORDER);
}

/**
 * 生成采购订单号
 */
export async function generatePurchaseOrderNumber(): Promise<string> {
  return generateUniqueOrderNumber(ORDER_NUMBER_CONFIGS.PURCHASE_ORDER);
}

/**
 * 生成退货订单号
 */
export async function generateReturnOrderNumber(): Promise<string> {
  return generateUniqueOrderNumber(ORDER_NUMBER_CONFIGS.RETURN_ORDER);
}

/**
 * 批量预生成订单号（用于高并发场景）
 *
 * @param config 订单号配置
 * @param count 生成数量
 * @returns Promise<string[]> 生成的订单号数组
 */
export async function batchGenerateOrderNumbers(
  config: OrderNumberConfig,
  count: number
): Promise<string[]> {
  if (count <= 0 || count > 100) {
    throw new Error('批量生成数量必须在1-100之间');
  }

  return await prisma.$transaction(
    async tx => {
      const today = new Date();
      const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

      // SQLite兼容的批量更新
      try {
        // 尝试插入新记录
        await tx.orderSequence.create({
          data: {
            sequenceType: config.sequenceType,
            dateKey,
            currentSequence: count,
          },
        });
      } catch (error) {
        // 如果记录已存在，则更新序列号
        await tx.orderSequence.updateMany({
          where: {
            sequenceType: config.sequenceType,
            dateKey,
          },
          data: {
            currentSequence: {
              increment: count,
            },
          },
        });
      }

      // 获取更新后的序列号
      const result = await tx.orderSequence.findFirst({
        where: {
          sequenceType: config.sequenceType,
          dateKey,
        },
        select: {
          currentSequence: true,
        },
      });

      if (!result) {
        throw new Error('无法获取序列号');
      }

      const endSequence = result.currentSequence;
      const startSequence = endSequence - count + 1;

      // 生成订单号数组
      const orderNumbers: string[] = [];
      for (let i = startSequence; i <= endSequence; i++) {
        const orderNumber = `${config.prefix}${dateKey}${i
          .toString()
          .padStart(config.numberLength, '0')}`;
        orderNumbers.push(orderNumber);
      }

      return orderNumbers;
    },
    {
      isolationLevel: 'Serializable',
      timeout: 15000, // 15秒超时
    }
  );
}

/**
 * 获取今日订单统计
 */
export async function getTodayOrderStats(sequenceType: string) {
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

  const result = await prisma.orderSequence.findFirst({
    where: {
      sequenceType,
      dateKey,
    },
    select: {
      currentSequence: true,
      updatedAt: true,
    },
  });

  return {
    totalOrders: result?.currentSequence || 0,
    lastUpdated: result?.updatedAt || null,
  };
}
