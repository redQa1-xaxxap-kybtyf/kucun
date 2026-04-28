import type { Prisma } from '@prisma/client';

import { buildDateTimeRangeFromDateStrings } from '@/lib/api/date-range';
import { prisma } from '@/lib/db';
import { calculateSalesOrderSettledAmount } from '@/lib/services/sales-order-settlement';
import { getSystemMode } from '@/lib/services/system-mode-service';
import {
  SALES_ORDER_PENDING_FILTER_STATUSES,
  type SalesOrderStatus,
  type SalesOrderQueryParams,
} from '@/lib/types/sales-order';
import { getSalesOrderReceivableTotal } from '@/lib/utils/sample-order';

import {
  mapOrderBaseFields,
  mapSalesOrderItem,
  salesOrderRelations,
} from './shared';

const listInclude = {
  ...salesOrderRelations,
  payments: {
    where: { status: { in: ['confirmed', 'applied'] as string[] } },
    select: {
      status: true,
      paymentAmount: true,
      actualPaymentAmount: true,
      roundingAmount: true,
      remarks: true,
    },
  },
  prepaymentUsages: {
    select: { appliedAmount: true },
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
  orderDate: 'orderDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  totalAmount: 'totalAmount',
  status: 'status',
  shippedAt: 'shippedAt',
};

const DEFAULT_SORT_FIELD: keyof Prisma.SalesOrderOrderByWithRelationInput =
  'orderDate';
const DEFAULT_SORT_ORDER: Prisma.SortOrder = 'desc';
const DEFAULT_PRIORITY_STATUS_GROUPS = [
  ['draft'],
  ['confirmed'],
  ['shipped'],
  ['completed'],
  ['cancelled'],
] as const satisfies readonly (readonly SalesOrderStatus[])[];
const PENDING_PRIORITY_STATUS_GROUPS = [
  ['draft'],
  ['confirmed'],
] as const satisfies readonly (readonly SalesOrderStatus[])[];

const buildWhere = (
  {
    search,
    status,
    customerId,
    userId,
    startDate,
    endDate,
    orderType,
    isSampleOrder,
    hasReturns,
    recordScope,
    includeTest,
    includeVoided,
  }: SalesOrderQueryParams,
  systemMode: 'trial' | 'production'
): Prisma.SalesOrderWhereInput => {
  const where: Prisma.SalesOrderWhereInput = {};

  if (!includeVoided) {
    where.voidedAt = null;
  }

  if (recordScope === 'history') {
    where.dataTag = 'import';
  } else if (systemMode === 'production' && !includeTest) {
    where.dataTag = 'prod';
  }

  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { importKey: { contains: search } },
      { customer: { name: { contains: search } } },
      { customer: { phone: { contains: search } } },
      { customer: { address: { contains: search } } },
      { remarks: { contains: search } },
      // 增加对产品编码的搜索支持
      { items: { some: { product: { code: { contains: search } } } } },
      { items: { some: { product: { name: { contains: search } } } } },
      // 增加对批次号的搜索支持
      { items: { some: { batchNumber: { contains: search } } } },
    ];
  }

  if (status) {
    where.status =
      status === 'pending'
        ? { in: [...SALES_ORDER_PENDING_FILTER_STATUSES] }
        : status;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  // ✅ P0修复: 添加 userId 筛选支持
  // 修复前：userId 参数被完全忽略，导致按销售员过滤永远返回全部订单
  // 修复后：支持按销售员筛选，用于销售报表和权限控制
  if (userId) {
    where.userId = userId;
  }

  if (orderType) {
    where.orderType = orderType;
  }

  if (isSampleOrder !== undefined) {
    where.isSampleOrder = isSampleOrder;
  }

  if (hasReturns) {
    where.returnOrders = {
      some: {
        status: { not: 'cancelled' },
      },
    };
  }

  const dateRange = buildDateTimeRangeFromDateStrings(startDate, endDate);
  if (dateRange) {
    where.orderDate = dateRange;
  }

  return where;
};

const buildOrderBy = (params: SalesOrderQueryParams) => {
  const orderBy: Prisma.SalesOrderOrderByWithRelationInput = {};
  const field =
    (params.sortBy && sortableFields[params.sortBy]) ?? DEFAULT_SORT_FIELD;

  orderBy[field] = params.sortOrder ?? DEFAULT_SORT_ORDER;

  return [
    orderBy,
    { id: 'desc' },
  ] satisfies Prisma.SalesOrderOrderByWithRelationInput[];
};

const buildInGroupOrderBy = (
  params: SalesOrderQueryParams
): Prisma.SalesOrderOrderByWithRelationInput[] => {
  const sortOrder = params.sortOrder ?? DEFAULT_SORT_ORDER;
  const prioritizedSortField: keyof Prisma.SalesOrderOrderByWithRelationInput =
    params.sortBy === 'createdAt' ? 'createdAt' : 'orderDate';

  return [
    { [prioritizedSortField]: sortOrder },
    { id: sortOrder },
  ] satisfies Prisma.SalesOrderOrderByWithRelationInput[];
};

