// 厂家发货订单状态更新 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import { type PrismaClient } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { updateFactoryShipmentStatus } from '@/lib/api/handlers/factory-shipment-status';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';
import { withIdempotency } from '@/lib/utils/idempotency-redis';
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
  console.log(
    '[DEBUG] PATCH /api/factory-shipments/[id]/status - 开始处理请求, orderId:',
    id
  );

  try {
    const userId = await resolveUserId();
    console.log('[DEBUG] 用户认证结果, userId:', userId);

    if (!userId) {
      console.log('[DEBUG] 用户未授权');
      return NextResponse.json(
        { error: '未授权操作', message: '未授权操作' },
        { status: 401 }
      );
    }

    console.log('[DEBUG] 开始验证请求数据');
    const validated = await parseAndValidateRequest(request);
    console.log(
      '[DEBUG] 请求数据验证通过, idempotencyKey:',
      validated.idempotencyKey
    );
    const prisma = (await import('@/lib/db')).prisma;
    console.log('[DEBUG] 检查订单是否存在');
    const existingOrder = await ensureOrderExists(prisma, id);
    if (!existingOrder) {
      console.log('[DEBUG] 订单不存在, orderId:', id);
      return NextResponse.json(
        {
          error: '订单不存在',
          message: '订单不存在',
        },
        { status: 404 }
      );
    }
    console.log('[DEBUG] 订单存在, 当前状态:', existingOrder.status);

    const dateFields = convertDateFields(validated);
    const enableSmartTransition =
      validated.status === FACTORY_SHIPMENT_STATUS.SHIPPED;

    console.log('[DEBUG] 准备更新订单状态:', {
      targetStatus: validated.status,
      enableSmartTransition,
      currentStatus: existingOrder.status,
    });

    const result = await applyStatusUpdate({
      id,
      userId,
      existingStatus: existingOrder.status,
      enableSmartTransition,
      payload: dateFields,
    });

    console.log('[DEBUG] 订单状态更新成功, 结果:', {
      receivableCreated: result.receivableCreated,
      payableCreated: result.payableCreated,
    });

    console.log('[DEBUG] 获取更新后的订单详情');
    const updatedOrder = await fetchOrderWithRelations(prisma, id);
    console.log('[DEBUG] 订单详情获取成功');

    return NextResponse.json({
      ...updatedOrder,
      receivableCreated: result.receivableCreated,
      paymentRecordId: result.paymentRecordId ?? null,
      payableCreated: result.payableCreated,
      payableRecordIds: result.payableRecordIds ?? [],
    });
  } catch (error) {
    logger.error('factory-shipments', '更新厂家发货订单状态失败', error, {
      orderId: id,
    });

    if (error instanceof Error) {
      console.error('[DEBUG] 错误详情:', error.message, error.stack);

      if (error.message.includes('数据验证失败')) {
        return NextResponse.json(
          {
            error: error.message,
            message: error.message,
          },
          { status: 422 }
        );
      }
      if (error.message.includes('状态流转')) {
        return NextResponse.json(
          {
            error: error.message,
            message: error.message,
          },
          { status: 400 }
        );
      }
      if (error.message.includes('集装箱号码')) {
        return NextResponse.json(
          {
            error: error.message,
            message: error.message,
          },
          { status: 400 }
        );
      }
      if (error.message.includes('幂等性')) {
        return NextResponse.json(
          {
            error: error.message,
            message: error.message,
          },
          { status: 409 }
        );
      }

      // 返回通用错误信息
      return NextResponse.json(
        {
          error: error.message,
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: '更新订单状态失败',
        message: '更新订单状态失败',
      },
      { status: 500 }
    );
  }
}

async function resolveUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function parseAndValidateRequest(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[DEBUG] 接收到的请求数据:', JSON.stringify(body, null, 2));
    const validated = updateFactoryShipmentOrderStatusSchema.parse(body);
    console.log('[DEBUG] 验证通过的数据:', JSON.stringify(validated, null, 2));
    return validated;
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as {
        issues: Array<{ path: (string | number)[]; message: string }>;
      };
      console.error(
        '[DEBUG] Zod 验证失败:',
        JSON.stringify(zodError.issues, null, 2)
      );
      throw new Error(
        `数据验证失败: ${zodError.issues.map((i: { message: string }) => i.message).join(', ')}`
      );
    }
    throw error;
  }
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
