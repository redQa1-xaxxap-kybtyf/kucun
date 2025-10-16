import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { FACTORY_SHIPMENT_ITEM_OWNERSHIP } from '@/lib/types/factory-shipment';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权操作' }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds : [];

    if (itemIds.length === 0) {
      return NextResponse.json(
        { error: '缺少需要更新的明细项' },
        { status: 400 }
      );
    }

    const items = await prisma.factoryShipmentOrderItem.findMany({
      where: {
        id: { in: itemIds },
        factoryShipmentOrderId: id,
      },
      select: {
        id: true,
        ownership: true,
        selfInboundStatus: true,
      },
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: '未找到匹配的自用补货明细' },
        { status: 404 }
      );
    }

    const invalidItems = items.filter(
      item => item.ownership !== FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF
    );

    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: '存在非自用补货明细，无法标记入库' },
        { status: 400 }
      );
    }

    await prisma.factoryShipmentOrderItem.updateMany({
      where: {
        id: { in: items.map(item => item.id) },
      },
      data: {
        selfInboundStatus: 'received',
        inboundReceivedAt: new Date(),
      },
    });

    const order = await prisma.factoryShipmentOrder.findUnique({
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

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    const customerOwnedAmount = order.items
      .filter(item => item.ownership === 'customer')
      .reduce((sum, item) => sum + item.totalPrice, 0);
    const selfOwnedAmount = order.items
      .filter(item => item.ownership === 'self')
      .reduce((sum, item) => sum + item.totalPrice, 0);

    return NextResponse.json({
      ...order,
      fulfillmentSummary: {
        customerOwnedAmount,
        selfOwnedAmount,
      },
    });
  } catch (error) {
    logger.error('factory-shipments', '标记自用货入库失败', error, {
      orderId: id,
    });
    return NextResponse.json(
      { error: '更新自用货入库状态失败' },
      { status: 500 }
    );
  }
}
