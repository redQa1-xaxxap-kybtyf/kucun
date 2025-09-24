/**
 * 系统日志API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractRequestInfo, logSystemEventInfo } from '@/lib/logger';
import {
  SystemLogCleanupRequestSchema,
  SystemLogListRequestSchema,
} from '@/lib/schemas/settings';
import type {
  SettingsApiResponse,
  SystemLog,
  SystemLogFilters,
  SystemLogListResponse,
} from '@/lib/types/settings';

/**
 * 构建日志查询条件
 */
function buildLogWhereCondition(
  filters?: SystemLogFilters
): Record<string, unknown> {
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
    where.action = {
      contains: filters.action,
    };
  }

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(
        filters.startDate
      );
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // 设置为当天结束时间
      (where.createdAt as Record<string, unknown>).lte = endDate;
    }
  }

  if (filters?.search) {
    where.OR = [
      {
        description: {
          contains: filters.search,
        },
      },
      {
        action: {
          contains: filters.search,
        },
      },
    ];
  }

  return where;
}

/**
 * 转换数据库日志为API响应格式
 */
function transformLogsForResponse(
  logs: Array<{
    id: string;
    type: string;
    level: string;
    action: string;
    description: string;
    userId: string | null;
    user: { id: string; name: string; username: string } | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: string | null;
    createdAt: Date;
  }>
): SystemLog[] {
  return logs.map(log => ({
    id: log.id,
    type: log.type as SystemLog['type'],
    level: log.level as SystemLog['level'],
    action: log.action,
    description: log.description,
    userId: log.userId,
    user: log.user,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
    createdAt: log.createdAt.toISOString(),
  }));
}

/**
 * 获取系统日志列表
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SettingsApiResponse<SystemLogListResponse>>> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 检查管理员权限
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以查看系统日志' },
        { status: 403 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || undefined;
    const level = searchParams.get('level') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const action = searchParams.get('action') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;

    // 验证请求参数
    const validatedRequest = SystemLogListRequestSchema.parse({
      page,
      limit,
      filters: {
        type,
        level,
        userId,
        action,
        startDate,
        endDate,
        search,
      },
    });

    // 构建查询条件
    const where = buildLogWhereCondition(validatedRequest.filters);

    // 计算偏移量
    const skip = (validatedRequest.page - 1) * validatedRequest.limit;

    // 查询日志总数
    const total = await prisma.systemLog.count({ where });

    // 查询日志列表
    const logs = await prisma.systemLog.findMany({
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
      take: validatedRequest.limit,
    });

    // 转换数据格式
    const transformedLogs = transformLogsForResponse(logs);

    // 计算总页数
    const totalPages = Math.ceil(total / validatedRequest.limit);

    const response: SystemLogListResponse = {
      logs: transformedLogs,
      total,
      page: validatedRequest.page,
      limit: validatedRequest.limit,
      totalPages,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('获取系统日志失败:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: '请求参数格式不正确' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '获取系统日志失败' },
      { status: 500 }
    );
  }
}

/**
 * 清理系统日志
 */
export async function DELETE(
  request: NextRequest
): Promise<
  NextResponse<SettingsApiResponse<{ message: string; deletedCount: number }>>
> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 检查管理员权限
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以清理系统日志' },
        { status: 403 }
      );
    }

    // 获取请求信息用于日志记录
    const requestInfo = extractRequestInfo(request);

    // 检查是否为清空所有日志的请求
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      // 清空所有日志
      // 先记录清空操作日志（在清空之前记录）
      await logSystemEventInfo(
        'clear_all_logs',
        `管理员清空所有系统日志 - 操作者：${session.user.name} (${session.user.username})`,
        session.user.id,
        requestInfo.ipAddress,
        requestInfo.userAgent,
        {
          operatorId: session.user.id,
          operatorName: session.user.name,
          operatorUsername: session.user.username,
          operationType: 'clear_all_logs',
          timestamp: new Date().toISOString(),
        }
      );

      // 执行清空操作
      const result = await prisma.systemLog.deleteMany({});

      return NextResponse.json({
        success: true,
        data: {
          message: '所有系统日志已清空',
          deletedCount: result.count,
        },
      });
    }

    // 原有的按条件清理逻辑
    const body = await request.json();
    const validatedData = SystemLogCleanupRequestSchema.parse(body);

    // 构建删除条件
    const where: Record<string, unknown> = {
      createdAt: {
        lt: new Date(validatedData.beforeDate),
      },
    };

    if (validatedData.types && validatedData.types.length > 0) {
      where.type = {
        in: validatedData.types,
      };
    }

    // 记录清理操作日志
    await logSystemEventInfo(
      'cleanup_logs',
      `清理系统日志 - 操作者：${session.user.name}，清理条件：${validatedData.beforeDate}之前的日志`,
      session.user.id,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      {
        operatorId: session.user.id,
        operatorName: session.user.name,
        cleanupConditions: validatedData,
      }
    );

    // 执行删除操作
    const result = await prisma.systemLog.deleteMany({
      where,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: '系统日志清理完成',
        deletedCount: result.count,
      },
    });
  } catch (error) {
    console.error('清理系统日志失败:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: '请求参数格式不正确' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '清理系统日志失败' },
      { status: 500 }
    );
  }
}
