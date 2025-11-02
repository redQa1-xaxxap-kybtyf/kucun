import type { Prisma, SalesOrder } from '@prisma/client';

import { prisma } from '@/lib/db';

import {
  mapOrderBaseFields,
  mapSalesOrderItem,
  salesOrderItemSelect,
} from './shared';

const detailInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  },
  items: {
    select: salesOrderItemSelect,
  },
  feeItems: {
    select: {
      id: true,
      feeType: true,
      feeName: true,
      feeAmount: true,
      remarks: true,
    },
  },
  returnOrders: {
    where: {
      status: { not: 'cancelled' },
    },
    select: {
      id: true,
      returnNumber: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
} as const;

type SalesOrderDetailResult = Prisma.SalesOrderGetPayload<{
  include: typeof detailInclude;
}>;

const mapReturnOrder = (
  order: SalesOrderDetailResult['returnOrders'][number]
) => ({
  id: order.id,
  returnNumber: order.returnNumber,
  status: order.status,
  createdAt: order.createdAt.toISOString(),
});

const mapDetail = (order: SalesOrderDetailResult) => {
  const { items, returnOrders, _count, ...base } = order;
  const orderBase = mapOrderBaseFields(base);

  return {
    ...orderBase,
    items: items.map(mapSalesOrderItem),
    feeItems: order.feeItems.map(fee => ({
      id: fee.id,
      feeType: fee.feeType,
      feeName: fee.feeName,
      feeAmount: fee.feeAmount,
      remarks: fee.remarks ?? undefined,
    })),
    hasReturnOrder: returnOrders.length > 0,
    returnOrders: returnOrders.map(mapReturnOrder),
    itemCount: _count.items,
  };
};

export async function getSalesOrderById(id: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: detailInclude,
  });

  if (!order) {
    return null;
  }

  return mapDetail(order);
}

/**
 * 获取销售订单详情（含收款统计与收款记录ISO化）
 */
export async function getSalesOrderDetailWithPayments(id: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      ...detailInclude,
      payments: {
        select: {
          id: true,
          paymentNumber: true,
          paymentAmount: true,
          actualPaymentAmount: true,
          roundingAmount: true,
          paymentMethod: true,
          paymentDate: true,
          status: true,
          remarks: true,
          createdAt: true,
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
  });

  if (!order) return null;

  const confirmed = order.payments.filter(p => p.status === 'confirmed');
  const actualPaidAmount = confirmed.reduce(
    (sum, r) => sum + Number(r.actualPaymentAmount),
    0
  );
  const paymentRounding = confirmed.reduce(
    (sum, r) => sum + Number(r.roundingAmount || 0),
    0
  );
  const paidAmount = actualPaidAmount + paymentRounding;

  type SalesOrderAmounts = Pick<
    SalesOrder,
    'totalAmount' | 'roundingAdjustment'
  >;
  const amounts = order as unknown as SalesOrderAmounts;
  const actualTotalAmount =
    Number(amounts.totalAmount) + Number(amounts.roundingAdjustment ?? 0);
  const remainingAmount = Math.max(0, actualTotalAmount - paidAmount);

  const mapped = mapDetail(order as unknown as SalesOrderDetailResult);

  return {
    ...mapped,
    paymentRecords: order.payments.map(p => ({
      ...p,
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    actualPaidAmount,
    paymentRounding,
    paidAmount,
    remainingAmount,
  };
}
