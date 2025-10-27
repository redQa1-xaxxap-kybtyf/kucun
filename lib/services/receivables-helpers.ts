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
  if (pendingAmount > 0) return 'pending';
  if (totalAmount <= 0) return 'paid';
  const paidRatio = paidAmount / totalAmount;
  if (paidRatio >= 0.9999) return 'paid';
  if (paidAmount > 0) return 'partial';
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

  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search } },
      { customer: { name: { contains: params.search } } },
      { customer: { phone: { contains: params.search } } },
    ];
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

export function buildOrderBy(
  sortBy: string = 'orderDate',
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.SalesOrderOrderByWithRelationInput {
  const orderByMap: Record<string, Prisma.SalesOrderOrderByWithRelationInput> =
    {
      orderDate: { createdAt: sortOrder },
      totalAmount: { totalAmount: sortOrder },
      customerName: { customer: { name: sortOrder } },
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
  const remainingAmount = Math.max(0, orderDue - paidAgainstOrder);

  const paymentStatus = calculatePaymentStatus(
    paidAgainstOrder,
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
    paidAmount: confirmedActual,
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
};

export async function fetchReceivableBaseOrders(
  where: Prisma.SalesOrderWhereInput,
  orderBy: Prisma.SalesOrderOrderByWithRelationInput
): Promise<BaseReceivableOrder[]> {
  return prisma.salesOrder.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      totalAmount: true,
      roundingAdjustment: true,
      createdAt: true,
    },
    orderBy,
  });
}

export async function aggregatePaymentsByOrder(
  orderIds: string[]
): Promise<Record<string, PaymentTotals>> {
  if (!orderIds.length) return {};
  const paymentAggregations = await prisma.paymentRecord.groupBy({
    by: ['salesOrderId', 'status'],
    where: {
      salesOrderId: { in: orderIds },
      status: { in: ['confirmed', 'pending'] },
    },
    _sum: { actualPaymentAmount: true, roundingAmount: true },
  });

  return paymentAggregations.reduce<Record<string, PaymentTotals>>(
    (acc, item) => {
      if (!item.salesOrderId) return acc;
      const existing = acc[item.salesOrderId] ?? {
        confirmed: { actual: 0, rounding: 0 },
        pending: { actual: 0, rounding: 0 },
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
    },
    {}
  );
}

export function createSummaryReceivables(
  orders: BaseReceivableOrder[],
  paymentsByOrder: Record<string, PaymentTotals>
): ReceivableItem[] {
  return orders.map(order => {
    const amounts = paymentsByOrder[order.id] ?? {
      confirmed: { actual: 0, rounding: 0 },
      pending: { actual: 0, rounding: 0 },
    };

    const totalAmount = Number(order.totalAmount ?? 0);
    const roundingAdjustment = Number(order.roundingAdjustment ?? 0);
    const confirmedActual = amounts.confirmed.actual;
    const confirmedRounding = amounts.confirmed.rounding;
    const pendingActual = amounts.pending.actual;
    const pendingRounding = amounts.pending.rounding;

    const appliedRounding = confirmedRounding + pendingRounding;
    const orderDue = totalAmount + roundingAdjustment;
    const paidAgainstOrder = confirmedActual + appliedRounding;
    const pendingAgainstOrder = pendingActual;
    const remainingAmount = Math.max(0, orderDue - paidAgainstOrder);
    const statusDerived = calculatePaymentStatus(
      paidAgainstOrder,
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
      paymentRoundingAmount: appliedRounding,
      pendingRoundingAmount: 0,
      paidAmount: confirmedActual,
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
  return prisma.salesOrder.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      totalAmount: true,
      roundingAdjustment: true,
      createdAt: true,
      customer: { select: { id: true, name: true, phone: true } },
      payments: {
        where: { status: { in: ['confirmed', 'pending'] } },
        select: {
          actualPaymentAmount: true,
          roundingAmount: true,
          paymentDate: true,
          status: true,
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
  });
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
