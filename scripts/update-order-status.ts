/**
 * 更新订单状态为 confirmed
 */
import { PrismaClient } from '@prisma/client';

import { logger } from '@/lib/utils/console-logger';

const prisma = new PrismaClient();

async function updateOrderStatus() {
  try {
    logger.info('scripts', '更新订单状态开始');

    const order = await prisma.salesOrder.findFirst({
      where: {
        orderNumber: 'SO202510230100',
      },
    });

    if (!order) {
      logger.warn('scripts', '目标订单不存在', {
        orderNumber: 'SO202510230100',
      });
      return;
    }

    logger.info('scripts', '准备更新订单状态', {
      orderNumber: order.orderNumber,
      currentStatus: order.status,
      targetStatus: 'confirmed',
    });

    const updatedOrder = await prisma.salesOrder.update({
      where: {
        id: order.id,
      },
      data: {
        status: 'confirmed',
      },
    });

    logger.info('scripts', '订单状态更新完成', {
      orderNumber: updatedOrder.orderNumber,
      newStatus: updatedOrder.status,
    });
  } catch (error) {
    logger.error('scripts', '订单状态更新失败', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateOrderStatus();
