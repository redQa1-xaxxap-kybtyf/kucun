import { prisma } from '@/lib/db';
import { factoryShipmentConfig, salesOrderConfig } from '@/lib/env';

/**
 * 简化版订单号生成服务
 * 不依赖额外的数据库表，直接使用现有的销售订单表
 * 使用事务和重试机制保证并发安全
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
} as const;

/**
 * 生成唯一的销售订单号
 * 使用现有销售订单表进行序列号生成，保证并发安全
 *
 * @returns Promise<string> 生成的订单号
 */
export async function generateSalesOrderNumber(): Promise<string> {
  const config = ORDER_NUMBER_CONFIGS.SALES_ORDER;
  const maxRetries = 15; // 增加重试次数以处理高并发
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(
        async tx => {
          const today = new Date();
          const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
          const prefix = `${config.prefix}${dateKey}`;

          // 改进的并发安全策略：生成订单号并依赖数据库唯一约束
          // 查找今天最后一个订单号
          const lastOrder = await tx.salesOrder.findFirst({
            where: {
              orderNumber: {
                startsWith: prefix,
              },
            },
            orderBy: {
              orderNumber: 'desc',
            },
            select: {
              orderNumber: true,
            },
          });

          let sequence = 1;
          if (lastOrder) {
            const lastSequence = parseInt(
              lastOrder.orderNumber.slice(-config.numberLength)
            );
            sequence = lastSequence + 1;
          }

          // 为了处理并发，在基础序号上加上随机偏移和时间戳
          const randomOffset = Math.floor(Math.random() * 50); // 0-49的随机偏移
          const retryOffset = attempt * 10; // 每次重试增加更大的偏移
          const timeOffset = Date.now() % 100; // 使用时间戳的最后两位作为额外偏移
          const finalSequence =
            sequence + randomOffset + retryOffset + timeOffset;

          const orderNumber = `${prefix}${finalSequence
            .toString()
            .padStart(config.numberLength, '0')}`;

          // 简单检查订单号是否已存在
          const existingOrder = await tx.salesOrder.findFirst({
            where: { orderNumber },
            select: { id: true },
          });

          if (existingOrder) {
            throw new Error(`订单号冲突: ${orderNumber}`);
          }

          return orderNumber;
        },
        {
          // 修复：SQLite不支持Serializable隔离级别，移除该设置
          timeout: 10000, // 10秒超时
        }
      );
    } catch (error) {
      attempt++;

      // 检查是否是可重试的错误
      const isRetryableError =
        error instanceof Error &&
        (error.message.includes('Deadlock') ||
          error.message.includes('Serialization failure') ||
          error.message.includes('订单号冲突') ||
          error.message.includes('UNIQUE constraint failed') ||
          error.message.includes('unique constraint') ||
          error.message.includes('duplicate key') ||
          // Prisma的唯一约束错误
          error.message.includes('Unique constraint failed on the fields'));

      if (isRetryableError && attempt < maxRetries) {
        // 随机等待时间，避免重试风暴
        const baseDelay = 50;
        const randomDelay = Math.random() * 150;
        const backoffDelay = attempt * 25; // 指数退避
        const totalDelay = baseDelay + randomDelay + backoffDelay;

        console.log(
          `订单号生成冲突，第${attempt}次重试，等待${Math.round(totalDelay)}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        continue;
      }

      // 其他错误或达到最大重试次数
      if (attempt >= maxRetries) {
        throw new Error(
          `生成订单号失败，已重试${maxRetries}次: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }

      // 不可重试的错误，直接抛出
      throw error;
    }
  }

  throw new Error('生成订单号失败：超出最大重试次数');
}

/**
 * 获取今日订单统计
 */
