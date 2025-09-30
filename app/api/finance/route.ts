import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { getFinanceStatisticsCache } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';

/**
 * 财务管理概览API
 * GET /api/finance - 获取财务管理概览数据
 */
export async function GET(_request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 尝试从缓存获取数据
    const cached = await getFinanceStatisticsCache();
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // 获取财务概览统计数据
    const [
      totalReceivableResult,
      totalRefundableResult,
      overdueAmountResult,
      monthlyReceivedResult,
    ] = await Promise.all([
      // 总应收金额 - 基于销售订单和已收款计算
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(so.total_amount), 0) as total_amount,
          COALESCE(SUM(pr.payment_amount), 0) as paid_amount
        FROM sales_orders so
        LEFT JOIN payment_records pr ON so.id = pr.sales_order_id AND pr.status = 'confirmed'
        WHERE so.status IN ('confirmed', 'shipped', 'completed')
      `,

      // 总应退金额 - 修复：基于remainingAmount计算真实待付金额
      prisma.$queryRaw`
        SELECT COALESCE(SUM(remaining_amount), 0) as total_refundable
        FROM refund_records
        WHERE status IN ('pending', 'processing') AND remaining_amount > 0
      `,

      // 逾期金额 - 基于销售订单创建时间超过30天的未付款订单
      prisma.$queryRaw`
        SELECT COALESCE(SUM(so.total_amount - COALESCE(pr.paid_amount, 0)), 0) as overdue_amount
        FROM sales_orders so
        LEFT JOIN (
          SELECT sales_order_id, SUM(payment_amount) as paid_amount
          FROM payment_records
          WHERE status = 'confirmed'
          GROUP BY sales_order_id
        ) pr ON so.id = pr.sales_order_id
        WHERE so.status IN ('confirmed', 'shipped', 'completed')
        AND so.created_at < datetime('now', '-30 days')
        AND (so.total_amount - COALESCE(pr.paid_amount, 0)) > 0
      `,

      // 本月收款 - 基于本月的收款记录
      prisma.$queryRaw`
        SELECT COALESCE(SUM(payment_amount), 0) as monthly_received
        FROM payment_records
        WHERE status = 'confirmed'
        AND strftime('%Y-%m', payment_date) = strftime('%Y-%m', datetime('now'))
      `,
    ]);

    // 处理查询结果
    const receivableData = Array.isArray(totalReceivableResult)
      ? totalReceivableResult[0]
      : totalReceivableResult;
    const refundableData = Array.isArray(totalRefundableResult)
      ? totalRefundableResult[0]
      : totalRefundableResult;
    const overdueData = Array.isArray(overdueAmountResult)
      ? overdueAmountResult[0]
      : overdueAmountResult;
    const monthlyData = Array.isArray(monthlyReceivedResult)
      ? monthlyReceivedResult[0]
      : monthlyReceivedResult;

    // 计算统计数据
    const totalReceivable = Number(receivableData?.total_amount || 0);
    const totalPaid = Number(receivableData?.paid_amount || 0);
    const totalPending = totalReceivable - totalPaid;
    const totalRefundable = Number(refundableData?.total_refundable || 0);
    const overdueAmount = Number(overdueData?.overdue_amount || 0);
    const monthlyReceived = Number(monthlyData?.monthly_received || 0);

    // 获取订单数量统计
    const [receivableCount, refundCount, overdueCount] = await Promise.all([
      prisma.salesOrder.count({
        where: {
          status: { in: ['confirmed', 'shipped', 'completed'] },
        },
      }),
      // 退款记录数量
      prisma.refundRecord.count({
        where: {
          status: { in: ['pending', 'processing', 'completed'] },
        },
      }),
      // 逾期订单数量
      prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM sales_orders so
        LEFT JOIN (
          SELECT sales_order_id, SUM(payment_amount) as paid_amount
          FROM payment_records
          WHERE status = 'confirmed'
          GROUP BY sales_order_id
        ) pr ON so.id = pr.sales_order_id
        WHERE so.status IN ('confirmed', 'shipped', 'completed')
        AND so.created_at < datetime('now', '-30 days')
        AND (so.total_amount - COALESCE(pr.paid_amount, 0)) > 0
      `.then((result: unknown) => {
        const typedResult = result as any[];
        return Number(typedResult[0]?.count || 0);
      }),
    ]);

    const financeOverview = {
      totalReceivable: totalPending, // 实际应收金额（未收款部分）
      totalRefundable,
      overdueAmount,
      monthlyReceived,
      receivableCount,
      refundCount,
      overdueCount,
      summary: {
        totalOrders: receivableCount,
        totalAmount: totalReceivable,
        paidAmount: totalPaid,
        pendingAmount: totalPending,
        paymentRate:
          totalReceivable > 0 ? (totalPaid / totalReceivable) * 100 : 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: financeOverview,
    });
  } catch (error) {
    console.error('获取财务概览失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取财务概览失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 财务数据统计API
 * POST /api/finance - 获取指定条件的财务统计数据
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      startDate,
      endDate,
      customerId,
      includeRefunds = true,
      includeStatements = true,
    } = body;

    // 构建查询条件
    const whereConditions: Record<string, unknown> = {};

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
    const salesOrderStats = await prisma.salesOrder.aggregate({
      where: whereConditions,
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // 获取收款统计
    const paymentStats = await prisma.paymentRecord.aggregate({
      where: {
        ...whereConditions,
        status: 'confirmed',
      },
      _sum: {
        paymentAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // 构建响应数据
    const statisticsData: any = {
      period: {
        startDate,
        endDate,
      },
      sales: {
        totalAmount: salesOrderStats._sum.totalAmount || 0,
        orderCount: salesOrderStats._count.id || 0,
      },
      payments: {
        totalAmount: paymentStats._sum.paymentAmount || 0,
        paymentCount: paymentStats._count.id || 0,
      },
      receivables: {
        totalAmount:
          (salesOrderStats._sum.totalAmount || 0) -
          (paymentStats._sum.paymentAmount || 0),
        paymentRate: salesOrderStats._sum.totalAmount
          ? ((paymentStats._sum.paymentAmount || 0) /
              salesOrderStats._sum.totalAmount) *
            100
          : 0,
      },
    };

    // 如果需要包含退款数据
    if (includeRefunds) {
      const refundStats = await prisma.refundRecord.aggregate({
        where: {
          ...whereConditions,
          status: { in: ['pending', 'processing', 'completed'] },
        },
        _sum: {
          refundAmount: true,
        },
        _count: {
          id: true,
        },
      });

      statisticsData.refunds = {
        totalAmount: refundStats._sum.refundAmount || 0,
        refundCount: refundStats._count.id || 0,
      };
    }

    // 如果需要包含往来账单数据
    if (includeStatements) {
      const customerCount = await prisma.customer.count();
      statisticsData.statements = {
        customerCount,
        supplierCount: 0, // 暂时没有供应商表
        totalReceivable:
          (salesOrderStats._sum.totalAmount || 0) -
          (paymentStats._sum.paymentAmount || 0),
        totalPayable: 0,
      };
    }

    // 设置缓存
    await setFinanceStatisticsCache(statisticsData);

    return NextResponse.json({
      success: true,
      data: statisticsData,
      cached: false,
    });
  } catch (error) {
    console.error('获取财务统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取财务统计失败',
      },
      { status: 500 }
    );
  }
}
