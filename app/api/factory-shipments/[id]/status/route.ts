// 厂家发货订单状态更新 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import { type PrismaClient } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';

import { updateFactoryShipmentStatus } from '@/lib/api/handlers/factory-shipment-status';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';
import { withIdempotency } from '@/lib/utils/idempotency';
import {
  updateFactoryShipmentOrderStatusSchema,
  type UpdateFactoryShipmentOrderStatusData,
} from '@/lib/validations/factory-shipment';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 更新厂家发货订单状态
 * PATCH /api/factory-shipments/[id]/status
 *
 * 功能：
 * - 更新订单状态（如：确认发货、到港、收货等）
 * - 验证状态流转规则
 * - 确认发货时必须填写集装箱号码
 * - 使用幂等性保护防止重复操作
 * - 自动创建应收账款记录（确认发货时）
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权操作' }, { status: 401 });
    }

    const validated = await parseAndValidateRequest(request);
    const prisma = (await import('@/lib/db')).prisma;
    const existingOrder = await ensureOrderExists(prisma, id);
    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    const dateFields = convertDateFields(validated);
    const enableSmartTransition =
      validated.status === FACTORY_SHIPMENT_STATUS.SHIPPED;

    const result = await applyStatusUpdate({
      id,
      userId,
      existingStatus: existingOrder.status,
      enableSmartTransition,
      payload: dateFields,
    });

    const updatedOrder = await fetchOrderWithRelations(prisma, id);

    return NextResponse.json({
      ...updatedOrder,
      receivableCreated: result.receivableCreated,
      paymentRecordId: result.paymentRecordId ?? null,
    });
  } catch (error) {
    logger.error('factory-shipments', '更新厂家发货订单状态失败', error, {
      orderId: id,
    });

    if (error instanceof Error) {
      if (error.message.includes('状态流转')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes('集装箱号码')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes('幂等性')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }

    return NextResponse.json({ error: '更新订单状态失败' }, { status: 500 });
  }
}

async function resolveUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function parseAndValidateRequest(request: NextRequest) {
  const body = await request.json();
  return updateFactoryShipmentOrderStatusSchema.parse(body);
}

type ConvertedStatusPayload = {
  idempotencyKey: string;
  status: UpdateFactoryShipmentOrderStatusData['status'];
  containerNumber?: string;
  shippingCompany?: string;
  remarks?: string;
  shipmentDate?: Date;
  arrivalDate?: Date;
  deliveryDate?: Date;
  completionDate?: Date;
  estimatedArrival?: Date;
};

function convertDateFields(
  data: UpdateFactoryShipmentOrderStatusData
): ConvertedStatusPayload {
  const toDate = (value?: string | null) =>
    value ? new Date(value) : undefined;
  const toOptionalString = (value?: string | null) =>
    value && value.trim().length > 0 ? value : undefined;

  return {
    status: data.status,
    containerNumber: toOptionalString(data.containerNumber),
    shippingCompany: toOptionalString(data.shippingCompany),
    remarks: toOptionalString(data.remarks),
    shipmentDate: toDate(data.shipmentDate),
    arrivalDate: toDate(data.arrivalDate),
    deliveryDate: toDate(data.deliveryDate),
    completionDate: toDate(data.completionDate),
    estimatedArrival: toDate(data.estimatedArrival),
    idempotencyKey: data.idempotencyKey,
  };
}

async function ensureOrderExists(prisma: PrismaClient, id: string) {
  return prisma.factoryShipmentOrder.findUnique({
    where: { id },
    select: { status: true, orderNumber: true },
  });
}

async function applyStatusUpdate({
  id,
  userId,
  existingStatus,
  enableSmartTransition,
  payload,
}: {
  id: string;
  userId: string;
  existingStatus: string;
  enableSmartTransition: boolean;
  payload: ConvertedStatusPayload;
}) {
  return withIdempotency(
    payload.idempotencyKey,
    'factory_shipment_status_change',
    id,
    userId,
    {
      status: payload.status,
      containerNumber: payload.containerNumber,
      remarks: payload.remarks,
      shipmentDate: payload.shipmentDate,
      arrivalDate: payload.arrivalDate,
      deliveryDate: payload.deliveryDate,
      completionDate: payload.completionDate,
      estimatedArrival: payload.estimatedArrival,
    },
    async () =>
      await updateFactoryShipmentStatus(
        id,
        payload.status,
        existingStatus,
        {
          containerNumber: payload.containerNumber,
          shippingCompany: payload.shippingCompany,
          remarks: payload.remarks,
          shipmentDate: payload.shipmentDate,
          arrivalDate: payload.arrivalDate,
          deliveryDate: payload.deliveryDate,
          completionDate: payload.completionDate,
          estimatedArrival: payload.estimatedArrival,
        },
        false,
        enableSmartTransition
      )
  );
}

async function fetchOrderWithRelations(prisma: PrismaClient, id: string) {
  return prisma.factoryShipmentOrder.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, address: true },
      },
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
              weight: true,
            },
          },
          supplier: {
            select: { id: true, name: true, phone: true, address: true },
          },
        },
      },
    },
  });
}