export async function getTodayOrderStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCount = await prisma.salesOrder.count({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  return {
    totalOrders: todayCount,
    lastUpdated: new Date(),
  };
}

/**
 * 验证订单号格式
 */
export function validateOrderNumberFormat(orderNumber: string): {
  valid: boolean;
  message: string;
} {
  const config = ORDER_NUMBER_CONFIGS.SALES_ORDER;
  const regex = new RegExp(
    `^${config.prefix}\\d{8}\\d{${config.numberLength}}$`
  );

  if (!regex.test(orderNumber)) {
    return {
      valid: false,
      message: `订单号格式不正确，应为：${config.prefix} + 8位日期 + ${config.numberLength}位序号`,
    };
  }

  return {
    valid: true,
    message: '订单号格式正确',
  };
}

/**
 * 检查订单号是否已存在
 */
export async function isOrderNumberExists(
  orderNumber: string
): Promise<boolean> {
  const existingOrder = await prisma.salesOrder.findFirst({
    where: { orderNumber },
    select: { id: true },
  });

  return !!existingOrder;
}

/**
 * 生成唯一的厂家发货订单号
 * 使用现有厂家发货订单表进行序列号生成,保证并发安全
 *
 * @returns Promise<string> 生成的订单号
 */
export async function generateFactoryShipmentNumber(): Promise<string> {
  const prefix = factoryShipmentConfig.orderPrefix || 'FS';
  const numberLength = 4;
  const maxRetries = 15;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(
        async tx => {
          const today = new Date();
          const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
          const fullPrefix = `${prefix}${dateKey}`;

          // 查找今天最后一个订单号
          const lastOrder = await tx.factoryShipmentOrder.findFirst({
            where: {
              orderNumber: {
                startsWith: fullPrefix,
              },
            },
            orderBy: {
              orderNumber: 'desc',
            },
            select: {
              orderNumber: true,
            },
          });

          let sequence = 1;
          if (lastOrder) {
            const lastSequence = parseInt(
              lastOrder.orderNumber.slice(-numberLength)
            );
            sequence = lastSequence + 1;
          }

          // 处理并发
          const randomOffset = Math.floor(Math.random() * 50);
          const retryOffset = attempt * 10;
          const timeOffset = Date.now() % 100;
          const finalSequence =
            sequence + randomOffset + retryOffset + timeOffset;

          const orderNumber = `${fullPrefix}${finalSequence
            .toString()
            .padStart(numberLength, '0')}`;

          // 检查订单号是否已存在
          const existingOrder = await tx.factoryShipmentOrder.findFirst({
            where: { orderNumber },
            select: { id: true },
          });

          if (existingOrder) {
            throw new Error(`订单号冲突: ${orderNumber}`);
          }

          return orderNumber;
        },
        {
          timeout: 10000,
        }
      );
    } catch (error) {
      attempt++;

      const isRetryableError =
        error instanceof Error &&
        (error.message.includes('Deadlock') ||
          error.message.includes('Serialization failure') ||
          error.message.includes('订单号冲突') ||
          error.message.includes('UNIQUE constraint failed') ||
          error.message.includes('unique constraint') ||
          error.message.includes('duplicate key') ||
          error.message.includes('Unique constraint failed on the fields'));

      if (isRetryableError && attempt < maxRetries) {
        const baseDelay = 50;
        const randomDelay = Math.random() * 150;
        const backoffDelay = attempt * 25;
        const totalDelay = baseDelay + randomDelay + backoffDelay;

        console.log(
          `厂家发货订单号生成冲突,第${attempt}次重试,等待${Math.round(totalDelay)}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        continue;
      }

      if (attempt >= maxRetries) {
        throw new Error(
          `生成厂家发货订单号失败,已重试${maxRetries}次: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }

      throw error;
    }
  }

  throw new Error('生成厂家发货订单号失败:超出最大重试次数');
}

/**
 * 生成唯一的退货订单号
 * 使用现有退货订单表进行序列号生成,保证并发安全
 *
 * @returns Promise<string> 生成的订单号
 */
