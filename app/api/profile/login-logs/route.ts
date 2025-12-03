/**
 * 个人中心 - 登录日志 API
 *
 * GET /api/profile/login-logs
 * 返回当前登录用户最近的登录记录
 */

import {
  withAuth,
  errorResponse,
  successResponse,
} from '@/lib/auth/api-helpers';
import {
  getRecentLoginLogs,
  type LoginLog,
} from '@/lib/services/login-log-service';

interface LoginLogDto {
  type: LoginLog['type'];
  failureReason?: LoginLog['failureReason'];
  clientIp: string;
  userAgent?: string;
  timestamp: string;
}

export const GET = withAuth(async (_request, { user }) => {
  if (!user.username) {
    return errorResponse('用户信息不完整，无法查询登录日志', 400);
  }

  const logs = await getRecentLoginLogs(user.username, 10);

  const data: LoginLogDto[] = logs.map(log => ({
    type: log.type,
    failureReason: log.failureReason,
    clientIp: log.clientIp,
    userAgent: log.userAgent,
    timestamp: log.timestamp.toISOString(),
  }));

  return successResponse<{ logs: LoginLogDto[] }>({ logs: data });
});
