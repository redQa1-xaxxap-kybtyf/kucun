// 厂家发货订单状态更新 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { updateFactoryShipmentStatus } from '@/lib/api/handlers/factory-shipment-status';
import { authOptions } from '@/lib/auth';
import { updateFactoryShipmentOrderStatusSchema } from '@/lib/schemas/factory-shipment';
import { withIdempotency } from '@/lib/utils/idempotency';

interface RouteParams {
  params: {
    id: string;
  };
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
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = params;

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = updateFactoryShipmentOrderStatusSchema.parse(body);
    const {
      idempotencyKey,
      status,
      containerNumber,
      remarks,
      shipmentDate,
      arrivalDate,
      deliveryDate,
      completionDate,
    } = validatedData;

    // 获取当前订单状态
    const { prisma } = await import('@/lib/db');
    const existingOrder = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      select: { status: true, orderNumber: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 使用幂等性包装器更新状态
    const result = await withIdempotency(
      idempotencyKey,
      'factory_shipment_status_change',
      id,
      session.user.id,
      {
        status,
        containerNumber,
        remarks,
        shipmentDate,
        arrivalDate,
        deliveryDate,
        completionDate,
      },
      async () =>
        await updateFactoryShipmentStatus(id, status, existingOrder.status, {
          containerNumber,
          remarks,
          shipmentDate,
          arrivalDate,
          deliveryDate,
          completionDate,
        })
    );

    // 获取更新后的完整订单信息
    const updatedOrder = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, address: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
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

    return NextResponse.json({
      ...updatedOrder,
      receivableCreated: result.receivableCreated,
    });
  } catch (error) {
    console.error('更新厂家发货订单状态失败:', error);

    // 处理验证错误
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

    return NextResponse.json(
      { error: '更新订单状态失败' },
      { status: 500 }
    );
  }
}

