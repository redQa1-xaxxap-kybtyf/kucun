/**
 * 应收账款内部辅助函数
 */
import type { Prisma } from '@prisma/client';
import { endOfMonth, parseISO, startOfMonth, subMonths } from 'date-fns';

import { prisma } from '@/lib/db';
import type {
  PaymentStatus,
  ReceivableItem,
  ReceivableSummary,
} from '@/lib/services/receivables-types';

// ============ 计算类 ============
export function calculatePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  _orderDate: Date,
  pendingAmount = 0
): PaymentStatus {
  const MIN_UNIT = 0.01;
  const toCents = (value: number) => Math.round(Number(value || 0) * 100);

  const pendingCents = toCents(pendingAmount);
  if (pendingCents > 0) return 'pending';

  const totalCents = toCents(totalAmount);
  if (totalCents <= 0) return 'paid';

  const paidCents = toCents(paidAmount);
  const remainingHalfCents = (totalCents - paidCents) * 2;
  const minUnitCents = toCents(MIN_UNIT);

  // ✅ 到分结清（允许四舍五入容差）
  if (remainingHalfCents <= minUnitCents) return 'paid';

  if (paidCents > 0) return 'partial';
  return 'unpaid';
}

export function calculateSummary(
  receivables: ReceivableItem[]
): ReceivableSummary {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const previousMonthStart = subMonths(currentMonthStart, 1);
  const previousMonthEnd = endOfMonth(previousMonthStart);

  const totals = receivables.reduce(
    (acc, item) => {
      acc.totalReceivable += item.remainingAmount;

      switch (item.paymentStatus) {
        case 'paid':
          acc.paidCount++;
          break;
        case 'unpaid':
          acc.unpaidCount++;
          acc.receivableCount++;
          break;
        case 'partial':
          acc.partialCount++;
          acc.receivableCount++;
          break;
        case 'pending':
          acc.pendingCount++;
          acc.receivableCount++;
          break;
      }

      const orderDate = safeParseDate(item.orderDate);

      if (
        orderDate.getTime() >= currentMonthStart.getTime() &&
        orderDate.getTime() <= currentMonthEnd.getTime()
      ) {
        acc.currentMonth.totalAmount += item.totalAmount;
        acc.currentMonth.paidAmount += item.paidAmount;
        acc.currentMonth.count += 1;
      }

      if (
        orderDate.getTime() >= previousMonthStart.getTime() &&
        orderDate.getTime() <= previousMonthEnd.getTime()
      ) {
        acc.previousMonth.totalAmount += item.totalAmount;
        acc.previousMonth.paidAmount += item.paidAmount;
        acc.previousMonth.count += 1;
      }

      return acc;
    },
    {
      totalReceivable: 0,
      receivableCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      partialCount: 0,
      pendingCount: 0,
      currentMonth: { totalAmount: 0, paidAmount: 0, count: 0 },
      previousMonth: { totalAmount: 0, paidAmount: 0, count: 0 },
    }
  );

  const currentCollectionRate =
    totals.currentMonth.totalAmount === 0
      ? 0
      : (totals.currentMonth.paidAmount / totals.currentMonth.totalAmount) *
        100;
  const previousCollectionRate =
    totals.previousMonth.totalAmount === 0
      ? 0
      : (totals.previousMonth.paidAmount / totals.previousMonth.totalAmount) *
        100;

  return {
    totalReceivable: totals.totalReceivable,
    receivableCount: totals.receivableCount,
    paidCount: totals.paidCount,
    unpaidCount: totals.unpaidCount,
    partialCount: totals.partialCount,
    pendingCount: totals.pendingCount,
    collectionRate: currentCollectionRate,
    collectionRateChange: currentCollectionRate - previousCollectionRate,
  };
}

function safeParseDate(value: string): Date {
  if (!value) return new Date();
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return new Date();
}

