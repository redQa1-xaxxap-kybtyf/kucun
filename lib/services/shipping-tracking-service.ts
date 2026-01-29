/**
 * 运输追踪服务
 * 对接系统设置中的运输查询功能,实现自动状态更新
 */

import type { Prisma } from '@prisma/client';

import { updateFactoryShipmentStatus } from '@/lib/api/handlers/factory-shipment-status';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import {
  mapShippingStatusToOrderStatus,
  type ShippingTrackingQuery,
  type ShippingTrackingRecord,
  type ShippingTrackingResponse,
} from '@/lib/types/shipping-tracking';

/**
 * 查询运输状态
 * 调用系统设置中的运输查询接口
 *
 * @param site - 站点(船运公司名称)
 * @param trackingNumber - 追踪单号(集装箱号)
 * @returns 运输追踪记录
 */
export async function queryShippingTracking(
  site: string,
  trackingNumber: string
): Promise<ShippingTrackingResponse> {
  try {
    // TODO: 调用您的运输查询API
    // 这里需要根据您实际的API接口来实现

    const query: ShippingTrackingQuery = {
      site,
      trackingNumber,
    };

    // 示例: 调用运输查询接口
    const response = await fetch('/api/settings/shipping-tracking/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`运输查询失败: ${response.statusText}`);
    }

    const data = await response.json();

    // 假设返回格式:
    // {
    //   queryTime: "2025-01-XX XX:XX:XX",
    //   site: "XXX船运公司",
    //   trackingNumber: "ABCD1234567",
    //   status: "in_transit" | "arrived",
    //   destination: "上海港",
    //   estimatedArrival: "2025-01-XX",
    //   updateTime: "2025-01-XX XX:XX:XX",
    //   result: "货物运输中"
    // }

    const trackingRecord: ShippingTrackingRecord = {
      queryTime: data.queryTime || new Date().toISOString(),
      site: data.site || site,
      trackingNumber: data.trackingNumber || trackingNumber,
      status: data.status || 'not_found',
      destination: data.destination,
      estimatedArrival: data.estimatedArrival,
      updateTime: data.updateTime || new Date().toISOString(),
      result: data.result,
    };

    return {
      success: true,
      data: trackingRecord,
    };
  } catch (error) {
    logger.error('shipping-tracking', '查询运输状态失败', error, {
      site,
      trackingNumber,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    };
  }
}

// ========== Internal helpers ==========
type OrderForTracking = {
  id: string;
  orderNumber: string;
  status: string;
  containerNumber: string | null;
  shippingCompany: string | null;
  estimatedArrival: Date | null | undefined;
};

function isTrackable(order: Pick<OrderForTracking, 'status'>): boolean {
  return (
    order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
    order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT
  );
}

async function updateEtaIfChanged(
  orderId: string,
  previousEta: Date | null | undefined,
  tracking: ShippingTrackingRecord,
  orderNumber: string
): Promise<void> {
  if (tracking.estimatedArrival && tracking.estimatedArrival !== previousEta) {
    await prisma.factoryShipmentOrder.update({
      where: { id: orderId },
      data: { estimatedArrival: new Date(tracking.estimatedArrival) },
    });
    logger.info('shipping-tracking', `更新预计到达时间: ${orderNumber}`);
  }
}

async function applyTransition(
  orderId: string,
  currentStatus: FactoryShipmentStatus,
  target: 'in_transit' | 'arrived',
  tracking: ShippingTrackingRecord,
  orderNumber: string
): Promise<boolean> {
  if (
    target === 'in_transit' &&
    currentStatus === FACTORY_SHIPMENT_STATUS.SHIPPED
  ) {
    await updateFactoryShipmentStatus(
      orderId,
      FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
      currentStatus,
      {
        estimatedArrival: tracking.estimatedArrival
          ? new Date(tracking.estimatedArrival)
          : undefined,
      },
      true
    );
    logger.info('shipping-tracking', `自动更新为运输中: ${orderNumber}`);
    return true;
  }

  if (
    target === 'arrived' &&
    (currentStatus === FACTORY_SHIPMENT_STATUS.SHIPPED ||
      currentStatus === FACTORY_SHIPMENT_STATUS.IN_TRANSIT)
  ) {
    await updateFactoryShipmentStatus(
      orderId,
      FACTORY_SHIPMENT_STATUS.ARRIVED,
      currentStatus,
      {
        arrivalDate: tracking.updateTime
          ? new Date(tracking.updateTime)
          : new Date(),
      },
      true
    );
    logger.info('shipping-tracking', `自动更新为到港: ${orderNumber}`, {
      arrivalDate:
        typeof tracking.updateTime === 'string'
          ? tracking.updateTime
          : tracking.updateTime.toISOString(),
    });
    return true;
  }
  return false;
}

/**
 * 更新单个订单的运输状态
 *
 * @param orderId - 订单ID
 * @returns 是否更新成功
 */
export async function updateOrderShippingStatus(
  orderId: string
): Promise<boolean> {
  try {
    const order = (await prisma.factoryShipmentOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        containerNumber: true,
        shippingCompany: true,
        estimatedArrival: true,
      },
    })) as OrderForTracking | null;

    if (!order) {
      logger.warn('shipping-tracking', `订单不存在: ${orderId}`);
      return false;
    }

    if (!isTrackable(order)) {
      return false;
    }

    if (!order.shippingCompany || !order.containerNumber) {
      logger.warn(
        'shipping-tracking',
        `订单缺少必要信息: ${order.orderNumber}`,
        {
          shippingCompany: order.shippingCompany,
          containerNumber: order.containerNumber,
        }
      );
      return false;
    }

    // 查询运输状态
    const trackingResponse = await queryShippingTracking(
      order.shippingCompany,
      order.containerNumber
    );

    logger.debug('shipping-tracking', '运输状态查询完成', {
      orderId,
      success: trackingResponse.success,
    });

    if (!trackingResponse.success || !trackingResponse.data) {
      logger.error('shipping-tracking', `查询失败: ${order.orderNumber}`, {
        error: trackingResponse.error,
      });
      return false;
    }

    const trackingData = trackingResponse.data;

    const newOrderStatus = mapShippingStatusToOrderStatus(trackingData.status);

    if (!newOrderStatus) {
      logger.info('shipping-tracking', `无法映射状态: ${order.orderNumber}`, {
        shippingStatus: trackingData.status,
      });
      return false;
    }

    if (newOrderStatus === order.status) {
      await updateEtaIfChanged(
        orderId,
        order.estimatedArrival,
        trackingData,
        order.orderNumber
      );
      return true;
    }

    if (newOrderStatus === 'in_transit') {
      return await applyTransition(
        orderId,
        order.status as FactoryShipmentStatus,
        'in_transit',
        trackingData,
        order.orderNumber
      );
    }

    if (newOrderStatus === 'arrived') {
      return await applyTransition(
        orderId,
        order.status as FactoryShipmentStatus,
        'arrived',
        trackingData,
        order.orderNumber
      );
    }

    // 其他情况(如 'shipped' 或 null)不进行系统自动流转
    return false;
  } catch (error) {
    logger.error('shipping-tracking', `更新订单状态失败: ${orderId}`, error);
    return false;
  }
}

