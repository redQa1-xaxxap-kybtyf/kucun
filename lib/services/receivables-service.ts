/**
 * 应收账款业务逻辑服务层
 * 职责:
 * - 封装所有应收账款相关的业务逻辑
 * - 通过 Prisma 客户端与数据库交互
 * - 返回类型安全的数据对象
 * - 可被 API Route 和服务器组件复用
 */

import type { Prisma } from '@prisma/client';
import { endOfMonth, parseISO, startOfMonth, subMonths } from 'date-fns';

import { prisma } from '@/lib/db';

// ==================== 类型定义 ====================

export type PaymentStatus = 'unpaid' | 'partial' | 'pending' | 'paid';

export interface ReceivableItem {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  orderDate: string;
  totalAmount: number;
  roundingAdjustment: number; // ✅ 新增: 订单抹零金额(正数加价,负数抹零)
  paymentRoundingAmount: number; // ✅ 新增: 已确认收款抹零金额
  pendingRoundingAmount: number; // ✅ 新增: 待确认收款抹零金额
  paidAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  lastPaymentDate?: string;
}

export interface ReceivableSummary {
  totalReceivable: number; // 总应收金额
  receivableCount: number; // 应收笔数
  paidCount: number; // 已付清笔数
  unpaidCount: number; // 未付款笔数
  partialCount: number; // 部分付款笔数
  pendingCount: number; // 待确认笔数
  collectionRate: number; // 当前月收款率
  collectionRateChange: number; // 较上月收款率变化(百分点)
}

export interface ReceivablesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  paymentStatus?: 'unpaid' | 'partial' | 'pending' | 'paid';
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReceivablesResult {
  receivables: ReceivableItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: ReceivableSummary;
}

// ==================== 辅助函数 ====================

/**
 * 计算支付状态
 */
function calculatePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  _orderDate: Date,
  pendingAmount = 0
): PaymentStatus {
  if (pendingAmount > 0) {
    return 'pending';
  }

  if (totalAmount <= 0) {
    return 'paid';
  }

  const paidRatio = paidAmount / totalAmount;

  if (paidRatio >= 0.9999) {
    return 'paid';
  }

  if (paidAmount > 0) {
    return 'partial';
  }

  return 'unpaid';
}

/**
 * 构建 Prisma 查询条件
 */
function buildWhereConditions(params: {
  search?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.SalesOrderWhereInput {
  const where: Prisma.SalesOrderWhereInput = {
    // 只查询已确认的订单
    status: { in: ['confirmed', 'shipped', 'completed'] },
  };

  // 搜索条件
  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search } },
      { customer: { name: { contains: params.search } } },
      { customer: { phone: { contains: params.search } } },
    ];
  }

  // 客户筛选
  if (params.customerId) {
    where.customerId = params.customerId;
  }

  // 日期范围
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
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
 * 优化: 使用对象字面量映射,更清晰的默认值处理
 */
