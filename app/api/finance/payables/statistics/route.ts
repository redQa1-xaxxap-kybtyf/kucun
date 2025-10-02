// 应付款统计 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import type { PayableStatistics } from '@/lib/types/payable';

/**
 * GET /api/finance/payables/statistics - 获取应付款统计数据
 */
export async function GET(_request: NextRequest) {
  try {
    // 身份验证 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    // 获取当前日期范围
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 并行查询统计数据
    const [
      totalPayablesResult,
      totalPaidAmountResult,
      totalRemainingAmountResult,
      overdueAmountResult,
      statusCounts,
      thisMonthPayablesResult,
      thisMonthPaymentsResult,
    ] = await Promise.all([
      // 总应付金额
      prisma.payableRecord.aggregate({
        _sum: {
          payableAmount: true,
        },
        where: {
          status: {
            not: 'cancelled',
          },
        },
      }),

      // 总已付金额
      prisma.payableRecord.aggregate({
        _sum: {
          paidAmount: true,
        },
        where: {
          status: {
            not: 'cancelled',
          },
        },
      }),

      // 总剩余金额
      prisma.payableRecord.aggregate({
        _sum: {
          remainingAmount: true,
        },
        where: {
          status: {
            not: 'cancelled',
          },
        },
      }),

      // 逾期金额
      prisma.payableRecord.aggregate({
        _sum: {
          remainingAmount: true,
        },
        where: {
          status: 'overdue',
        },
      }),

      // 各状态数量统计
      prisma.payableRecord.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
        where: {
          status: {
            not: 'cancelled',
          },
        },
      }),

      // 本月应付款
      prisma.payableRecord.aggregate({
        _sum: {
          payableAmount: true,
        },
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: {
            not: 'cancelled',
          },
        },
      }),

      // 本月付款
      prisma.paymentOutRecord.aggregate({
        _sum: {
          paymentAmount: true,
        },
        where: {
          paymentDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: 'confirmed',
        },
      }),
    ]);

    // 处理状态统计
    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    // 构建统计数据
    const statistics: PayableStatistics = {
      totalPayables: totalPayablesResult._sum.payableAmount || 0,
      totalPaidAmount: totalPaidAmountResult._sum.paidAmount || 0,
      totalRemainingAmount:
        totalRemainingAmountResult._sum.remainingAmount || 0,
      overdueAmount: overdueAmountResult._sum.remainingAmount || 0,
      pendingCount: statusCountMap.pending || 0,
      paidCount: statusCountMap.paid || 0,
      overdueCount: statusCountMap.overdue || 0,
      thisMonthPayables: thisMonthPayablesResult._sum.payableAmount || 0,
      thisMonthPayments: thisMonthPaymentsResult._sum.paymentAmount || 0,
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('获取应付款统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取应付款统计失败' },
      { status: 500 }
    );
  }
}
