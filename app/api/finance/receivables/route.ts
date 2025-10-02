import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import {
  errorResponse,
  validateQueryParams,
  verifyApiAuth,
} from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import { accountsReceivableQuerySchema } from '@/lib/validations/payment';

/**
 * 应收货款API
 * GET /api/finance/receivables - 获取应收账款列表
 *
 * 遵循规范：
 * 1. 使用 verifyApiAuth 读取中间件透传的用户信息，避免重复调用 getServerSession
 * 2. 使用 Zod schema 进行参数验证，遵循唯一真理源原则
 * 3. 使用统一的响应函数，确保 API 响应格式一致
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证 - 从中间件透传的头信息中获取用户信息
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    // 参数验证 - 使用 Zod schema，遵循唯一真理源原则
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(
      searchParams,
      accountsReceivableQuerySchema
    );

    if (!validation.success) {
      return errorResponse(validation.error || '参数验证失败', 400);
    }

    // 解构验证后的数据，提供默认值
    const validatedData = validation.data!;
    const page = validatedData.page ?? 1;
    const pageSize = validatedData.pageSize ?? 20;
    const search = validatedData.search;
    const status = validatedData.paymentStatus;
    const customerId = validatedData.customerId;
    const startDate = validatedData.startDate;
    const endDate = validatedData.endDate;
    const sortBy = validatedData.sortBy ?? 'orderDate';
    const sortOrder = validatedData.sortOrder ?? 'desc';

    // 建立前端字段与数据库字段的映射关系
    const sortFieldMapping: Record<
      string,
      keyof Prisma.SalesOrderOrderByWithRelationInput
    > = {
      orderDate: 'createdAt', // 订单日期 -> 创建时间
      totalAmount: 'totalAmount', // 订单金额
      customerName: 'customer', // 客户名称（需要特殊处理）
      createdAt: 'createdAt', // 创建时间
      updatedAt: 'updatedAt', // 更新时间
    };

    // 验证并获取实际的排序字段，如果字段不存在则使用默认值
    const actualSortField = sortFieldMapping[sortBy] || 'createdAt';

    // 对于客户名称排序，需要特殊处理
    const orderByClause =
      sortBy === 'customerName'
        ? { customer: { name: sortOrder as 'asc' | 'desc' } }
        : { [actualSortField]: sortOrder as 'asc' | 'desc' };

    // 构建查询条件
    const whereConditions: any = {
      status: { in: ['confirmed', 'shipped', 'completed'] }, // 只查询已确认的订单
    };

    if (search) {
      whereConditions.OR = [
        { orderNumber: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
    }

    if (customerId) {
      whereConditions.customerId = customerId;
    }

    if (startDate && endDate) {
      whereConditions.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // 第一步：查询所有符合条件的订单（不分页），用于计算支付状态和统计数据
    let allSalesOrders;
    try {
      allSalesOrders = await prisma.salesOrder.findMany({
        where: whereConditions,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          payments: {
            where: {
              status: 'confirmed',
            },
            select: {
              paymentAmount: true,
              paymentDate: true,
            },
          },
        },
        orderBy: orderByClause,
      });
    } catch (error) {
      console.error('数据库查询错误:', error);
      return NextResponse.json(
        { success: false, error: '查询应收账款数据失败' },
        { status: 500 }
      );
    }

    // 第二步：转换为应收账款格式并计算支付状态
    const allReceivables = allSalesOrders.map((order: any) => {
      const paidAmount = order.payments.reduce(
        (sum: number, payment: any) => sum + payment.paymentAmount,
        0
      );
      const remainingAmount = order.totalAmount - paidAmount;

      // 计算支付状态
      let paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue' = 'unpaid';
      if (paidAmount === 0) {
        paymentStatus = 'unpaid';
      } else if (paidAmount >= order.totalAmount) {
        paymentStatus = 'paid';
      } else {
        paymentStatus = 'partial';
      }

      // 简单的逾期判断（实际项目中应该基于到期日期）
      const orderDate = new Date(order.createdAt);
      const daysSinceOrder = Math.floor(
        (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (paymentStatus !== 'paid' && daysSinceOrder > 30) {
        paymentStatus = 'overdue';
      }

      const lastPaymentDate =
        order.payments.length > 0
          ? order.payments.sort(
              (a: any, b: any) =>
                new Date(b.paymentDate).getTime() -
                new Date(a.paymentDate).getTime()
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
        dueDate: new Date(orderDate.getTime() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // 30天后到期
        overdueDays:
          paymentStatus === 'overdue' ? Math.max(0, daysSinceOrder - 30) : 0,
        lastPaymentDate: lastPaymentDate
          ? new Date(lastPaymentDate).toISOString().split('T')[0]
          : undefined,
      };
    });

    // 第三步：根据状态筛选（在内存中进行，因为支付状态是计算出来的）
    const filteredReceivables = status
      ? allReceivables.filter(r => r.paymentStatus === status)
      : allReceivables;

    // 第四步：计算完整的统计数据（基于所有筛选后的数据）
    const summary = {
      totalReceivable: filteredReceivables.reduce(
        (sum, r) => sum + r.remainingAmount,
        0
      ),
      totalOverdue: filteredReceivables
        .filter(r => r.paymentStatus === 'overdue')
        .reduce((sum, r) => sum + r.remainingAmount, 0),
      receivableCount: filteredReceivables.length,
      overdueCount: filteredReceivables.filter(
        r => r.paymentStatus === 'overdue'
      ).length,
    };

    // 第五步：应用分页到筛选后的结果
    const paginatedReceivables = filteredReceivables.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    return NextResponse.json({
      success: true,
      data: {
        receivables: paginatedReceivables,
        pagination: {
          page,
          pageSize,
          total: filteredReceivables.length,
          totalPages: Math.ceil(filteredReceivables.length / pageSize),
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
