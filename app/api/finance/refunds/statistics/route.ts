import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export async function GET(_request: NextRequest) {
  try {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: '未授权访问' }, { status: 401 });
      }
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // 并行查询所有统计数据
    const [
      todayStats,
      monthStats,
      yearStats,
      urgentCount,
      statusStats,
      recentRefunds,
    ] = await Promise.all([
      // 今日统计
      prisma.refundRecord.aggregate({
        where: {
          createdAt: { gte: startOfToday },
        },
        _sum: { refundAmount: true, processedAmount: true },
        _count: true,
      }),

      // 本月统计
      prisma.refundRecord.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
        },
        _sum: { refundAmount: true, processedAmount: true },
        _count: true,
      }),

      // 本年统计
      prisma.refundRecord.aggregate({
        where: {
          createdAt: { gte: startOfYear },
        },
        _sum: { refundAmount: true, processedAmount: true },
        _count: true,
      }),

      // 紧急处理数量（超过7天未处理）
      prisma.refundRecord.count({
        where: {
          status: { in: ['pending', 'processing'] },
          createdAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // 状态统计
      prisma.refundRecord.groupBy({
        by: ['status'],
        _count: true,
        _sum: { refundAmount: true, processedAmount: true },
      }),

      // 最近退款记录
      prisma.refundRecord.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          salesOrder: {
            include: { customer: true },
          },
        },
      }),
    ]);

    // 计算处理率
    const calculateProcessingRate = (processed: number, total: number) =>
      total > 0 ? Math.round((processed / total) * 100) : 0;

    const statistics = {
      today: {
        totalAmount: todayStats._sum.refundAmount || 0,
        processedAmount: todayStats._sum.processedAmount || 0,
        // 修复：添加待处理金额字段
        pendingAmount:
          (todayStats._sum.refundAmount || 0) -
          (todayStats._sum.processedAmount || 0),
        count: todayStats._count,
        processingRate: calculateProcessingRate(
          todayStats._sum.processedAmount || 0,
          todayStats._sum.refundAmount || 0
        ),
      },
      month: {
        totalAmount: monthStats._sum.refundAmount || 0,
        processedAmount: monthStats._sum.processedAmount || 0,
        // 修复：添加待处理金额字段
        pendingAmount:
          (monthStats._sum.refundAmount || 0) -
          (monthStats._sum.processedAmount || 0),
        count: monthStats._count,
        processingRate: calculateProcessingRate(
          monthStats._sum.processedAmount || 0,
          monthStats._sum.refundAmount || 0
        ),
      },
      year: {
        totalAmount: yearStats._sum.refundAmount || 0,
        processedAmount: yearStats._sum.processedAmount || 0,
        // 修复：添加待处理金额字段
        pendingAmount:
          (yearStats._sum.refundAmount || 0) -
          (yearStats._sum.processedAmount || 0),
        count: yearStats._count,
        processingRate: calculateProcessingRate(
          yearStats._sum.processedAmount || 0,
          yearStats._sum.refundAmount || 0
        ),
      },
      urgent: urgentCount,
      statusBreakdown: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count,
        totalAmount: stat._sum.refundAmount || 0,
        processedAmount: stat._sum.processedAmount || 0,
      })),
      recentRefunds: recentRefunds.map(refund => ({
        id: refund.id,
        refundNumber: refund.refundNumber,
        customerName: refund.salesOrder?.customer?.name || '未知客户',
        refundAmount: refund.refundAmount,
        status: refund.status,
        createdAt: refund.createdAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('获取退款统计数据失败:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}