function buildOrderBy(
  sortBy: string = 'orderDate',
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.SalesOrderOrderByWithRelationInput {
  // 使用对象字面量映射,避免运行时查找
  const orderByMap: Record<string, Prisma.SalesOrderOrderByWithRelationInput> =
    {
      orderDate: { createdAt: sortOrder },
      totalAmount: { totalAmount: sortOrder },
      customerName: { customer: { name: sortOrder } },
    };

  // 默认按创建时间排序
  return orderByMap[sortBy] ?? { createdAt: sortOrder };
}

/**
 * 转换订单为应收款项
 */
function transformToReceivable(order: {
  id: string;
  orderNumber: string;
  customerId: string;
  totalAmount: number;
  roundingAdjustment: number | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  payments: Array<{
    actualPaymentAmount: number; // ✅ 修复: 使用实际到账金额
    roundingAmount: number | null;
    paymentDate: Date;
    status: string;
  }>;
}): ReceivableItem {
  const confirmedPayments =
    order.payments?.filter(payment => payment.status === 'confirmed') || [];
  const pendingPayments =
    order.payments?.filter(payment => payment.status === 'pending') || [];

  // ✅ 修复: 使用实际到账金额 + 抹零金额计算已收款和待确认
  // ⚠️ 关键修复: Prisma Decimal 类型必须转换为 number
  const confirmedActual =
    confirmedPayments.reduce(
      (sum, payment) => sum + Number(payment.actualPaymentAmount),
      0
    ) || 0;
  const confirmedRounding =
    confirmedPayments.reduce(
      (sum, payment) => sum + Number(payment.roundingAmount ?? 0),
      0
    ) || 0;
  const pendingActual =
    pendingPayments.reduce(
      (sum, payment) => sum + Number(payment.actualPaymentAmount),
      0
    ) || 0;
  const pendingRounding =
    pendingPayments.reduce(
      (sum, payment) => sum + Number(payment.roundingAmount ?? 0),
      0
    ) || 0;

  const totalAmountNum = Number(order.totalAmount);
  const orderRounding = Number(order.roundingAdjustment || 0);

  // ✅ 修复: 订单实际应收 = 商品总额 + 订单抹零
  const orderDue = totalAmountNum + orderRounding;

  // ✅ 修复: 等效已收款 = 实际到账 + 收款抹零(优惠/减免算作已收)
  const paidAgainstOrder = confirmedActual + confirmedRounding;
  const pendingAgainstOrder = pendingActual + pendingRounding;

  // ✅ 修复: 待收金额 = 订单应收 - 等效已收款
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
    orderDate: order.createdAt.toISOString().split('T')[0],
    totalAmount: totalAmountNum, // 商品总额
    roundingAdjustment: orderRounding, // 订单抹零
    paymentRoundingAmount: confirmedRounding, // ✅ 修复: 只包含已确认收款的抹零
    pendingRoundingAmount: pendingRounding, // ✅ 修复: 待确认收款的抹零
    paidAmount: confirmedActual, // 已确认实际到账金额
    pendingAmount: pendingActual, // 待确认实际到账金额
    remainingAmount,
    paymentStatus,
    lastPaymentDate: lastPayment
      ? lastPayment.paymentDate.toISOString()
      : undefined,
  };
}

/**
 * 计算应收账款汇总统计
 */
function calculateSummary(receivables: ReceivableItem[]): ReceivableSummary {
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
      currentMonth: {
        totalAmount: 0,
        paidAmount: 0,
        count: 0,
      },
      previousMonth: {
        totalAmount: 0,
        paidAmount: 0,
        count: 0,
      },
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
  if (!value) {
    return new Date();
  }

  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

interface BaseReceivableOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  totalAmount: Prisma.Decimal | number | null;
  roundingAdjustment: Prisma.Decimal | number | null; // ✅ 新增: 订单抹零金额
  createdAt: Date;
}

type PaymentTotals = {
  confirmed: {
    actual: number;
    rounding: number;
  };
  pending: {
    actual: number;
    rounding: number;
  };
};

async function fetchReceivableBaseOrders(
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
      roundingAdjustment: true, // ✅ 新增: 获取订单抹零金额
      createdAt: true,
    },
    orderBy,
  });
}

