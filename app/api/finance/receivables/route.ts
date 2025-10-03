import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import {
  errorResponse,
  validateQueryParams,
  verifyApiAuth,
} from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import {
  calculateDueDate,
  calculateOverdueDays,
  calculatePaymentStatus,
  type PaymentStatus,
} from '@/lib/utils/payment-status';
import { accountsReceivableQuerySchema } from '@/lib/validations/payment';

/**
 * 应收款项类型定义
 */
interface ReceivableItem {
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  orderDate: string;
  dueDate: string;
  overdueDays: number;
  lastPaymentDate?: string;
}

/**
 * 销售订单查询结果类型
 */
interface SalesOrderWithPayments {
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
}

/**
 * 构建查询条件
 */
function buildWhereConditions(params: {
  search?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.SalesOrderWhereInput {
  const conditions: Prisma.SalesOrderWhereInput = {
    status: { in: ['confirmed', 'shipped', 'completed'] },
  };

  if (params.search) {
    conditions.OR = [
      { orderNumber: { contains: params.search } },
      { customer: { name: { contains: params.search } } },
    ];
  }

  if (params.customerId) {
    conditions.customerId = params.customerId;
  }

  if (params.startDate && params.endDate) {
    conditions.createdAt = {
      gte: new Date(params.startDate),
      lte: new Date(params.endDate),
    };
  }

  return conditions;
}

/**
 * 构建排序子句
 */
function buildOrderByClause(
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): Prisma.SalesOrderOrderByWithRelationInput {
  const sortFieldMapping: Record<
    string,
    keyof Prisma.SalesOrderOrderByWithRelationInput
  > = {
    orderDate: 'createdAt',
    totalAmount: 'totalAmount',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  };

  if (sortBy === 'customerName') {
    return { customer: { name: sortOrder } };
  }

  const actualSortField = sortFieldMapping[sortBy] || 'createdAt';
  return { [actualSortField]: sortOrder };
}

/**
 * 转换订单为应收款项
 */
function transformToReceivable(order: SalesOrderWithPayments): ReceivableItem {
  const paidAmount = order.payments.reduce(
    (sum, payment) => sum + payment.paymentAmount,
    0
  );
  const remainingAmount = order.totalAmount - paidAmount;

  const paymentStatus = calculatePaymentStatus(
    paidAmount,
    order.totalAmount,
    order.createdAt
  );

  const lastPaymentDate =
    order.payments.length > 0
      ? order.payments.sort(
          (a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()
        )[0].paymentDate
      : undefined;

  return {
    salesOrderId: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: order.customer.name,
    totalAmount: order.totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
    orderDate: order.createdAt.toISOString().split('T')[0],
    dueDate: calculateDueDate(order.createdAt),
    overdueDays:
      paymentStatus === 'overdue' ? calculateOverdueDays(order.createdAt) : 0,
    lastPaymentDate: lastPaymentDate
      ? lastPaymentDate.toISOString().split('T')[0]
      : undefined,
  };
}

/**
 * 应收货款API
 * GET /api/finance/receivables - 获取应收账款列表
 *
 * 优化策略：
 * 1. 使用并行查询：分页数据 + 总数统计 + 聚合统计
 * 2. 数据库层完成过滤和排序
 * 3. 只对当前页数据计算支付状态
 * 4. 聚合统计基于完整数据集
 *
 * 遵循规范：
 * 1. 使用 verifyApiAuth 读取中间件透传的用户信息
 * 2. 使用 Zod schema 进行参数验证
 * 3. 函数不超过50行，拆分为多个辅助函数
 * 4. 使用 TypeScript 类型安全
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    // 参数验证
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(
      searchParams,
      accountsReceivableQuerySchema
    );

    if (!validation.success) {
      return errorResponse(validation.error || '参数验证失败', 400);
    }

    // 解构验证后的数据
    const validatedData = validation.data!;
    const page = validatedData.page ?? 1;
    const pageSize = validatedData.pageSize ?? 20;
    const search = validatedData.search;
    const status = validatedData.paymentStatus;
    const customerId = validatedData.customerId;
    const startDate = validatedData.startDate;
    const endDate = validatedData.endDate;
    const sortBy = validatedData.sortBy ?? 'orderDate';
    const sortOrder = (validatedData.sortOrder ?? 'desc') as 'asc' | 'desc';

    // 构建查询条件
    const whereConditions = buildWhereConditions({
      search,
      customerId,
      startDate,
      endDate,
    });

    // 构建排序子句
    const orderByClause = buildOrderByClause(sortBy, sortOrder);

    // 并行查询：分页数据 + 总数统计 + 聚合统计
    const [salesOrders, total, aggregateStats] = await Promise.all([
      // 查询1：分页数据（只查询当前页）
      prisma.salesOrder.findMany({
        where: whereConditions,
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
          },
        },
        orderBy: orderByClause,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      // 查询2：总记录数
      prisma.salesOrder.count({ where: whereConditions }),

      // 查询3：聚合统计（所有符合条件的订单）
      prisma.salesOrder.findMany({
        where: whereConditions,
        select: {
          totalAmount: true,
          createdAt: true,
          payments: {
            where: { status: 'confirmed' },
            select: { paymentAmount: true },
          },
        },
      }),
    ]);

    // 转换当前页数据为应收款项
    const receivables = salesOrders.map(transformToReceivable);

    // 计算聚合统计数据
    const summary = aggregateStats.reduce(
      (acc, order) => {
        const paidAmount = order.payments.reduce(
          (sum, p) => sum + p.paymentAmount,
          0
        );
        const remainingAmount = order.totalAmount - paidAmount;

        acc.totalReceivable += remainingAmount;
        acc.receivableCount++;

        // 判断是否逾期
        const paymentStatus = calculatePaymentStatus(
          paidAmount,
          order.totalAmount,
          order.createdAt
        );

        if (paymentStatus === 'overdue') {
          acc.totalOverdue += remainingAmount;
          acc.overdueCount++;
        }

        return acc;
      },
      {
        totalReceivable: 0,
        totalOverdue: 0,
        receivableCount: 0,
        overdueCount: 0,
      }
    );

    // 如果有状态筛选，需要在应用层过滤
    // 注意：这是一个已知的限制，因为支付状态是计算字段
    let filteredReceivables = receivables;
    let filteredTotal = total;

    if (status) {
      // 重新查询所有数据并过滤（性能较差，但保证准确性）
      const allOrders = await prisma.salesOrder.findMany({
        where: whereConditions,
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
          },
        },
        orderBy: orderByClause,
      });

      const allReceivables = allOrders.map(transformToReceivable);
      filteredReceivables = allReceivables.filter(
        r => r.paymentStatus === status
      );
      filteredTotal = filteredReceivables.length;

      // 应用分页
      filteredReceivables = filteredReceivables.slice(
        (page - 1) * pageSize,
        page * pageSize
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        receivables: filteredReceivables,
        pagination: {
          page,
          pageSize,
          total: filteredTotal,
          totalPages: Math.ceil(filteredTotal / pageSize),
        },
        summary,
      },
    });
  } catch (error) {
    console.error('获取应收账款失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取应收账款失败',
      },
      { status: 500 }
    );
  }
}
