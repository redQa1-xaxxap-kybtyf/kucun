import { prisma } from '@/lib/db';
import type { SystemLogLevel, SystemLogType } from '@/lib/types/settings';

import {
  error as baseLogError,
  logger as baseLogger,
  warn as logWarn,
} from './logger/index';

export { baseLogger as logger };

/**
 * 动态导入 IP 地理位置服务（仅服务端）
 * 避免在客户端环境导入 Node.js 模块（fs, maxmind）
 */
async function getIpLocationSafe(ip: string | null | undefined): Promise<{
  country: string | null;
  province: string | null;
  city: string | null;
  fullLocation: string | null;
} | null> {
  // 只在服务端环境执行
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    const { getIpLocation } = await import('@/lib/services/ip-location');
    return await getIpLocation(ip);
  } catch (error) {
    baseLogError('logger', 'IP地理位置查询失败', error);
    return null;
  }
}

interface LogParams {
  type: SystemLogType;
  level: SystemLogLevel;
  action: string;
  description: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * 记录系统日志
 */
export async function logSystemEvent(params: LogParams): Promise<void> {
  try {
    // 如果提供了userId，验证用户是否存在
    let validUserId = params.userId;
    if (params.userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { id: true },
      });
      if (!userExists) {
        logWarn(
          'logger',
          `日志记录：用户ID ${params.userId} 不存在，将记录为系统操作`
        );
        validUserId = null;
      }
    }

    // 获取IP地理位置信息（异步非阻塞，仅服务端）
    let ipLocation = null;
    if (params.ipAddress) {
      ipLocation = await getIpLocationSafe(params.ipAddress);
    }

    await prisma.systemLog.create({
      data: {
        type: params.type,
        level: params.level,
        action: params.action,
        description: params.description,
        userId: validUserId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        // IP地理位置信息
        ipCountry: ipLocation?.country,
        ipProvince: ipLocation?.province,
        ipCity: ipLocation?.city,
        ipLocation: ipLocation?.fullLocation,
      },
    });
  } catch (error) {
    baseLogError('logger', '记录系统日志失败', error);
    // 日志记录失败不应该影响主要业务流程
  }
}

/**
 * 记录用户操作日志
 */
export async function logUserAction(
  action: string,
  description: string,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await logSystemEvent({
    type: 'user_action',
    level: 'info',
    action,
    description,
    userId,
    ipAddress,
    userAgent,
    metadata,
  });
}

/**
 * 记录业务操作日志
 */
export async function logBusinessOperation(
  action: string,
  description: string,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await logSystemEvent({
    type: 'business_operation',
    level: 'info',
    action,
    description,
    userId,
    ipAddress,
    userAgent,
    metadata,
  });
}

/**
 * 记录系统事件日志
 */
export async function logSystemEventInfo(
  action: string,
  description: string,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await logSystemEvent({
    type: 'system_event',
    level: 'info',
    action,
    description,
    userId,
    ipAddress,
    userAgent,
    metadata,
  });
}

/**
 * 记录错误日志
 */
export async function logError(
  action: string,
  description: string,
  error?: Error | unknown,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<void> {
  const metadata: Record<string, unknown> = {};

  if (error instanceof Error) {
    metadata.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error) {
    metadata.error = error;
  }

  await logSystemEvent({
    type: 'error',
    level: 'error',
    action,
    description,
    userId,
    ipAddress,
    userAgent,
    metadata,
  });
}

/**
 * 记录安全日志
 */
export async function logSecurityEvent(
  action: string,
  description: string,
  level: 'warning' | 'error' | 'critical' = 'warning',
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await logSystemEvent({
    type: 'security',
    level,
    action,
    description,
    userId,
    ipAddress,
    userAgent,
    metadata,
  });
}

/**
 * 从请求中提取IP地址和User-Agent
 */
export function extractRequestInfo(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ipAddress =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const userAgent = request.headers.get('user-agent');

  return {
    ipAddress,
    userAgent,
  };
}
