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
  departed_factory: FACTORY_SHIPMENT_STATUS.SHIPPED,
  in_transit: FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  arrived_port: FACTORY_SHIPMENT_STATUS.ARRIVED,
};

function isAuthorized(request: NextRequest, secret?: string): boolean {
  if (!secret) return true;
  const authHeader = request.headers.get('authorization') || '';
  return authHeader === `Bearer ${secret}`;
}

function computeIdempotencyKey(
  containerNumber: string,
  eventType: string,
  eventTime?: string,
  eventId?: string
) {
  return (
    eventId ??
    `logistics-${containerNumber}-${eventType}-${eventTime ?? Date.now()}`
  );
}

function parseEventTime(eventTime?: string) {
  return eventTime ? new Date(eventTime) : new Date(Date.now());
}

type ValidatedPayload = {
  eventId?: string;
  containerNumber: string;
  eventType: string;
  eventTime?: string;
  remarks?: string;
  location?: string;
  targetStatus: FactoryShipmentStatus;
};

function ensureValidPayload(payload: LogisticsEventPayload): ValidatedPayload {
  const { eventId, containerNumber, eventType, eventTime, remarks, location } =
    payload;
  if (!containerNumber || !eventType) {
    throw new Error('缺少集装箱号码或事件类型');
  }
  const targetStatus = logisticsStatusMap[eventType];
  if (!targetStatus) {
    throw new Error(`不支持的物流事件类型: ${eventType}`);
  }
  return {
    eventId,
    containerNumber,
    eventType,
    eventTime,
    remarks,
    location,
    targetStatus,
  };
}

async function findOrderByContainer(containerNumber: string) {
  return prisma.factoryShipmentOrder.findFirst({
    where: { containerNumber },
    select: { id: true, status: true },
  });
}

async function applyStatusUpdateIdempotent(
  orderId: string,
  previousStatus: FactoryShipmentStatus,
  idempotencyKey: string,
  data: {
    containerNumber: string;
    targetStatus: FactoryShipmentStatus;
    eventType: string;
    eventTime?: string;
    remarks?: string;
    location?: string;
    parsedEventTime: Date;
  }
) {
  const {
    containerNumber,
    targetStatus,
    eventType,
    eventTime,
    remarks,
    location,
    parsedEventTime,
  } = data;
  return withIdempotency(
    idempotencyKey,
    'factory_shipment_status_change',
    orderId,
    'logistics-webhook',
    { containerNumber, eventType, eventTime, location, remarks },
    async () =>
      await updateFactoryShipmentStatus(orderId, targetStatus, previousStatus, {
        containerNumber,
        remarks,
        shipmentDate:
          targetStatus === FACTORY_SHIPMENT_STATUS.SHIPPED
            ? parsedEventTime
            : undefined,
        arrivalDate:
          targetStatus === FACTORY_SHIPMENT_STATUS.ARRIVED
            ? parsedEventTime
            : undefined,
      })
  );
}

export async function POST(request: NextRequest) {
  try {
    const secret = logisticsConfig.webhookSecret;
    if (!isAuthorized(request, secret)) {
      return NextResponse.json({ error: '未授权的物流推送' }, { status: 401 });
    }

    const payload = (await request.json()) as LogisticsEventPayload;
    let parsed;
    try {
      parsed = ensureValidPayload(payload);
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }

    const order = await findOrderByContainer(parsed.containerNumber);

    if (!order) {
      return NextResponse.json(
        { error: `未找到集装箱 ${parsed.containerNumber} 对应的发货单` },
        { status: 404 }
      );
    }

    if (order.status === parsed.targetStatus) {
      return NextResponse.json({ status: 'ignored', orderId: order.id });
    }

    const idempotencyKey = computeIdempotencyKey(
      parsed.containerNumber,
      parsed.eventType,
      parsed.eventTime ?? undefined,
      parsed.eventId
    );

    const parsedEventTime = parseEventTime(parsed.eventTime ?? undefined);

    let result;
    try {
      result = await applyStatusUpdateIdempotent(
        order.id,
        order.status as FactoryShipmentStatus,
        idempotencyKey,
        {
          containerNumber: parsed.containerNumber,
          targetStatus: parsed.targetStatus,
          eventType: parsed.eventType,
          eventTime: parsed.eventTime,
          remarks: parsed.remarks,
          location: parsed.location,
          parsedEventTime,
        }
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
      nextStatus: parsed.targetStatus,
      receivableCreated: result.receivableCreated,
      paymentRecordId: result.paymentRecordId ?? null,
      payableCreated: result.payableCreated,
      payableRecordIds: result.payableRecordIds ?? [],
    });
  } catch (error) {
    logger.error('factory-shipments', '物流状态推送处理失败', error);
    return NextResponse.json({ error: '处理物流推送失败' }, { status: 500 });
  }
}
