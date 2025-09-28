// 退货订单统计API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/return-orders/stats - 获取退货订单统计信息
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 获取当前月份的开始和结束时间
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 并行查询各种统计数据
    const [
      totalReturns,
      totalRefundAmount,
      pendingCount,
      approvedCount,
      rejectedCount,
      completedCount,
      monthlyReturns,
      monthlyRefundAmount,
    ] = await Promise.all([
      // 总退货数量
      prisma.returnOrder.count(),
      
      // 总退款金额
      prisma.returnOrder.aggregate({
        _sum: {
          refundAmount: true,
        },
      }),
      
      // 待处理数量
      prisma.returnOrder.count({
        where: {
          status: {
            in: ['draft', 'submitted'],
          },
        },
      }),
      
      // 已审核数量
      prisma.returnOrder.count({
        where: {
          status: 'approved',
        },
      }),
      
      // 已拒绝数量
      prisma.returnOrder.count({
        where: {
          status: 'rejected',
        },
      }),
      
      // 已完成数量
      prisma.returnOrder.count({
        where: {
          status: 'completed',
        },
      }),
      
      // 本月退货数量
      prisma.returnOrder.count({
        where: {
          createdAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
      }),
      
      // 本月退款金额
      prisma.returnOrder.aggregate({
        where: {
          createdAt: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
        _sum: {
          refundAmount: true,
        },
      }),
    ]);

    // 构建统计结果
    const stats = {
      totalReturns,
      totalRefundAmount: totalRefundAmount._sum.refundAmount || 0,
      pendingCount,
      approvedCount,
      rejectedCount,
      completedCount,
      monthlyReturns,
      monthlyRefundAmount: monthlyRefundAmount._sum.refundAmount || 0,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取退货订单统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取退货订单统计失败' },
      { status: 500 }
    );
  }
}
