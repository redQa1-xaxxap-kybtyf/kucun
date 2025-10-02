/**
 * 系统日志API路由
 * 遵循 Next.js 15.4 App Router 架构和全局约定规范
 */

import { getServerSession } from 'next-auth';
import { type NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SystemLogListRequestSchema } from '@/lib/schemas/settings';
import type {
  SystemLog,
  SystemLogLevel,
  SystemLogListResponse,
  SystemLogType,
} from '@/lib/types/settings';

/**
 * GET /api/logs - 获取系统日志列表
 * 支持分页、筛选等查询参数
 */
export async function GET(request: NextRequest) {
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

    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const validationResult = SystemLogListRequestSchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      filters: {
        type: searchParams.get('type') || null,
        level: searchParams.get('level') || null,
        userId: searchParams.get('userId') || null,
        action: searchParams.get('action') || null,
        startDate: searchParams.get('startDate') || null,
        endDate: searchParams.get('endDate') || null,
        search: searchParams.get('search') || null,
      },
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { page, limit, filters } = validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.level) {
      where.level = filters.level;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.action) {
      where.action = { contains: filters.action };
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(
          filters.startDate
        );
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(
          filters.endDate
        );
      }
    }

    if (filters?.search) {
      where.OR = [
        { action: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    // 计算分页
    const skip = (page - 1) * limit;

    // 查询日志列表
    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.systemLog.count({ where }),
    ]);

    // 格式化日志数据
    const formattedLogs: SystemLog[] = logs.map(log => ({
      id: log.id,
      type: log.type as SystemLogType,
      level: log.level as SystemLogLevel,
      action: log.action,
      description: log.description,
      userId: log.userId,
      user: log.user,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAt: log.createdAt.toISOString(),
    }));

    const response: SystemLogListResponse = {
      logs: formattedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('获取系统日志失败:', error);
    return NextResponse.json(
      { success: false, error: '获取系统日志失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/logs - 清理过期日志
 */
export async function DELETE(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 只有管理员可以清理日志
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      );
    }

    // 解析请求参数
    const searchParams = new URL(request.url).searchParams;
    const retentionDays = parseInt(searchParams.get('retentionDays') || '90');

    if (retentionDays < 1 || retentionDays > 365) {
      return NextResponse.json(
        { success: false, error: '保留天数必须在1-365之间' },
        { status: 400 }
      );
    }

    // 计算截止日期
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // 删除过期日志
    const result = await prisma.systemLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString(),
      },
      message: `成功清理 ${result.count} 条过期日志`,
    });
  } catch (error) {
    console.error('清理过期日志失败:', error);
    return NextResponse.json(
      { success: false, error: '清理过期日志失败' },
      { status: 500 }
    );
  }
}
