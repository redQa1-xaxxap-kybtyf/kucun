// 取消厂家发货订单 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * 取消厂家发货订单
 * POST /api/factory-shipments/[id]/cancel
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权操作' }, { status: 401 });
    }

    // 检查订单是否存在
    const existingOrder = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 验证状态：只能取消草稿、已确认、待发货状态的订单
    if (
      existingOrder.status !== FACTORY_SHIPMENT_STATUS.DRAFT &&
      existingOrder.status !== FACTORY_SHIPMENT_STATUS.CONFIRMED &&
      existingOrder.status !== FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT
    ) {
      return NextResponse.json(
        { error: '只能取消草稿、已确认或待发货的订单' },
        { status: 400 }
      );
    }

    // 更新订单状态为已取消
    await prisma.factoryShipmentOrder.update({
      where: { id },
      data: {
        status: FACTORY_SHIPMENT_STATUS.CANCELLED,
      },
    });

    logger.info('factory-shipments', '取消厂家发货订单成功', {
      orderId: id,
      orderNumber: existingOrder.orderNumber,
      userId: session.user.id,
    });

    return NextResponse.json({
      message: '订单已取消',
      orderId: id,
    });
  } catch (error) {
    logger.error('factory-shipments', '取消厂家发货订单失败', error, {
      orderId: id,
    });

    return NextResponse.json({ error: '取消订单失败' }, { status: 500 });
  }
}
