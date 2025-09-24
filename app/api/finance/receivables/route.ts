import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { compareDates } from '@/lib/utils/datetime';

/**
 * 应收货款API
 * GET /api/finance/receivables - 获取应收账款列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
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
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 构建查询条件
    const whereConditions = {
      status: { in: ['confirmed', 'shipped', 'completed'] }, // 只查询已确认的订单
    } as const;

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
    const [salesOrders, total] = await Promise.all([
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
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.salesOrder.count({ where: whereConditions }),
    ]);

    // 转换为应收账款格式
    const receivables = salesOrders.map(order => {
      const paidAmount = order.payments.reduce(
        (sum, payment) => sum + payment.paymentAmount,
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
          ? order.payments.sort((a, b) =>
              compareDates(b.paymentDate, a.paymentDate)
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
        orderDate: formatDate(order.createdAt),
        dueDate: formatDate(
          new Date(orderDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        ), // 30天后到期
        overdueDays:
          paymentStatus === 'overdue' ? Math.max(0, daysSinceOrder - 30) : 0,
        lastPaymentDate: lastPaymentDate
          ? formatDate(lastPaymentDate)
          : undefined,
      };
    });

    // 根据状态筛选
    const filteredReceivables = status
      ? receivables.filter(r => r.paymentStatus === status)
      : receivables;

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
        receivables: filteredReceivables,
        pagination: {
          page,
          pageSize,
          total: status ? filteredReceivables.length : total,
          totalPages: Math.ceil(
            (status ? filteredReceivables.length : total) / pageSize
          ),
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
