import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * 应收货款API
 * GET /api/finance/receivables - 获取应收账款列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'orderDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 参数验证
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { success: false, error: '分页参数无效' },
        { status: 400 }
      );
    }

    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      return NextResponse.json(
        { success: false, error: '排序方向参数无效' },
        { status: 400 }
      );
    }

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

    // 计算分页
    const skip = (page - 1) * pageSize;

    // 查询销售订单和相关的收款记录
    let salesOrders, _total;
    try {
      [salesOrders, _total] = await Promise.all([
        prisma.salesOrder.findMany({
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
          skip,
          take: pageSize,
        }),
        prisma.salesOrder.count({ where: whereConditions }),
      ]);
    } catch (error) {
      console.error('数据库查询错误:', error);
      return NextResponse.json(
        { success: false, error: '查询应收账款数据失败' },
        { status: 500 }
      );
    }

    // 转换为应收账款格式
    const receivables = salesOrders.map((order: any) => {
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

    // 根据状态筛选
    const filteredReceivables = status
      ? receivables.filter(r => r.paymentStatus === status)
      : receivables;

    // 应用分页到筛选后的结果
    const paginatedReceivables = filteredReceivables.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    // 计算统计数据
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
