/**
 * 系统日志统计API路由
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/logs/statistics - 获取系统日志统计数据
 */
export async function GET(_request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 只有管理员可以查看日志统计
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      );
    }

    // 获取统计数据
    const [
      totalLogs,
      logsByType,
      logsByLevel,
      recentErrors,
      recentSecurity,
      todayLogs,
      weekLogs,
    ] = await Promise.all([
      // 总日志数
      prisma.systemLog.count(),

      // 按类型统计
      prisma.systemLog.groupBy({
        by: ['type'],
        _count: {
          id: true,
        },
      }),

      // 按级别统计
      prisma.systemLog.groupBy({
        by: ['level'],
        _count: {
          id: true,
        },
      }),

      // 最近错误日志
      prisma.systemLog.count({
        where: {
          level: 'error',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 最近24小时
          },
        },
      }),

      // 最近安全日志
      prisma.systemLog.count({
        where: {
          type: 'security',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 最近24小时
          },
        },
      }),

      // 今日日志数
      prisma.systemLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // 本周日志数
      prisma.systemLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // 格式化统计数据
    const statistics = {
      total: totalLogs,
      byType: logsByType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
      byLevel: logsByLevel.reduce(
        (acc, item) => {
          acc[item.level] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentErrors,
      recentSecurity,
      todayLogs,
      weekLogs,
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('获取日志统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取日志统计失败' },
      { status: 500 }
    );
  }
}
