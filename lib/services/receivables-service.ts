/**
 * 应收账款业务逻辑服务层
 * 职责:
 * - 封装所有应收账款相关的业务逻辑
 * - 通过 Prisma 客户端与数据库交互
 * - 返回类型安全的数据对象
 * - 可被 API Route 和服务器组件复用
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

// ==================== 类型定义 ====================

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export interface ReceivableItem {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  orderDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue';
  overdueDays: number;
  lastPaymentDate?: string;
}

export interface ReceivableSummary {
  totalReceivable: number; // 总应收金额
  totalOverdue: number; // 逾期总金额
  receivableCount: number; // 应收笔数
  overdueCount: number; // 逾期笔数
  paidCount: number; // 已付清笔数
  unpaidCount: number; // 未付款笔数
  partialCount: number; // 部分付款笔数
}

export interface ReceivablesQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customerId?: string;
  paymentStatus?: 'unpaid' | 'partial' | 'paid' | 'overdue';
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReceivablesResult {
  receivables: ReceivableItem[];
  pagination: {
    page: number;
    pageSize: number;
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
  orderDate: Date,
  paymentDeadlineDays = 30
): 'unpaid' | 'partial' | 'paid' | 'overdue' {
  const paidRatio = paidAmount / totalAmount;

  if (paidRatio >= 0.9999) {
    return 'paid';
  }

  const daysSinceOrder = Math.floor(
    (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceOrder > paymentDeadlineDays && paidRatio < 0.9999) {
    return 'overdue';
  }

  if (paidAmount > 0) {
    return 'partial';
  }

  return 'unpaid';
}

/**
 * 计算逾期天数
 */
function calculateOverdueDays(
  orderDate: Date,
  paymentDeadlineDays = 30
): number {
  const daysSinceOrder = Math.floor(
    (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, daysSinceOrder - paymentDeadlineDays);
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
 */
function buildOrderBy(
  sortBy: string = 'orderDate',
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.SalesOrderOrderByWithRelationInput {
  const orderByMap: Record<string, Prisma.SalesOrderOrderByWithRelationInput> =
    {
      orderDate: { createdAt: sortOrder },
      totalAmount: { totalAmount: sortOrder },
      customerName: { customer: { name: sortOrder } },
    };

  return orderByMap[sortBy] || { createdAt: sortOrder };
}

/**
 * 转换订单为应收款项
 */
function transformToReceivable(order: {
  id: string;
  orderNumber: string;
  customerId: string;
  totalAmount: number;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  payments: Array<{
    paymentAmount: number;
    paymentDate: Date;
  }>;
}): ReceivableItem {
  const paidAmount =
    order.payments?.reduce((sum, p) => sum + p.paymentAmount, 0) || 0;

  const remainingAmount = Math.max(0, order.totalAmount - paidAmount);
  const paymentStatus = calculatePaymentStatus(
    paidAmount,
    order.totalAmount,
    order.createdAt
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
    totalAmount: order.totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
    overdueDays:
      paymentStatus === 'overdue' ? calculateOverdueDays(order.createdAt) : 0,
    lastPaymentDate: lastPayment
      ? lastPayment.paymentDate.toISOString().split('T')[0]
      : undefined,
  };
}

/**
 * 计算应收账款汇总统计
 */
function calculateSummary(receivables: ReceivableItem[]): ReceivableSummary {
  return receivables.reduce(
    (acc, item) => {
      acc.totalReceivable += item.remainingAmount;

      if (item.paymentStatus === 'overdue') {
        acc.totalOverdue += item.remainingAmount;
        acc.overdueCount++;
      }

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
        case 'overdue':
          acc.receivableCount++;
          break;
      }

      return acc;
    },
    {
      totalReceivable: 0,
      totalOverdue: 0,
      receivableCount: 0,
      overdueCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      partialCount: 0,
    }
  );
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
    pageSize = 20,
    paymentStatus,
    sortBy,
    sortOrder,
    ...filterParams
  } = params;

  // 构建基础查询条件
  const baseWhere = buildWhereConditions(filterParams);

  // 获取所有符合基础条件的订单
  const allOrders = await prisma.salesOrder.findMany({
    where: baseWhere,
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      totalAmount: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      payments: {
        where: { status: 'confirmed' },
        select: {
          paymentAmount: true,
          paymentDate: true,
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
    orderBy: buildOrderBy(sortBy, sortOrder),
  });

  // 转换为应收款项并计算支付状态
  let receivables = allOrders.map(transformToReceivable);

  // 如果有支付状态筛选,在应用层过滤
  if (paymentStatus) {
    receivables = receivables.filter(r => r.paymentStatus === paymentStatus);
  }

  // 计算统计数据
  const summary = calculateSummary(receivables);

  // 分页处理
  const total = receivables.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedReceivables = receivables.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return {
    receivables: paginatedReceivables,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
    summary,
  };
}
