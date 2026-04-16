/**
 * 系统日志API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env, logExtendedConfig } from '@/lib/env';
import { extractRequestInfo, logSystemEventInfo } from '@/lib/logger';
import type {
  SettingsApiResponse,
  SystemLog,
  SystemLogFilters,
  SystemLogLevel,
  SystemLogListResponse,
  SystemLogType,
} from '@/lib/types/settings';
import {
  SystemLogCleanupRequestSchema,
  SystemLogListRequestSchema,
} from '@/lib/validations/settings';

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
 * 安全解析日志元数据，防止因格式不规范导致接口失败
 */
function parseLogMetadata(
  metadata: string | null,
  logId?: string
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch (error) {
    console.warn('Failed to parse system log metadata', {
      logId,
      metadataPreview: metadata.slice(0, 200),
      error,
    });
    return { raw: metadata };
  }
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
    ipCountry: string | null;
    ipProvince: string | null;
    ipCity: string | null;
    ipLocation: string | null;
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
    metadata: parseLogMetadata(log.metadata, log.id),
    ipCountry: log.ipCountry,
    ipProvince: log.ipProvince,
    ipCity: log.ipCity,
    ipLocation: log.ipLocation,
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
    // 调试：打印环境变量
    console.log('🔍 调试信息:', {
      NODE_ENV: env.NODE_ENV,
      isDevelopment: env.NODE_ENV === 'development',
      processEnv: process.env.NODE_ENV,
    });

    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
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
        { success: false, error: '请求内容有误，请稍后重试' },
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
 * 定义关键系统日志，这些日志不应被清空以保持审计痕迹
 * 使用环境配置替代硬编码
 */
const CRITICAL_LOG_ACTIONS = logExtendedConfig.criticalActions;
const CRITICAL_LOG_TYPES: SystemLogType[] =
  logExtendedConfig.criticalTypes as SystemLogType[];
const CRITICAL_LOG_LEVELS: SystemLogLevel[] =
  logExtendedConfig.criticalLevels as SystemLogLevel[];

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
      await logSystemEventInfo(
        'clear_audit_logs_blocked',
        `已阻止清空审计日志 - 操作者：${session.user.name} (${session.user.username})`,
        session.user.id,
        requestInfo.ipAddress,
        requestInfo.userAgent,
        {
          operatorId: session.user.id,
          operatorName: session.user.name,
          operatorUsername: session.user.username,
          operationType: 'clear_audit_logs',
          timestamp: new Date().toISOString(),
          preservedLogTypes: CRITICAL_LOG_TYPES,
          preservedLogActions: CRITICAL_LOG_ACTIONS,
          preservedLogLevels: CRITICAL_LOG_LEVELS,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: '已禁用：不允许手动清空审计日志',
        },
        { status: 403 }
      );
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
        { success: false, error: '请求内容有误，请稍后重试' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '清理系统日志失败' },
      { status: 500 }
    );
  }
}

