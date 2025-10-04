import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, verifyApiAuth } from '@/lib/api-helpers';
import { prisma } from '@/lib/db';

/**
 * 应收货款统计API
 * GET /api/finance/receivables/statistics - 获取应收账款统计数据
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证 - 始终验证,确保安全性
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const customerId = searchParams.get('customerId');

    // 构建查询条件
    const whereConditions: {
      status?: { in: string[] };
      createdAt?: { gte: Date; lte: Date };
      customerId?: string;
    } = {
      status: { in: ['confirmed', 'shipped', 'completed'] },
    };

    if (startDate && endDate) {
      whereConditions.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (customerId) {
      whereConditions.customerId = customerId;
    }

    // 获取销售订单统计
    const [salesOrderStats, paymentStats] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: whereConditions,
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.paymentRecord.aggregate({
        where: {
          status: 'confirmed',
          salesOrder: whereConditions,
        },
        _sum: {
          paymentAmount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // 计算基础统计数据
    const totalReceivable = salesOrderStats._sum.totalAmount || 0;
    const totalReceived = paymentStats._sum.paymentAmount || 0;
    const totalPending = totalReceivable - totalReceived;
    const receivableCount = salesOrderStats._count.id || 0;
    const receivedCount = paymentStats._count.id || 0;

    // 获取逾期数据（简化处理，实际应该基于到期日期）
    const overdueOrders = await prisma.salesOrder.findMany({
      where: {
        ...whereConditions,
        createdAt: {
          lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前的订单
        },
      },
      include: {
        payments: {
          where: { status: 'confirmed' },
          select: { paymentAmount: true },
        },
      },
    });

    // 计算逾期金额和数量
    let totalOverdue = 0;
    let overdueCount = 0;

    overdueOrders.forEach(order => {
      const paidAmount = order.payments.reduce(
        (sum, payment) => sum + payment.paymentAmount,
        0
      );
      const remainingAmount = order.totalAmount - paidAmount;
      if (remainingAmount > 0) {
        totalOverdue += remainingAmount;
        overdueCount++;
      }
    });

    // 计算平均收款天数（简化处理）
    const averagePaymentDays = 25; // 实际应该基于历史数据计算

    // 计算收款率
    const paymentRate =
      totalReceivable > 0 ? (totalReceived / totalReceivable) * 100 : 0;

    // 获取月度趋势数据（最近6个月）
    // 构建所有月份的日期范围
    const monthRanges = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      monthRanges.push({
        start: monthStart,
        end: monthEnd,
        month: monthStart.toISOString().slice(0, 7), // YYYY-MM格式
      });
    }

    // 并行执行所有月份的查询
    const monthlyQueries = monthRanges.flatMap(range => [
      prisma.salesOrder.aggregate({
        where: {
          status: { in: ['confirmed', 'shipped', 'completed'] },
          createdAt: {
            gte: range.start,
            lte: range.end,
          },
        },
        _sum: { totalAmount: true },
      }),
      prisma.paymentRecord.aggregate({
        where: {
          status: 'confirmed',
          paymentDate: {
            gte: range.start,
            lte: range.end,
          },
        },
        _sum: { paymentAmount: true },
      }),
    ]);

    // 一次性执行所有查询
    const monthlyResults = await Promise.all(monthlyQueries);

    // 解析结果构建趋势数据
    const monthlyTrends = monthRanges.map((range, index) => {
      const salesResult = monthlyResults[index * 2] as {
        _sum: { totalAmount: number | null };
      };
      const paymentResult = monthlyResults[index * 2 + 1] as {
        _sum: { paymentAmount: number | null };
      };

      return {
        month: range.month,
        salesAmount: salesResult._sum.totalAmount || 0,
        receivedAmount: paymentResult._sum.paymentAmount || 0,
      };
    });

    // 获取客户收款统计（前10名）
    const customerStats = await prisma.customer.findMany({
      include: {
        salesOrders: {
          where: {
            status: { in: ['confirmed', 'shipped', 'completed'] },
          },
          select: {
            totalAmount: true,
            payments: {
              where: { status: 'confirmed' },
              select: { paymentAmount: true },
            },
          },
        },
      },
      take: 10,
    });

    const customerPaymentStats = customerStats
      .map(customer => {
        const totalAmount = customer.salesOrders.reduce(
          (sum, order) => sum + order.totalAmount,
          0
        );
        const paidAmount = customer.salesOrders.reduce(
          (sum, order) =>
            sum +
            order.payments.reduce(
              (paySum, payment) => paySum + payment.paymentAmount,
              0
            ),
          0
        );
        const pendingAmount = totalAmount - paidAmount;

        return {
          customerId: customer.id,
          customerName: customer.name,
          totalOrders: customer.salesOrders.length,
          totalAmount,
          paidAmount,
          pendingAmount,
          paymentRate: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
        };
      })
      .filter(stat => stat.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const statistics = {
      totalReceivable,
      totalReceived,
      totalPending,
      totalOverdue,
      receivableCount,
      receivedCount,
      pendingCount: receivableCount - receivedCount,
      overdueCount,
      averagePaymentDays,
      paymentRate,
      monthlyTrends,
      customerStats: customerPaymentStats,
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('获取应收账款统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取应收账款统计失败',
      },
      { status: 500 }
    );
  }
}
