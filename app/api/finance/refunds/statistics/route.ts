// 退款统计API
// 提供退款相关的统计数据和分析报告

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/finance/refunds/statistics
 * 获取退款统计数据
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 构建时间范围过滤条件
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const whereCondition =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // 并行执行所有统计查询
    const [
      totalStats,
      statusStats,
      methodStats,
      typeStats,
      monthlyTrends,
      topCustomers,
    ] = await Promise.all([
      // 1. 总体统计
      prisma.refundRecord.aggregate({
        where: whereCondition,
        _sum: {
          refundAmount: true,
          processedAmount: true,
          remainingAmount: true,
        },
        _count: {
          id: true,
        },
      }),

      // 2. 按状态统计
      prisma.refundRecord.groupBy({
        by: ['status'],
        where: whereCondition,
        _sum: {
          refundAmount: true,
          processedAmount: true,
        },
        _count: {
          id: true,
        },
      }),

      // 3. 按退款方式统计
      prisma.refundRecord.groupBy({
        by: ['refundMethod'],
        where: whereCondition,
        _sum: {
          refundAmount: true,
          processedAmount: true,
        },
        _count: {
          id: true,
        },
      }),

      // 4. 按退款类型统计
      prisma.refundRecord.groupBy({
        by: ['refundType'],
        where: whereCondition,
        _sum: {
          refundAmount: true,
          processedAmount: true,
        },
        _count: {
          id: true,
        },
      }),

      // 5. 月度趋势（最近12个月）
      prisma.$queryRaw`
        SELECT
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as count,
          SUM(refund_amount) as total_amount,
          SUM(processed_amount) as processed_amount
        FROM refund_records
        WHERE created_at >= datetime('now', '-12 months')
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month DESC
        LIMIT 12
      `,

      // 6. 退款金额最多的客户（前10名）
      prisma.refundRecord.groupBy({
        by: ['customerId'],
        where: whereCondition,
        _sum: {
          refundAmount: true,
          processedAmount: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            refundAmount: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    // 获取客户信息
    const customerIds = topCustomers.map(item => item.customerId);
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    // 构建客户映射
    const customerMap = customers.reduce(
      (map, customer) => {
        map[customer.id] = customer;
        return map;
      },
      {} as Record<string, any>
    );

    // 处理统计结果
    const statistics = {
      // 总体统计
      overview: {
        totalRefunds: totalStats._count.id || 0,
        totalRefundAmount: totalStats._sum.refundAmount || 0,
        totalProcessedAmount: totalStats._sum.processedAmount || 0,
        totalRemainingAmount: totalStats._sum.remainingAmount || 0,
        processingRate: totalStats._sum.refundAmount
          ? (
              ((totalStats._sum.processedAmount || 0) /
                totalStats._sum.refundAmount) *
              100
            ).toFixed(2)
          : '0.00',
      },

      // 按状态统计
      byStatus: statusStats.map(item => ({
        status: item.status,
        count: item._count.id,
        totalAmount: item._sum.refundAmount || 0,
        processedAmount: item._sum.processedAmount || 0,
      })),

      // 按退款方式统计
      byMethod: methodStats.map(item => ({
        method: item.refundMethod,
        count: item._count.id,
        totalAmount: item._sum.refundAmount || 0,
        processedAmount: item._sum.processedAmount || 0,
      })),

      // 按退款类型统计
      byType: typeStats.map(item => ({
        type: item.refundType,
        count: item._count.id,
        totalAmount: item._sum.refundAmount || 0,
        processedAmount: item._sum.processedAmount || 0,
      })),

      // 月度趋势
      monthlyTrends: (monthlyTrends as any[]).map(item => ({
        month: item.month,
        count: Number(item.count),
        totalAmount: Number(item.total_amount || 0),
        processedAmount: Number(item.processed_amount || 0),
      })),

      // 客户排行
      topCustomers: topCustomers.map(item => ({
        customer: customerMap[item.customerId] || {
          id: item.customerId,
          name: '未知客户',
          phone: '',
        },
        refundCount: item._count.id,
        totalRefundAmount: item._sum.refundAmount || 0,
        totalProcessedAmount: item._sum.processedAmount || 0,
      })),
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('获取退款统计数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取退款统计数据失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/finance/refunds/statistics/summary
 * 获取退款概要统计（用于仪表盘）
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 获取今日、本月、本年的统计数据
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [todayStats, monthStats, yearStats, urgentRefunds] =
      await Promise.all([
        // 今日统计
        prisma.refundRecord.aggregate({
          where: {
            createdAt: { gte: todayStart },
          },
          _sum: {
            refundAmount: true,
            processedAmount: true,
          },
          _count: { id: true },
        }),

        // 本月统计
        prisma.refundRecord.aggregate({
          where: {
            createdAt: { gte: monthStart },
          },
          _sum: {
            refundAmount: true,
            processedAmount: true,
          },
          _count: { id: true },
        }),

        // 本年统计
        prisma.refundRecord.aggregate({
          where: {
            createdAt: { gte: yearStart },
          },
          _sum: {
            refundAmount: true,
            processedAmount: true,
          },
          _count: { id: true },
        }),

        // 紧急处理的退款（超过7天未处理）
        prisma.refundRecord.count({
          where: {
            status: 'pending',
            createdAt: {
              lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    const summary = {
      today: {
        count: todayStats._count.id || 0,
        amount: todayStats._sum.refundAmount || 0,
        processed: todayStats._sum.processedAmount || 0,
      },
      month: {
        count: monthStats._count.id || 0,
        amount: monthStats._sum.refundAmount || 0,
        processed: monthStats._sum.processedAmount || 0,
      },
      year: {
        count: yearStats._count.id || 0,
        amount: yearStats._sum.refundAmount || 0,
        processed: yearStats._sum.processedAmount || 0,
      },
      urgent: urgentRefunds,
    };

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('获取退款概要统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取退款概要统计失败' },
      { status: 500 }
    );
  }
}