/**
 * 批量更新所有需要查询的订单运输状态
 * 定时任务调用此方法
 *
 * @returns 更新统计信息
 */
export async function updateAllShippingStatuses(): Promise<{
  total: number;
  success: number;
  failed: number;
  skipped: number;
}> {
  logger.info('shipping-tracking', '开始批量更新运输状态');

  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const baseWhere: Prisma.FactoryShipmentOrderWhereInput = {
      status: {
        in: [
          FACTORY_SHIPMENT_STATUS.SHIPPED,
          FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
        ],
      },
      shippingCompany: {
        not: null,
      },
      containerNumber: {
        not: null,
      },
    };

    const skipCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const [total, skipped] = await Promise.all([
      prisma.factoryShipmentOrder.count({ where: baseWhere }),
      prisma.factoryShipmentOrder.count({
        where: {
          ...baseWhere,
          updatedAt: {
            gt: skipCutoff,
          },
        },
      }),
    ]);

    stats.total = total;
    stats.skipped = skipped;

    const processWhere: Prisma.FactoryShipmentOrderWhereInput = {
      ...baseWhere,
      updatedAt: { lte: skipCutoff },
    };

    const toProcess = await prisma.factoryShipmentOrder.count({
      where: processWhere,
    });

    logger.info(
      'shipping-tracking',
      `找到 ${toProcess} 个订单需要查询（总计 ${total}，跳过 ${skipped} 个）`
    );

    let cursor: string | undefined;
    const batchSize = 200;

    while (true) {
      const orders = await prisma.factoryShipmentOrder.findMany({
        where: processWhere,
        select: {
          id: true,
          orderNumber: true,
          updatedAt: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (orders.length === 0) {
        break;
      }

      for (const order of orders) {
        try {
          const updated = await updateOrderShippingStatus(order.id);

          if (updated) {
            stats.success++;
          } else {
            stats.failed++;
          }

          // 添加延迟避免API限流(每个查询间隔1秒)
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(
            'shipping-tracking',
            `处理订单失败: ${order.orderNumber}`,
            error
          );
          stats.failed++;
        }
      }

      cursor = orders[orders.length - 1].id;
    }

    logger.info('shipping-tracking', '批量更新完成', stats);

    return stats;
  } catch (error) {
    logger.error('shipping-tracking', '批量更新失败', error);
    return stats;
  }
}

/**
 * 手动触发单个订单的运输状态查询
 * 用于订单详情页面的"刷新运输状态"按钮
 *
 * @param orderId - 订单ID
 * @returns 查询结果
 */
export async function refreshOrderShippingStatus(orderId: string): Promise<{
  success: boolean;
  message: string;
  data?: ShippingTrackingRecord;
}> {
  try {
    const order = await prisma.factoryShipmentOrder.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        containerNumber: true,
        shippingCompany: true,
      },
    });

    if (!order) {
      return {
        success: false,
        message: '订单不存在',
      };
    }

    if (
      order.status !== FACTORY_SHIPMENT_STATUS.SHIPPED &&
      order.status !== FACTORY_SHIPMENT_STATUS.IN_TRANSIT
    ) {
      return {
        success: false,
        message: '只能查询已发货或运输中的订单',
      };
    }

    if (!order.shippingCompany || !order.containerNumber) {
      return {
        success: false,
        message: '缺少船运公司或集装箱号',
      };
    }

    // 查询运输状态
    const trackingResponse = await queryShippingTracking(
      order.shippingCompany,
      order.containerNumber
    );

    if (!trackingResponse.success) {
      return {
        success: false,
        message: trackingResponse.error || '查询失败',
      };
    }

    // 更新订单状态
    await updateOrderShippingStatus(orderId);

    return {
      success: true,
      message: '查询成功',
      data: trackingResponse.data,
    };
  } catch (error) {
    logger.error('shipping-tracking', '手动刷新失败', error, { orderId });
    return {
      success: false,
      message: error instanceof Error ? error.message : '查询失败',
    };
  }
}
