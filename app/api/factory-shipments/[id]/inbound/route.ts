import { type NextRequest, NextResponse } from 'next/server';

import {
  executeMinimalInboundTransaction,
  type MinimalInboundTransactionResult,
} from '@/lib/api/minimal-inbound-transaction';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { FACTORY_SHIPMENT_ITEM_OWNERSHIP } from '@/lib/types/factory-shipment';
import { toNumber } from '@/lib/utils/number';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未授权操作' },
      { status: 401 }
    );
  }

  const { id } = params;

  try {
    const body = await request.json();
    const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds : [];
    const uniqueItemIds = Array.from(new Set(itemIds));

    if (uniqueItemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少需要更新的明细项' },
        { status: 400 }
      );
    }

    const inboundResults: MinimalInboundTransactionResult[] = [];

    await prisma.$transaction(async tx => {
      const order = await tx.factoryShipmentOrder.findUnique({
        where: { id },
        select: {
          id: true,
          orderNumber: true,
          items: {
            where: { id: { in: uniqueItemIds } },
            select: {
              id: true,
              ownership: true,
              selfInboundStatus: true,
              inboundReceivedAt: true,
              productId: true,
              supplierId: true,
              quantity: true,
              unitCost: true,
              batchNumber: true,
              isManualProduct: true,
              temporaryProductId: true,
              displayName: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('NOT_FOUND:订单不存在');
      }

      const foundIds = new Set(order.items.map(item => item.id));
      const missingIds = uniqueItemIds.filter(itemId => !foundIds.has(itemId));
      if (missingIds.length > 0) {
        throw new Error(
          `NOT_FOUND:未找到匹配的自用补货明细: ${missingIds.join(', ')}`
        );
      }

      const invalidItems = order.items.filter(
        item => item.ownership !== FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF
      );
      if (invalidItems.length > 0) {
        throw new Error('BAD_REQUEST:存在非自用补货明细，无法标记入库');
      }

      for (const item of order.items) {
        if (item.selfInboundStatus === 'received') {
          continue;
        }

        if (
          !item.productId ||
          item.isManualProduct ||
          item.temporaryProductId
        ) {
          throw new Error(
            `BAD_REQUEST:自用补货明细缺少标准产品信息，无法入库: ${item.displayName}`
          );
        }

        const unitCost = toNumber(item.unitCost, Number.NaN);
        if (!Number.isFinite(unitCost) || unitCost <= 0) {
          throw new Error(
            `BAD_REQUEST:自用补货明细缺少有效成本，无法入库: ${item.displayName}`
          );
        }

        const quantity = Number(item.quantity ?? 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          continue;
        }

        const markResult = await tx.factoryShipmentOrderItem.updateMany({
          where: {
            id: item.id,
            factoryShipmentOrderId: order.id,
            ownership: FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF,
            selfInboundStatus: { not: 'received' },
          },
          data: {
            selfInboundStatus: 'received',
            inboundReceivedAt: new Date(),
          },
        });

        if (markResult.count === 0) {
          continue;
        }

        const inbound = await executeMinimalInboundTransaction(
          {
            productId: item.productId,
            quantity,
            unitCost,
            reason: 'purchase',
            remarks: `厂家发货单${order.orderNumber}自用补货入库`,
            batchNumber: item.batchNumber ?? '',
            userId: session.user.id,
            supplierId: item.supplierId,
          },
          { tx }
        );

        inboundResults.push(inbound);
      }
    });

    if (inboundResults.length > 0) {
      const productIds = Array.from(
        new Set(inboundResults.map(record => record.productId))
      );
      const { invalidateInventoryCache, revalidateProducts } = await import(
        '@/lib/cache'
      );

      await Promise.allSettled([
        ...productIds.map(productId => invalidateInventoryCache(productId)),
        ...productIds.map(productId => revalidateProducts(productId)),
      ]);
    }

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
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    const customerOwnedAmount = order.items
      .filter(item => item.ownership === 'customer')
      .reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const selfOwnedAmount = order.items
      .filter(item => item.ownership === 'self')
      .reduce((sum, item) => sum + Number(item.totalPrice), 0);

    return NextResponse.json({
      ...order,
      fulfillmentSummary: {
        customerOwnedAmount,
        selfOwnedAmount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.startsWith('NOT_FOUND:')) {
      return NextResponse.json(
        { success: false, error: message.slice('NOT_FOUND:'.length) },
        { status: 404 }
      );
    }

    if (message.startsWith('BAD_REQUEST:')) {
      return NextResponse.json(
        { success: false, error: message.slice('BAD_REQUEST:'.length) },
        { status: 400 }
      );
    }

    logger.error('factory-shipments', '标记自用货入库失败', error, {
      orderId: id,
    });
    return NextResponse.json(
      { success: false, error: '更新自用货入库状态失败' },
      { status: 500 }
    );
  }
}