async function aggregatePaymentsByOrder(
  orderIds: string[]
): Promise<Record<string, PaymentTotals>> {
  if (!orderIds.length) {
    return {};
  }

  // ✅ 修复: 使用实际到账金额(actualPaymentAmount)统计
  const paymentAggregations = await prisma.paymentRecord.groupBy({
    by: ['salesOrderId', 'status'],
    where: {
      salesOrderId: { in: orderIds },
      status: { in: ['confirmed', 'pending'] },
    },
    _sum: {
      actualPaymentAmount: true,
      roundingAmount: true,
    }, // ✅ 改用实际到账金额并统计抹零
  });

  return paymentAggregations.reduce<Record<string, PaymentTotals>>(
    (acc, item) => {
      if (!item.salesOrderId) {
        return acc;
      }

      const existing = acc[item.salesOrderId] ?? {
        confirmed: { actual: 0, rounding: 0 },
        pending: { actual: 0, rounding: 0 },
      };
      const amount = Number(item._sum.actualPaymentAmount ?? 0); // ✅ 改用实际到账金额
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

function createSummaryReceivables(
  orders: BaseReceivableOrder[],
  paymentsByOrder: Record<string, PaymentTotals>
): ReceivableItem[] {
  return orders.map(order => {
    const amounts = paymentsByOrder[order.id] ?? {
      confirmed: { actual: 0, rounding: 0 },
      pending: { actual: 0, rounding: 0 },
    };

    const totalAmount = Number(order.totalAmount ?? 0);
    const roundingAdjustment = Number(order.roundingAdjustment ?? 0); // ✅ 新增: 获取抹零金额
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
      orderDue, // ✅ 使用实际应收金额
      order.createdAt,
      pendingAgainstOrder
    );

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: '',
      customerPhone: undefined,
      orderDate: order.createdAt.toISOString().split('T')[0],
      totalAmount,
      roundingAdjustment, // ✅ 新增: 订单抹零金额
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

function filterReceivablesByStatus(
  receivables: ReceivableItem[],
  status?: PaymentStatus
): ReceivableItem[] {
  if (!status) {
    return receivables;
  }

  return receivables.filter(item => item.paymentStatus === status);
}

function paginateReceivableIds(
  receivables: ReceivableItem[],
  page: number,
  limit: number
): {
  total: number;
  totalPages: number;
  pageOrderIds: string[];
} {
  const total = receivables.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = Math.max(0, (page - 1) * limit);
  const pageOrderIds = receivables
    .slice(startIndex, startIndex + limit)
    .map(item => item.id);

  return { total, totalPages, pageOrderIds };
}

async function fetchReceivableDetails(orderIds: string[]) {
  if (!orderIds.length) {
    return [];
  }

  // ✅ 修复: 只使用 select,不能同时使用 include 和 select
  return prisma.salesOrder.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      totalAmount: true,
      roundingAdjustment: true, // ✅ 新增: 获取订单抹零金额
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      payments: {
        where: { status: { in: ['confirmed', 'pending'] } },
        select: {
          actualPaymentAmount: true, // ✅ 修复: 使用实际到账金额
          roundingAmount: true,
          paymentDate: true,
          status: true,
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
  });
}

function mapOrdersById<T extends { id: string }>(
  orders: T[]
): Record<string, T> {
  return orders.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

function buildPaginatedReceivables(
  orderIds: string[],
  orderMap: Record<string, Parameters<typeof transformToReceivable>[0]>
): ReceivableItem[] {
  return orderIds
    .map(id => orderMap[id])
    .filter((value): value is Parameters<typeof transformToReceivable>[0] =>
      Boolean(value)
    )
    .map(transformToReceivable);
}

// ==================== 公共服务函数 ====================

/**
 * 获取应收账款列表
 * 可被 API Route 和服务器组件复用
 */
export async function getReceivables(
  params: ReceivablesQueryParams = {}
): Promise<ReceivablesResult> {
  const {
    page = 1,
    limit = 20,
    paymentStatus,
    sortBy,
    sortOrder,
    ...filterParams
  } = params;

  // 构建基础查询条件
  const baseWhere = buildWhereConditions(filterParams);
  const orderBy = buildOrderBy(sortBy, sortOrder);

  // 获取符合条件的订单基础数据（用于统计与分页）
  const orders = await fetchReceivableBaseOrders(baseWhere, orderBy);

  const orderIds = orders.map(order => order.id);

  // 聚合收款信息（仅获取需要的状态）
  const paymentsByOrder = await aggregatePaymentsByOrder(orderIds);

  // 构建用于统计的应收款列表
  const summaryReceivables = createSummaryReceivables(orders, paymentsByOrder);

  // 应用支付状态筛选
  const filteredReceivables = filterReceivablesByStatus(
    summaryReceivables,
    paymentStatus
  );

  // 计算统计数据
  const summary = calculateSummary(filteredReceivables);

  // 计算分页并获取当前页需要的订单详情
  const { total, totalPages, pageOrderIds } = paginateReceivableIds(
    filteredReceivables,
    page,
    limit
  );

  const pageOrders = await fetchReceivableDetails(pageOrderIds);
  const orderMap = mapOrdersById(pageOrders);
  const paginatedReceivables = buildPaginatedReceivables(
    pageOrderIds,
    orderMap
  );

  return {
    receivables: paginatedReceivables,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    summary,
  };
}
