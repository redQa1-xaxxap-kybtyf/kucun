import { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 应收货款统计API
 * GET /api/finance/receivables/statistics - 获取应收账款统计数据
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
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
    const [salesOrderStats, paymentStats, prepaymentUsageStats] =
      await Promise.all([
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
            paymentType: 'order_payment',
            salesOrder: whereConditions,
          },
          _sum: {
            paymentAmount: true,
          },
          _count: {
            id: true,
          },
        }),
        prisma.prepaymentUsage.aggregate({
          where: {
            salesOrder: whereConditions,
          },
          _sum: {
            appliedAmount: true,
          },
        }),
      ]);

    // 计算基础统计数据（注意 Prisma Decimal 类型统一转为 number）
    const totalReceivable = Number(salesOrderStats._sum.totalAmount ?? 0);
    const totalReceivedPayments = Number(paymentStats._sum.paymentAmount ?? 0);
    const totalPrepaymentApplied = Number(
      prepaymentUsageStats._sum.appliedAmount ?? 0
    );
    const totalReceived = totalReceivedPayments + totalPrepaymentApplied;
    const totalPending = totalReceivable - totalReceived;
    const receivableCount = salesOrderStats._count.id || 0;
    const receivedCount = paymentStats._count.id || 0;

    const overdueThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30天前的订单
    const overdueConditions: Prisma.Sql[] = [
      Prisma.sql`so.status IN ('confirmed', 'shipped', 'completed')`,
      Prisma.sql`so.created_at <= ${overdueThreshold}`,
    ];

    if (customerId) {
      overdueConditions.push(Prisma.sql`so.customer_id = ${customerId}`);
    }

    const overdueRow =
      (
        await prisma.$queryRaw<
          Array<{ totalOverdue: unknown; overdueCount: unknown }>
        >(
          Prisma.sql`
            SELECT
              COALESCE(SUM(
                CASE
                  WHEN (so.total_amount - COALESCE(paid.paidAmount, 0) - COALESCE(prepay.appliedAmount, 0)) > 0 THEN (so.total_amount - COALESCE(paid.paidAmount, 0) - COALESCE(prepay.appliedAmount, 0))
                  ELSE 0
                END
              ), 0) AS totalOverdue,
              COALESCE(SUM(
                CASE
                  WHEN (so.total_amount - COALESCE(paid.paidAmount, 0) - COALESCE(prepay.appliedAmount, 0)) > 0 THEN 1
                  ELSE 0
                END
              ), 0) AS overdueCount
            FROM sales_orders so
            LEFT JOIN (
              SELECT sales_order_id, SUM(payment_amount) AS paidAmount
              FROM payment_records
              WHERE status = 'confirmed' AND payment_type = 'order_payment'
              GROUP BY sales_order_id
            ) paid ON paid.sales_order_id = so.id
            LEFT JOIN (
              SELECT sales_order_id, SUM(applied_amount) AS appliedAmount
              FROM prepayment_usages
              GROUP BY sales_order_id
            ) prepay ON prepay.sales_order_id = so.id
            WHERE ${Prisma.join(overdueConditions, ' AND ')}
          `
        )
      )[0] ?? null;

    const totalOverdue = Number(overdueRow?.totalOverdue ?? 0);
    const overdueCount = Number(overdueRow?.overdueCount ?? 0);

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
      const salesAggregate = monthlyResults[index * 2] as {
        _sum: { totalAmount: unknown };
      };
      const paymentAggregate = monthlyResults[index * 2 + 1] as {
        _sum: { paymentAmount: unknown };
      };

      const salesAmount = Number(salesAggregate._sum.totalAmount ?? 0);
      const receivedAmount = Number(paymentAggregate._sum.paymentAmount ?? 0);

      return {
        month: range.month,
        salesAmount,
        receivedAmount,
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
              where: { status: 'confirmed', paymentType: 'order_payment' },
              select: { paymentAmount: true },
            },
            prepaymentUsages: {
              select: { appliedAmount: true },
            },
          },
        },
      },
      take: 10,
    });

    const customerPaymentStats = customerStats
      .map(customer => {
        const totalAmount = customer.salesOrders.reduce(
          (sum, order) => sum + Number(order.totalAmount ?? 0),
          0
        );

        const paidAmount = customer.salesOrders.reduce((sum, order) => {
          const orderPaid = order.payments.reduce(
            (paySum, payment) => paySum + Number(payment.paymentAmount ?? 0),
            0
          );
          const prepaymentApplied = order.prepaymentUsages.reduce(
            (preSum, usage) => preSum + Number(usage.appliedAmount ?? 0),
            0
          );
          return sum + orderPaid + prepaymentApplied;
        }, 0);
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
    logger.error('finance-receivables', '获取应收账款统计失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取应收账款统计失败',
      },
      { status: 500 }
    );
  }
});