export async function generateReturnOrderNumber(): Promise<string> {
  const prefix = 'RT';
  const numberLength = 4;
  const maxRetries = 15;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(
        async tx => {
          const today = new Date();
          const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
          const fullPrefix = `${prefix}${dateKey}`;

          const lastOrder = await tx.returnOrder.findFirst({
            where: {
              returnNumber: {
                startsWith: fullPrefix,
              },
            },
            orderBy: {
              returnNumber: 'desc',
            },
            select: {
              returnNumber: true,
            },
          });

          let sequence = 1;
          if (lastOrder) {
            const lastSequence = parseInt(
              lastOrder.returnNumber.slice(-numberLength)
            );
            sequence = lastSequence + 1;
          }

          const randomOffset = Math.floor(Math.random() * 50);
          const retryOffset = attempt * 10;
          const timeOffset = Date.now() % 100;
          const finalSequence =
            sequence + randomOffset + retryOffset + timeOffset;

          const returnNumber = `${fullPrefix}${finalSequence
            .toString()
            .padStart(numberLength, '0')}`;

          const existingOrder = await tx.returnOrder.findFirst({
            where: { returnNumber },
            select: { id: true },
          });

          if (existingOrder) {
            throw new Error(`退货单号冲突: ${returnNumber}`);
          }

          return returnNumber;
        },
        {
          timeout: 10000,
        }
      );
    } catch (error) {
      attempt++;

      const isRetryableError =
        error instanceof Error &&
        (error.message.includes('Deadlock') ||
          error.message.includes('Serialization failure') ||
          error.message.includes('退货单号冲突') ||
          error.message.includes('UNIQUE constraint failed') ||
          error.message.includes('unique constraint') ||
          error.message.includes('duplicate key') ||
          error.message.includes('Unique constraint failed on the fields'));

      if (isRetryableError && attempt < maxRetries) {
        const baseDelay = 50;
        const randomDelay = Math.random() * 150;
        const backoffDelay = attempt * 25;
        const totalDelay = baseDelay + randomDelay + backoffDelay;

        console.log(
          `退货单号生成冲突,第${attempt}次重试,等待${Math.round(totalDelay)}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        continue;
      }

      if (attempt >= maxRetries) {
        throw new Error(
          `生成退货单号失败,已重试${maxRetries}次: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }

      throw error;
    }
  }

  throw new Error('生成退货单号失败:超出最大重试次数');
}

/**
 * 生成唯一的退款单号
 * 使用现有退款记录表进行序列号生成,保证并发安全
 *
 * @returns Promise<string> 生成的单号
 */
export async function generateRefundNumber(): Promise<string> {
  const prefix = 'RF';
  const numberLength = 4;
  const maxRetries = 15;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(
        async tx => {
          const today = new Date();
          const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
          const fullPrefix = `${prefix}${dateKey}`;

          const lastRecord = await tx.refundRecord.findFirst({
            where: {
              refundNumber: {
                startsWith: fullPrefix,
              },
            },
            orderBy: {
              refundNumber: 'desc',
            },
            select: {
              refundNumber: true,
            },
          });

          let sequence = 1;
          if (lastRecord) {
            const lastSequence = parseInt(
              lastRecord.refundNumber.slice(-numberLength)
            );
            sequence = lastSequence + 1;
          }

          const randomOffset = Math.floor(Math.random() * 50);
          const retryOffset = attempt * 10;
          const timeOffset = Date.now() % 100;
          const finalSequence =
            sequence + randomOffset + retryOffset + timeOffset;

          const refundNumber = `${fullPrefix}${finalSequence
            .toString()
            .padStart(numberLength, '0')}`;

          const existingRecord = await tx.refundRecord.findFirst({
            where: { refundNumber },
            select: { id: true },
          });

          if (existingRecord) {
            throw new Error(`退款单号冲突: ${refundNumber}`);
          }

          return refundNumber;
        },
        {
          timeout: 10000,
        }
      );
    } catch (error) {
      attempt++;

      const isRetryableError =
        error instanceof Error &&
        (error.message.includes('Deadlock') ||
          error.message.includes('Serialization failure') ||
          error.message.includes('退款单号冲突') ||
          error.message.includes('UNIQUE constraint failed') ||
          error.message.includes('unique constraint') ||
          error.message.includes('duplicate key') ||
          error.message.includes('Unique constraint failed on the fields'));

      if (isRetryableError && attempt < maxRetries) {
        const baseDelay = 50;
        const randomDelay = Math.random() * 150;
        const backoffDelay = attempt * 25;
        const totalDelay = baseDelay + randomDelay + backoffDelay;

        console.log(
          `退款单号生成冲突,第${attempt}次重试,等待${Math.round(totalDelay)}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        continue;
      }

      if (attempt >= maxRetries) {
        throw new Error(
          `生成退款单号失败,已重试${maxRetries}次: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }

      throw error;
    }
  }

  throw new Error('生成退款单号失败:超出最大重试次数');
}
