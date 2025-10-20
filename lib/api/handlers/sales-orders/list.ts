import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type { SalesOrderQueryParams } from '@/lib/types/sales-order';

import {
  mapOrderBaseFields,
  mapSalesOrderItem,
  salesOrderRelations,
} from './shared';

const listInclude = {
  ...salesOrderRelations,
  payments: {
    where: { status: 'confirmed' },
    select: { paymentAmount: true },
  },
  returnOrders: {
    where: {
      status: { not: 'cancelled' },
    },
    select: { id: true },
    take: 1,
  },
} as const;

type SalesOrderListResult = Prisma.SalesOrderGetPayload<{
  include: typeof listInclude;
}>;

const sortableFields: Record<
  NonNullable<SalesOrderQueryParams['sortBy']>,
  keyof Prisma.SalesOrderOrderByWithRelationInput
> = {
  orderNumber: 'orderNumber',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  totalAmount: 'totalAmount',
  status: 'status',
};

const DEFAULT_SORT_FIELD: keyof Prisma.SalesOrderOrderByWithRelationInput =
  'createdAt';
const DEFAULT_SORT_ORDER: Prisma.SortOrder = 'desc';

const buildDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) {
    return undefined;
  }

  const range: Prisma.DateTimeFilter = {};

  if (startDate) {
    range.gte = new Date(`${startDate}T00:00:00`);
  }

  if (endDate) {
    range.lte = new Date(`${endDate}T23:59:59`);
  }

  return range;
};

const buildWhere = ({
  search,
  status,
  customerId,
  startDate,
  endDate,
}: SalesOrderQueryParams): Prisma.SalesOrderWhereInput => {
  const where: Prisma.SalesOrderWhereInput = {};

  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { phone: { contains: search } } },
      { customer: { address: { contains: search } } },
      { remarks: { contains: search } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  const dateRange = buildDateRange(startDate, endDate);
  if (dateRange) {
    where.createdAt = dateRange;
  }

  return where;
};

const buildOrderBy = (params: SalesOrderQueryParams) => {
  const orderBy: Prisma.SalesOrderOrderByWithRelationInput = {};
  const field =
    (params.sortBy && sortableFields[params.sortBy]) ?? DEFAULT_SORT_FIELD;

  orderBy[field] = params.sortOrder ?? DEFAULT_SORT_ORDER;

  return orderBy;
};

const mapListOrder = (order: SalesOrderListResult) => {
  const { payments, returnOrders, _count, items, ...base } = order;
  const orderBase = mapOrderBaseFields(base);
  const paidAmount = payments.reduce(
    (sum, payment) => sum + Number(payment.paymentAmount),
    0
  );

  return {
    ...orderBase,
    items: items.map(mapSalesOrderItem),
    itemCount: _count.items,
    paidAmount,
    remainingAmount: Number(order.totalAmount) - paidAmount,
    hasReturnOrder: returnOrders.length > 0,
  };
};

export async function getSalesOrders(params: SalesOrderQueryParams) {
  const { page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;
  const where = buildWhere(params);
  const orderBy = buildOrderBy(params);

  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: listInclude,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return {
    data: orders.map(mapListOrder),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
