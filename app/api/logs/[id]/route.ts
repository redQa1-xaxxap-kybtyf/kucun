/**
 * 系统日志详情API路由
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */

import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/logs/[id] - 获取系统日志详情
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 只有管理员可以查看日志
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 查询日志详情
    const log = await prisma.systemLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: '日志不存在' },
        { status: 404 }
      );
    }

    // 格式化日志数据
    const formattedLog = {
      id: log.id,
      type: log.type,
      level: log.level,
      action: log.action,
      description: log.description,
      userId: log.userId,
      user: log.user,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAt: log.createdAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: formattedLog,
    });
  } catch (error) {
    console.error('获取日志详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取日志详情失败' },
      { status: 500 }
    );
  }
}

