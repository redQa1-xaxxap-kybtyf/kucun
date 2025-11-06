import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PURCHASE_ORDER_STATUS } from '@/lib/types/purchase-order';
import { updatePurchaseOrderSchema } from '@/lib/validations/purchase-order';

const orderDetailSelect = {
  id: true,
  orderNumber: true,
  containerNumber: true,
  supplierId: true,
  userId: true,
  status: true,
  totalAmount: true,
  expenseAmount: true,
  costAmount: true,
  orderDate: true,
  shipmentDate: true,
  estimatedArrival: true,
  arrivalDate: true,
  shippingCompany: true,
  lastShippingQueryAt: true,
  shippingQueryStatus: true,
  shippingQueryError: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
  supplier: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      contactPerson: true,
    },
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
};

export const GET = withAuth(
  async (
    _request: NextRequest,
    { user, params }: { user: { id: string }; params: { id: string } }
  ) => {
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id: params.id },
        select: orderDetailSelect,
      });

      if (!order) {
        return NextResponse.json({ error: '采购订单不存在' }, { status: 404 });
      }

      return NextResponse.json({ data: order });
    } catch (error) {
      logger.error('purchase-orders', '获取采购订单详情失败', error, {
        userId: user.id,
        orderId: params.id,
      });
      return NextResponse.json({ error: '获取订单详情失败' }, { status: 500 });
    }
  }
);

export const PUT = withAuth(
  async (
    request: NextRequest,
    { user, params }: { user: { id: string }; params: { id: string } }
  ) => {
    try {
      const body = await request.json();
      const validatedData = updatePurchaseOrderSchema.parse(body);

      const existingOrder = await prisma.purchaseOrder.findUnique({
        where: { id: params.id },
      });

      if (!existingOrder) {
        return NextResponse.json({ error: '采购订单不存在' }, { status: 404 });
      }

      const updatedOrder = await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: {
          containerNumber: validatedData.containerNumber?.trim() || null,
          remarks: validatedData.remarks?.trim() || null,
          orderDate: validatedData.orderDate
            ? new Date(validatedData.orderDate)
            : undefined,
          shipmentDate: validatedData.shipmentDate
            ? new Date(validatedData.shipmentDate)
            : undefined,
          estimatedArrival: validatedData.estimatedArrival
            ? new Date(validatedData.estimatedArrival)
            : undefined,
        },
        select: orderDetailSelect,
      });

      return NextResponse.json({ data: updatedOrder });
    } catch (error) {
      logger.error('purchase-orders', '更新采购订单失败', error, {
        userId: user.id,
        orderId: params.id,
      });
      return NextResponse.json({ error: '更新订单失败' }, { status: 500 });
    }
  }
);

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    { user, params }: { user: { id: string }; params: { id: string } }
  ) => {
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id: params.id },
      });

      if (!order) {
        return NextResponse.json({ error: '采购订单不存在' }, { status: 404 });
      }

      if (order.status !== PURCHASE_ORDER_STATUS.DRAFT) {
        return NextResponse.json(
          { error: '只能删除草稿状态的订单' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async tx => {
        await tx.expenseRecord.deleteMany({
          where: {
            relatedType: 'purchase_order',
            relatedId: params.id,
          },
        });

        await tx.purchaseOrder.delete({
          where: { id: params.id },
        });
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('purchase-orders', '删除采购订单失败', error, {
        userId: user.id,
        orderId: params.id,
      });
      return NextResponse.json({ error: '删除订单失败' }, { status: 500 });
    }
  }
);
