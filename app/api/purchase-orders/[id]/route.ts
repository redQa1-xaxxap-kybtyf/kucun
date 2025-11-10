import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PURCHASE_ORDER_STATUS } from '@/lib/types/purchase-order';
import { updatePurchaseOrderSchema } from '@/lib/validations/purchase-order';

type PurchaseOrderParams = { id: string };

async function resolveOrderParams(
  params?: Promise<Record<string, string>> | Record<string, string>
): Promise<PurchaseOrderParams> {
  const resolved = await resolveParams<Record<string, string>>(params);
  if (!resolved.id) {
    throw new Error('缺少订单ID参数');
  }
  return { id: resolved.id };
}

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

export const GET = withAuth(async (_request: NextRequest, context) => {
  const { user } = context;
  const { id: orderId } = await resolveOrderParams(context.params);
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });

    if (!order) {
      return NextResponse.json({ error: '采购订单不存在' }, { status: 404 });
    }

    const expenses = await prisma.expenseRecord.findMany({
      where: {
        relatedType: 'purchase_order',
        relatedId: orderId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const serializedExpenses = expenses.map(expense => ({
      id: expense.id,
      expenseNumber: expense.expenseNumber,
      expenseType: expense.expenseType,
      expenseName: expense.expenseName,
      expenseAmount: expense.expenseAmount,
      expenseDate: expense.expenseDate.toISOString(),
      relatedType: expense.relatedType,
      relatedId: expense.relatedId,
      relatedNumber: expense.relatedNumber,
      containerNumber:
        expense.expenseType === 'shipping' &&
        expense.relatedType === 'purchase_order'
          ? order.containerNumber
          : null,
      remarks: expense.remarks,
      attachments: expense.attachments,
      userId: expense.userId,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      data: {
        ...order,
        expenses: serializedExpenses,
      },
    });
  } catch (error) {
    logger.error('purchase-orders', '获取采购订单详情失败', error, {
      userId: user.id,
      orderId,
    });
    return NextResponse.json({ error: '获取订单详情失败' }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: NextRequest, context) => {
  const { user } = context;
  const { id: orderId } = await resolveOrderParams(context.params);
  try {
    const body = await request.json();
    const validatedData = updatePurchaseOrderSchema.parse(body);

    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: '采购订单不存在' }, { status: 404 });
    }

    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id: orderId },
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
      orderId,
    });
    return NextResponse.json({ error: '更新订单失败' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_request: NextRequest, context) => {
  const { user } = context;
  const { id: orderId } = await resolveOrderParams(context.params);
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
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
          relatedId: orderId,
        },
      });

      await tx.purchaseOrder.delete({
        where: { id: orderId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('purchase-orders', '删除采购订单失败', error, {
      userId: user.id,
      orderId,
    });
    return NextResponse.json({ error: '删除订单失败' }, { status: 500 });
  }
});
