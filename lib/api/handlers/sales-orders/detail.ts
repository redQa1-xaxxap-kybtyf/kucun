import type { Prisma } from '@prisma/client';

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
    feeItems: order.feeItems,
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
