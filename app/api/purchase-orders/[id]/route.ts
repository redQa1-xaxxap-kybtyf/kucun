import { NextResponse, type NextRequest } from 'next/server';

import {
  calculateOrderTotal,
  updatePurchaseOrderInternal,
} from '@/app/actions/purchase-orders.utils';
import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PURCHASE_ORDER_STATUS } from '@/lib/types/purchase-order';
import {
  updatePurchaseOrderSchema,
  type UpdatePurchaseOrderFormData,
} from '@/lib/validations/purchase-order-form';

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
      return NextResponse.json(
        { success: false, error: '采购订单不存在' },
        { status: 404 }
      );
    }

    const expenses = await prisma.expenseRecord.findMany({
      where: {
        relatedType: 'purchase_order',
        relatedId: orderId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        expenseNumber: true,
        expenseType: true,
        expenseName: true,
        expenseAmount: true,
        expenseDate: true,
        relatedType: true,
        relatedId: true,
        relatedNumber: true,
        remarks: true,
        attachments: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 5000,
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
    return NextResponse.json(
      { success: false, error: '获取订单详情失败' },
      { status: 500 }
    );
  }
});

const handleUpdate = withAuth(async (request: NextRequest, context) => {
  const { user } = context;
  const { id: orderId } = await resolveOrderParams(context.params);

  try {
    const body = (await request.json()) as unknown;
    const parsed = updatePurchaseOrderSchema.parse(
      body
    ) as UpdatePurchaseOrderFormData;
    const items = parsed.items ?? [];
    const totalAmount = calculateOrderTotal(items);

    const result = await updatePurchaseOrderInternal({
      orderId,
      data: parsed,
      items,
      totalAmount,
      userId: user.id,
    });

    if (!result.success) {
      const statusCode = result.validationErrors ? 422 : 400;
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          validationErrors: result.validationErrors,
        },
        { status: statusCode }
      );
    }

    const updatedOrder = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });

    if (!updatedOrder) {
      return NextResponse.json(
        { success: false, error: '采购订单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updatedOrder });
  } catch (error) {
    logger.error('purchase-orders', '更新采购订单失败', error, {
      userId: user.id,
      orderId,
    });
    return NextResponse.json(
      { success: false, error: '更新订单失败' },
      { status: 500 }
    );
  }
});

export const PUT = handleUpdate;
export const PATCH = handleUpdate;

export const DELETE = withAuth(async (_request: NextRequest, context) => {
  const { user } = context;
  const { id: orderId } = await resolveOrderParams(context.params);
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '采购订单不存在' },
        { status: 404 }
      );
    }

    if (order.status !== PURCHASE_ORDER_STATUS.DRAFT) {
      return NextResponse.json(
        { success: false, error: '只能删除草稿状态的订单' },
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
    return NextResponse.json(
      { success: false, error: '删除订单失败' },
      { status: 500 }
    );
  }
});
