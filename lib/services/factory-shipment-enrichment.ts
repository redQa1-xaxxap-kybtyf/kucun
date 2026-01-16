/**
 * 厂家发货订单字段增强服务
 * 提供共享的字段增强逻辑，确保 SSR 和 API 路由使用相同的数据结构
 * ✅ P1修复: 提取字段增强逻辑为独立服务函数
 */

import { prisma } from '@/lib/db';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';
import { toNumber } from '@/lib/utils/number';

/**
 * 增强厂家发货订单数据
 * - 添加最新运输状态 (latestShippingStatus)
 * - 添加金额摘要 (fulfillmentSummary)
 */
export async function enrichFactoryShipmentOrders(
  orders: FactoryShipmentOrder[]
): Promise<FactoryShipmentOrder[]> {
  if (orders.length === 0) return [];

  // 批量获取所有订单的最新运输状态
  const orderIds = orders.map(order => order.id);
  const latestQueries = await prisma.shippingQuery.findMany({
    where: {
      factoryShipmentOrderId: { in: orderIds },
      queryStatus: 'success',
    },
    distinct: ['factoryShipmentOrderId'],
    orderBy: [{ factoryShipmentOrderId: 'asc' }, { queriedAt: 'desc' }],
    take: orderIds.length,
    select: {
      factoryShipmentOrderId: true,
      status: true,
      queriedAt: true,
    },
  });

  // 为每个订单找到最新的查询状态
  const statusMap = new Map<string, string>();
  for (const query of latestQueries) {
    if (
      query.factoryShipmentOrderId &&
      !statusMap.has(query.factoryShipmentOrderId)
    ) {
      statusMap.set(query.factoryShipmentOrderId, query.status || '');
    }
  }

  // 增强订单数据
  return orders.map(order => {
    // 计算客户货和自有货金额
    const customerOwnedAmount = order.items
      .filter(item => item.ownership === 'customer')
      .reduce((sum, item) => sum + toNumber(item.totalPrice, 0), 0);
    const selfOwnedAmount = order.items
      .filter(item => item.ownership === 'self')
      .reduce((sum, item) => sum + toNumber(item.totalPrice, 0), 0);

    return {
      ...order,
      latestShippingStatus: statusMap.get(order.id) || null,
      fulfillmentSummary: {
        customerOwnedAmount,
        selfOwnedAmount,
      },
    };
  });
}
