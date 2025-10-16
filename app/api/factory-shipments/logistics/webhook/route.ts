import { type NextRequest, NextResponse } from 'next/server';

import { updateFactoryShipmentStatus } from '@/lib/api/handlers/factory-shipment-status';
import { prisma } from '@/lib/db';
import { logisticsConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import { withIdempotency } from '@/lib/utils/idempotency';

interface LogisticsEventPayload {
  eventId?: string;
  containerNumber?: string;
  eventType?: string;
  eventTime?: string;
  location?: string;
  remarks?: string;
  metadata?: Record<string, unknown>;
}

const logisticsStatusMap: Record<string, FactoryShipmentStatus> = {
  departed_factory: FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED,
  in_transit: FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  arrived_port: FACTORY_SHIPMENT_STATUS.ARRIVED,
  delivered: FACTORY_SHIPMENT_STATUS.DELIVERED,
};

export async function POST(request: NextRequest) {
  try {
    const secret = logisticsConfig.webhookSecret;
    if (secret) {
      const authHeader = request.headers.get('authorization') || '';
      const expected = `Bearer ${secret}`;
      if (authHeader !== expected) {
        return NextResponse.json(
          { error: '未授权的物流推送' },
          { status: 401 }
        );
      }
    }

    const payload = (await request.json()) as LogisticsEventPayload;
    const { eventId, containerNumber, eventType, eventTime, remarks } = payload;

    if (!containerNumber || !eventType) {
      return NextResponse.json(
        { error: '缺少集装箱号码或事件类型' },
        { status: 400 }
      );
    }

    const targetStatus = logisticsStatusMap[eventType];
    if (!targetStatus) {
      return NextResponse.json(
        { error: `不支持的物流事件类型: ${eventType}` },
        { status: 400 }
      );
    }

    const order = await prisma.factoryShipmentOrder.findFirst({
      where: { containerNumber },
      select: {
        id: true,
        status: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: `未找到集装箱 ${containerNumber} 对应的发货单` },
        { status: 404 }
      );
    }

    if (order.status === targetStatus) {
      return NextResponse.json({ status: 'ignored', orderId: order.id });
    }

    const idempotencyKey =
      eventId ??
      `logistics-${containerNumber}-${eventType}-${eventTime ?? Date.now()}`;

    const parsedEventTime = eventTime
      ? new Date(eventTime)
      : new Date(Date.now());

    let result;
    try {
      result = await withIdempotency(
        idempotencyKey,
        'factory_shipment_status_change',
        order.id,
        'logistics-webhook',
        {
          containerNumber,
          eventType,
          eventTime,
          location: payload.location,
          remarks,
        },
        async () =>
          await updateFactoryShipmentStatus(
            order.id,
            targetStatus,
            order.status,
            {
              containerNumber,
              remarks,
              shipmentDate:
                targetStatus === FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED
                  ? parsedEventTime
                  : undefined,
              arrivalDate:
                targetStatus === FACTORY_SHIPMENT_STATUS.ARRIVED
                  ? parsedEventTime
                  : undefined,
              deliveryDate:
                targetStatus === FACTORY_SHIPMENT_STATUS.DELIVERED
                  ? parsedEventTime
                  : undefined,
            }
          )
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('订单状态不能')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      status: 'ok',
      orderId: order.id,
      nextStatus: targetStatus,
      receivableCreated: result.receivableCreated,
      paymentRecordId: result.paymentRecordId ?? null,
    });
  } catch (error) {
    logger.error('factory-shipments', '物流状态推送处理失败', error);
    return NextResponse.json({ error: '处理物流推送失败' }, { status: 500 });
  }
}
