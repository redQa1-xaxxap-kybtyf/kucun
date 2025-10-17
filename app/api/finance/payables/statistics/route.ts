// 应付款统计 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { PayableStatistics } from '@/lib/types/payable';

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    endOfMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
};

const fetchPayablesAggregates = async (
  startOfMonth: Date,
  endOfMonth: Date
) => {
  const [
    totalPayablesResult,
    totalPaidAmountResult,
    totalRemainingAmountResult,
    statusCounts,
    thisMonthPayablesResult,
    thisMonthPaymentsResult,
  ] = await Promise.all([
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

  return {
    totalPayablesResult,
    totalPaidAmountResult,
    totalRemainingAmountResult,
    statusCounts,
    thisMonthPayablesResult,
    thisMonthPaymentsResult,
  };
};

const createStatusCountMap = (
  statusCounts: Array<{ status: string; _count: { id: number } }>
) =>
  statusCounts.reduce(
    (acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

const buildStatistics = ({
  totalPayablesResult,
  totalPaidAmountResult,
  totalRemainingAmountResult,
  statusCounts,
  thisMonthPayablesResult,
  thisMonthPaymentsResult,
}: Awaited<ReturnType<typeof fetchPayablesAggregates>>): PayableStatistics => {
  const statusCountMap = createStatusCountMap(statusCounts);
  return {
    totalPayables: totalPayablesResult._sum.payableAmount || 0,
    totalPaidAmount: totalPaidAmountResult._sum.paidAmount || 0,
    totalRemainingAmount: totalRemainingAmountResult._sum.remainingAmount || 0,
    pendingCount: statusCountMap.pending || 0,
    paidCount: statusCountMap.paid || 0,
    thisMonthPayables: thisMonthPayablesResult._sum.payableAmount || 0,
    thisMonthPayments: thisMonthPaymentsResult._sum.paymentAmount || 0,
  };
};

/**
 * GET /api/finance/payables/statistics - 获取应付款统计数据
 */
export const GET = withAuth(async () => {
  try {
    const { startOfMonth, endOfMonth } = getCurrentMonthRange();
    const aggregates = await fetchPayablesAggregates(startOfMonth, endOfMonth);
    const statistics = buildStatistics(aggregates);

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    logger.error('finance-payables', '获取应付款统计失败', error);
    return NextResponse.json(
      { success: false, error: '获取应付款统计失败' },
      { status: 500 }
    );
  }
});