const shouldUsePrioritizedStatusOrdering = (params: SalesOrderQueryParams) => {
  const sortField = params.sortBy ?? DEFAULT_SORT_FIELD;

  return (
    params.recordScope !== 'history' &&
    (sortField === 'orderDate' || sortField === 'createdAt') &&
    (params.status === undefined || params.status === 'pending')
  );
};

const getPriorityStatusGroups = (
  status: SalesOrderQueryParams['status']
): readonly (readonly SalesOrderStatus[])[] =>
  status === 'pending'
    ? PENDING_PRIORITY_STATUS_GROUPS
    : DEFAULT_PRIORITY_STATUS_GROUPS;

const countStatuses = (
  groups: readonly (readonly SalesOrderStatus[])[],
  countsByStatus: Map<string, number>
) =>
  groups.reduce(
    (sum, statuses) =>
      sum +
      statuses.reduce(
        (groupSum, status) => groupSum + (countsByStatus.get(status) ?? 0),
        0
      ),
    0
  );

async function getPrioritizedSalesOrders(
  params: SalesOrderQueryParams,
  systemMode: 'trial' | 'production'
) {
  const { page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;
  const baseWhere = buildWhere({ ...params, status: undefined }, systemMode);
  const priorityStatusGroups = getPriorityStatusGroups(params.status);
  const priorityStatuses = priorityStatusGroups.flat();

  const statusCounts = await prisma.salesOrder.groupBy({
    by: ['status'],
    where: {
      ...baseWhere,
      status: {
        in: [...priorityStatuses],
      },
    },
    _count: {
      _all: true,
    },
  });

  const countsByStatus = new Map<string, number>(
    statusCounts.map(item => [item.status, item._count._all])
  );

  let remainingSkip = skip;
  let remainingTake = limit;
  const groupedOrders: SalesOrderListResult[] = [];
  const orderBy = buildInGroupOrderBy(params);

  for (const statuses of priorityStatusGroups) {
    if (remainingTake <= 0) {
      break;
    }

    const groupTotal = statuses.reduce(
      (sum, status) => sum + (countsByStatus.get(status) ?? 0),
      0
    );

    if (groupTotal === 0) {
      continue;
    }

    if (remainingSkip >= groupTotal) {
      remainingSkip -= groupTotal;
      continue;
    }

    const groupWhere: Prisma.SalesOrderWhereInput = {
      ...baseWhere,
      status: statuses.length === 1 ? statuses[0] : { in: [...statuses] },
    };

    const groupOrders = await prisma.salesOrder.findMany({
      where: groupWhere,
      orderBy,
      skip: remainingSkip,
      take: remainingTake,
      include: listInclude,
    });

    groupedOrders.push(...groupOrders);
    remainingTake -= groupOrders.length;
    remainingSkip = 0;
  }

  return {
    orders: groupedOrders,
    total: countStatuses(priorityStatusGroups, countsByStatus),
  };
}

const mapListOrder = (
  order: SalesOrderListResult,
  productsMap: Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number | null;
      weight: number | null;
    }
  >
) => {
  const { payments, prepaymentUsages, returnOrders, _count, items, ...base } =
    order;
  const orderBase = mapOrderBaseFields(base);
  const paidAmount = calculateSalesOrderSettledAmount({
    payments,
    prepaymentUsages,
  });
  const receivableTotal = getSalesOrderReceivableTotal({
    isSampleOrder: orderBase.isSampleOrder,
    sampleSettlementType: orderBase.sampleSettlementType,
    totalAmount: order.totalAmount,
    roundingAdjustment: order.roundingAdjustment,
  });

  return {
    ...orderBase,
    items: items.map(item =>
      mapSalesOrderItem(
        item,
        item.productId ? productsMap.get(item.productId) : undefined
      )
    ),
    itemCount: _count.items,
    paidAmount,
    remainingAmount: Math.max(0, receivableTotal - paidAmount),
    hasReturnOrder: returnOrders.length > 0,
  };
};

export async function getSalesOrders(params: SalesOrderQueryParams) {
  const { page = 1, limit = 20 } = params;
  const systemMode = await getSystemMode();
  let orders: SalesOrderListResult[] = [];
  let total = 0;

  if (shouldUsePrioritizedStatusOrdering(params)) {
    const prioritizedResult = await getPrioritizedSalesOrders(
      { ...params, page, limit },
      systemMode
    );
    orders = prioritizedResult.orders;
    total = prioritizedResult.total;
  } else {
    const skip = (page - 1) * limit;
    const where = buildWhere(params, systemMode);
    const orderBy = buildOrderBy(params);

    const result = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: listInclude,
      }),
      prisma.salesOrder.count({ where }),
    ]);

    [orders, total] = result;
  }

  // 手动获取产品信息
  const productIds = orders
    .flatMap(order => order.items.map(item => item.productId))
    .filter(Boolean) as string[];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      specification: true,
      piecesPerUnit: true,
      weight: true,
    },
    take: productIds.length,
  });

  const productsMap = new Map(
    products.map(p => [
      p.id,
      {
        ...p,
        weight: p.weight === null ? null : Number(p.weight),
      },
    ])
  );

  return {
    data: orders.map(order => mapListOrder(order, productsMap)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