/**
 * 计算应收款统计数据（基于全量数据）
 *
 * ✅ P0修复: 使用聚合查询计算统计数据，不受分页影响
 *
 * @param where - Prisma 查询条件
 * @param paymentStatus - 支付状态筛选（可选）
 */
export async function calculateReceivablesSummary(
  where: Prisma.SalesOrderWhereInput,
  paymentStatus?: PaymentStatus
): Promise<ReceivableSummary> {
  // 获取全量订单基础数据（不分页）
  const allOrders = await fetchReceivableBaseOrders(where, {
    createdAt: 'desc',
  });
  const allOrderIds = allOrders.map(order => order.id);

  // 聚合所有订单的收款信息
  const paymentsByOrder = await aggregatePaymentsByOrder(allOrderIds);

  // 构建应收款列表
  const summaryReceivables = createSummaryReceivables(
    allOrders,
    paymentsByOrder
  );

  // 应用支付状态筛选
  const filteredReceivables = filterReceivablesByStatus(
    summaryReceivables,
    paymentStatus
  );

  // 计算统计数据
  return calculateSummary(filteredReceivables);
}

// ============ 查询与转换 ============
export function buildWhereConditions(params: {
  search?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.SalesOrderWhereInput {
  const where: Prisma.SalesOrderWhereInput = {
    status: { in: ['confirmed', 'shipped', 'completed'] },
  };

  const rawSearch = params.search?.trim();
  if (rawSearch) {
    const normalizedSearch = rawSearch.replace(/\s+/g, ' ');
    const numericSearch = normalizedSearch.replace(/[^0-9]/g, '');

    const searchConditions: Prisma.SalesOrderWhereInput[] = [
      {
        orderNumber: {
          contains: normalizedSearch,
        },
      },
      {
        customer: {
          name: {
            contains: normalizedSearch,
          },
        },
      },
    ];

    if (numericSearch.length > 0) {
      searchConditions.push({
        customer: {
          phone: {
            contains: numericSearch,
          },
        },
      });
    } else {
      searchConditions.push({
        customer: {
          phone: {
            contains: normalizedSearch,
          },
        },
      });
    }

    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];

    where.AND = [...existingAnd, { OR: searchConditions }];
  }

  if (params.customerId) {
    where.customerId = params.customerId;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = new Date(params.startDate);
    if (params.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  return where;
}

/**
 * 构建排序条件
 *
 * ✅ P1修复: 扩展支持所有 Schema 定义的排序字段
 *
 * @param sortBy - 排序字段
 * @param sortOrder - 排序顺序（asc/desc）
 */
export function buildOrderBy(
  sortBy: string = 'orderDate',
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.SalesOrderOrderByWithRelationInput {
  const orderByMap: Record<string, Prisma.SalesOrderOrderByWithRelationInput> =
    {
      // 订单创建日期（默认）
      orderDate: { createdAt: sortOrder },
      createdAt: { createdAt: sortOrder },

      // 订单更新日期
      updatedAt: { updatedAt: sortOrder },

      // 到期日期（目前订单模型没有独立到期日字段，使用创建时间近似排序）
      dueDate: { createdAt: sortOrder },

      // 订单编号
      orderNumber: { orderNumber: sortOrder },

      // 客户名称（关联排序）
      customerName: { customer: { name: sortOrder } },

      // 订单总额
      totalAmount: { totalAmount: sortOrder },

      // 已付金额（计算字段，无法直接排序，回退到 totalAmount）
      // 注意: paidAmount 需要通过聚合计算，无法在数据库层面排序
      paidAmount: { totalAmount: sortOrder },

      // 剩余金额（计算字段，无法直接排序，回退到 totalAmount）
      // 注意: remainingAmount 是计算字段，无法在数据库层面排序
      remainingAmount: { totalAmount: sortOrder },
    };

  return orderByMap[sortBy] ?? { createdAt: sortOrder };
}

export function transformToReceivable(order: {
  id: string;
  orderNumber: string;
  customerId: string;
  totalAmount: number;
  roundingAdjustment: number | null;
  createdAt: Date;
  customer: { id: string; name: string; phone: string | null };
  payments: Array<{
    actualPaymentAmount: number;
    roundingAmount: number | null;
    paymentDate: Date;
    status: string;
  }>;
  prepaymentUsages?: Array<{
    appliedAmount: number;
  }>;
}): ReceivableItem {
  const confirmedPayments =
    order.payments?.filter(p => p.status === 'confirmed') || [];
  const pendingPayments =
    order.payments?.filter(p => p.status === 'pending') || [];

  const confirmedActual =
    confirmedPayments.reduce(
      (sum, p) => sum + Number(p.actualPaymentAmount),
      0
    ) || 0;
  const confirmedRounding =
    confirmedPayments.reduce(
      (sum, p) => sum + Number(p.roundingAmount ?? 0),
      0
    ) || 0;
  const pendingActual =
    pendingPayments.reduce(
      (sum, p) => sum + Number(p.actualPaymentAmount),
      0
    ) || 0;
  const pendingRounding =
    pendingPayments.reduce(
      (sum, p) => sum + Number(p.roundingAmount ?? 0),
      0
    ) || 0;

  const totalAmountNum = Number(order.totalAmount);
  const orderRounding = Number(order.roundingAdjustment || 0);
  const orderDue = totalAmountNum + orderRounding;
  const paidAgainstOrder = confirmedActual + confirmedRounding;
  const pendingAgainstOrder = pendingActual + pendingRounding;
  const prepaymentApplied =
    order.prepaymentUsages?.reduce(
      (sum, usage) => sum + usage.appliedAmount,
      0
    ) ?? 0;
  const paidTotal = paidAgainstOrder + prepaymentApplied;
  const remainingAmount = Math.max(0, orderDue - paidTotal);

  const paymentStatus = calculatePaymentStatus(
    paidTotal,
    orderDue,
    order.createdAt,
    pendingAgainstOrder
  );

  const lastPayment = order.payments?.sort(
    (a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()
  )[0];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: order.customer.name,
    customerPhone: order.customer.phone || undefined,
    orderDate: order.createdAt.toISOString(),
    totalAmount: totalAmountNum,
    roundingAdjustment: orderRounding,
    paymentRoundingAmount: confirmedRounding,
    pendingRoundingAmount: pendingRounding,
    paidAmount: confirmedActual + prepaymentApplied,
    pendingAmount: pendingActual,
    remainingAmount,
    paymentStatus,
    lastPaymentDate: lastPayment
      ? lastPayment.paymentDate.toISOString()
      : undefined,
  };
}

export interface BaseReceivableOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  totalAmount: Prisma.Decimal | number | null;
  roundingAdjustment: Prisma.Decimal | number | null;
  createdAt: Date;
}

type PaymentTotals = {
  confirmed: { actual: number; rounding: number };
  pending: { actual: number; rounding: number };
  prepaymentApplied: number;
};

/**
 * 获取应收款订单基础数据
 *
 * ✅ P0修复: 移除硬编码的 5000 上限，支持标准分页
 *
 * @param where - Prisma 查询条件
 * @param orderBy - 排序条件
 * @param skip - 跳过的记录数（可选，用于分页）
 * @param take - 获取的记录数（可选，用于分页）
 */
export async function fetchReceivableBaseOrders(
  where: Prisma.SalesOrderWhereInput,
  orderBy: Prisma.SalesOrderOrderByWithRelationInput,
  skip?: number,
  take?: number
): Promise<BaseReceivableOrder[]> {
  const select = {
    id: true,
    orderNumber: true,
    customerId: true,
    totalAmount: true,
    roundingAdjustment: true,
    createdAt: true,
  } satisfies Prisma.SalesOrderSelect;

  const effectiveSkip = skip ?? 0;

  if (take !== undefined) {
    return prisma.salesOrder.findMany({
      where,
      select,
      orderBy,
      skip: effectiveSkip,
      take,
    });
  }

  // 未传 take 时按批次拉取，避免一次性拉全量导致内存/响应风险
  const pageSize = 2000;
  const orders: BaseReceivableOrder[] = [];

  for (let offset = effectiveSkip; ; offset += pageSize) {
    const batch = await prisma.salesOrder.findMany({
      where,
      select,
      orderBy,
      skip: offset,
      take: pageSize,
    });

    orders.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
  }

  return orders;
}

export async function aggregatePaymentsByOrder(
  orderIds: string[]
): Promise<Record<string, PaymentTotals>> {
  if (!orderIds.length) return {};

  const batchSize = 1000;
  const batches: string[][] = [];
  for (let i = 0; i < orderIds.length; i += batchSize) {
    batches.push(orderIds.slice(i, i + batchSize));
  }

  const [allPaymentAggregations, allPrepaymentAggregations] = await Promise.all(
    [
      Promise.all(
        batches.map(batch =>
          prisma.paymentRecord.groupBy({
            by: ['salesOrderId', 'status'],
            where: {
              salesOrderId: { in: batch },
              status: { in: ['confirmed', 'pending'] },
              paymentType: 'order_payment',
            },
            _sum: { actualPaymentAmount: true, roundingAmount: true },
          })
        )
      ),
      Promise.all(
        batches.map(batch =>
          prisma.prepaymentUsage.groupBy({
            by: ['salesOrderId'],
            where: {
              salesOrderId: { in: batch },
            },
            _sum: { appliedAmount: true },
          })
        )
      ),
    ]
  );

  const paymentAggregations = allPaymentAggregations.flat();
  const prepaymentAggregations = allPrepaymentAggregations.flat();

  const totalsByOrder = paymentAggregations.reduce<
    Record<string, PaymentTotals>
  >((acc, item) => {
    if (!item.salesOrderId) return acc;
    const existing = acc[item.salesOrderId] ?? {
      confirmed: { actual: 0, rounding: 0 },
      pending: { actual: 0, rounding: 0 },
      prepaymentApplied: 0,
    };
    const amount = Number(item._sum.actualPaymentAmount ?? 0);
    const rounding = Number(item._sum.roundingAmount ?? 0);
    if (item.status === 'confirmed') {
      existing.confirmed.actual += amount;
      existing.confirmed.rounding += rounding;
    } else if (item.status === 'pending') {
      existing.pending.actual += amount;
      existing.pending.rounding += rounding;
    }
    acc[item.salesOrderId] = existing;
    return acc;
  }, {});

  prepaymentAggregations.forEach(item => {
    if (!item.salesOrderId) return;
    const existing = totalsByOrder[item.salesOrderId] ?? {
      confirmed: { actual: 0, rounding: 0 },
      pending: { actual: 0, rounding: 0 },
      prepaymentApplied: 0,
    };

    existing.prepaymentApplied += Number(item._sum.appliedAmount ?? 0);
    totalsByOrder[item.salesOrderId] = existing;
  });

  return totalsByOrder;
}

export function createSummaryReceivables(
  orders: BaseReceivableOrder[],
  paymentsByOrder: Record<string, PaymentTotals>
): ReceivableItem[] {
  return orders.map(order => {
    const amounts = paymentsByOrder[order.id] ?? {
      confirmed: { actual: 0, rounding: 0 },
      pending: { actual: 0, rounding: 0 },
      prepaymentApplied: 0,
    };

    const totalAmount = Number(order.totalAmount ?? 0);
    const roundingAdjustment = Number(order.roundingAdjustment ?? 0);
    const confirmedActual = amounts.confirmed.actual;
    const confirmedRounding = amounts.confirmed.rounding;
    const pendingActual = amounts.pending.actual;
    const pendingRounding = amounts.pending.rounding;
    const prepaymentApplied = amounts.prepaymentApplied ?? 0;

    // ✅ P1修复: 剩余金额只扣除已确认的收款和抹零
    // 待确认的抹零不参与剩余金额计算，仅用于状态展示
    const orderDue = totalAmount + roundingAdjustment;
    const paidAgainstOrder = confirmedActual + confirmedRounding;
    const pendingAgainstOrder = pendingActual;
    const paidTotal = paidAgainstOrder + prepaymentApplied;
    const remainingAmount = Math.max(0, orderDue - paidTotal);
    const statusDerived = calculatePaymentStatus(
      paidTotal,
      orderDue,
      order.createdAt,
      pendingAgainstOrder
    );

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: '',
      customerPhone: undefined,
      orderDate: order.createdAt.toISOString(),
      totalAmount,
      roundingAdjustment,
      paymentRoundingAmount: confirmedRounding, // 只包含已确认的抹零
      pendingRoundingAmount: pendingRounding, // 待确认的抹零单独返回
      paidAmount: confirmedActual + prepaymentApplied,
      pendingAmount: pendingActual,
      remainingAmount,
      paymentStatus: statusDerived,
      lastPaymentDate: undefined,
    };
  });
}

export function filterReceivablesByStatus(
  receivables: ReceivableItem[],
  status?: PaymentStatus
): ReceivableItem[] {
  if (!status) return receivables;
  return receivables.filter(item => item.paymentStatus === status);
}

export function paginateReceivableIds(
  receivables: ReceivableItem[],
  page: number,
  limit: number
): { total: number; totalPages: number; pageOrderIds: string[] } {
  const total = receivables.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = Math.max(0, (page - 1) * limit);
  const pageOrderIds = receivables
    .slice(startIndex, startIndex + limit)
    .map(item => item.id);
  return { total, totalPages, pageOrderIds };
}

export async function fetchReceivableDetails(orderIds: string[]) {
  if (!orderIds.length) return [];
  const orders = await prisma.salesOrder.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      totalAmount: true,
      roundingAdjustment: true,
      createdAt: true,
      customer: { select: { id: true, name: true, phone: true } },
      prepaymentUsages: {
        select: {
          appliedAmount: true,
        },
      },
      payments: {
        where: {
          status: { in: ['confirmed', 'pending'] },
          paymentType: 'order_payment',
        },
        select: {
          actualPaymentAmount: true,
          roundingAmount: true,
          paymentDate: true,
          status: true,
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
    take: orderIds.length,
  });

  // 将 Decimal 类型金额转换为 number，便于后续计算
  return orders.map(order => ({
    ...order,
    totalAmount: Number(order.totalAmount ?? 0),
    roundingAdjustment:
      order.roundingAdjustment === null ||
      order.roundingAdjustment === undefined
        ? null
        : Number(order.roundingAdjustment),
    prepaymentUsages:
      order.prepaymentUsages?.map(usage => ({
        ...usage,
        appliedAmount: Number(usage.appliedAmount ?? 0),
      })) ?? [],
    payments: order.payments.map(payment => ({
      ...payment,
      actualPaymentAmount: Number(payment.actualPaymentAmount ?? 0),
      roundingAmount:
        payment.roundingAmount === null || payment.roundingAmount === undefined
          ? null
          : Number(payment.roundingAmount),
    })),
  }));
}

export function mapOrdersById<T extends { id: string }>(
  orders: T[]
): Record<string, T> {
  return orders.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

export function buildPaginatedReceivables(
  orderIds: string[],
  orderMap: Record<string, Parameters<typeof transformToReceivable>[0]>
): ReceivableItem[] {
  return orderIds
    .map(id => orderMap[id])
    .filter((v): v is Parameters<typeof transformToReceivable>[0] => Boolean(v))
    .map(transformToReceivable);
}
