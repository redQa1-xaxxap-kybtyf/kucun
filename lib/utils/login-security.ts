/**
 * 登录安全控制工具
 * 
 * 架构说明:
 * - 本模块主要用于管理员手动锁定/解锁账户
 * - 自动登录限制已统一到 login-log-service.ts (基于Redis)
 * - 避免双重机制导致的逻辑冗余和不一致
 * 
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
    isLoginBlocked as checkIfBlocked,
    logLoginFailure,
    logLoginSuccess,
} from '@/lib/services/login-log-service';

// 登录安全策略配置
const LOGIN_SECURITY_CONFIG = {
  maxFailedAttempts: 5, // 最大失败次数(已废弃,使用Redis机制)
  lockoutDuration: 15, // 手动锁定默认时长(分钟)
  attemptWindow: 15, // 统计时间窗口(分钟,已废弃)
  cleanupAfterDays: 30, // 清理N天前的记录
};

/**
 * 记录登录尝试
 */
export async function recordLoginAttempt(params: {
  username: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        username: params.username,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent || null,
        success: params.success,
        failureReason: params.failureReason || null,
      },
    });
  } catch (error) {
    logger.error('security', '记录登录尝试失败', error, {
      username: params.username,
      ipAddress: params.ipAddress,
      success: String(params.success),
    });
  }
}

/**
 * 检查账户是否被锁定
 */
export async function isAccountLocked(username: string): Promise<{
  locked: boolean;
  lockedUntil?: Date;
  reason?: string;
}> {
  try {
    const lockout = await prisma.accountLockout.findUnique({
      where: { username },
    });

    if (!lockout || lockout.unlocked) {
      return { locked: false };
    }

    // 检查锁定是否已过期
    if (lockout.lockedUntil < new Date()) {
      // 自动解锁
      await prisma.accountLockout.update({
        where: { id: lockout.id },
        data: {
          unlocked: true,
          unlockedAt: new Date(),
        },
      });
      return { locked: false };
    }

    return {
      locked: true,
      lockedUntil: lockout.lockedUntil,
      reason: lockout.reason,
    };
  } catch (error) {
    logger.error('security', '检查账户锁定状态失败', error, {
      username,
    });
    return { locked: false };
  }
}

/**
 * 锁定账户
 */
export async function lockAccount(params: {
  username: string;
  reason: string;
  durationMinutes?: number;
}): Promise<void> {
  try {
    const duration =
      params.durationMinutes || LOGIN_SECURITY_CONFIG.lockoutDuration;
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + duration);

    await prisma.accountLockout.upsert({
      where: { username: params.username },
      update: {
        lockedAt: new Date(),
        lockedUntil,
        reason: params.reason,
        unlocked: false,
        unlockedAt: null,
        unlockedBy: null,
      },
      create: {
        username: params.username,
        lockedUntil,
        reason: params.reason,
      },
    });
  } catch (error) {
    logger.error('security', '锁定账户失败', error, {
      username: params.username,
      reason: params.reason,
      durationMinutes: params.durationMinutes
        ? String(params.durationMinutes)
        : undefined,
    });
    throw error;
  }
}

/**
 * 解锁账户
 */
export async function unlockAccount(params: {
  username: string;
  unlockedBy: string;
}): Promise<void> {
  try {
    await prisma.accountLockout.updateMany({
      where: {
        username: params.username,
        unlocked: false,
      },
      data: {
        unlocked: true,
        unlockedAt: new Date(),
        unlockedBy: params.unlockedBy,
      },
    });
  } catch (error) {
    logger.error('security', '解锁账户失败', error, {
      username: params.username,
      unlockedBy: params.unlockedBy,
    });
    throw error;
  }
}

/**
 * 获取最近的失败登录次数
 */
export async function getRecentFailedAttempts(
  username: string
): Promise<number> {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(
      windowStart.getMinutes() - LOGIN_SECURITY_CONFIG.attemptWindow
    );

    const count = await prisma.loginAttempt.count({
      where: {
        username,
        success: false,
        attemptAt: {
          gte: windowStart,
        },
      },
    });

    return count;
  } catch (error) {
    logger.error('security', '获取失败登录次数失败', error, {
      username,
    });
    return 0;
  }
}

/**
 * 检查并处理登录失败
 * @deprecated 建议直接使用 login-log-service.logLoginFailure
 * 本函数保留是为了兼容性,实际委托给 login-log-service
 */
export async function handleLoginFailure(params: {
  username: string;
  ipAddress: string;
  userAgent?: string;
  failureReason: string;
}): Promise<{
  shouldLock: boolean;
  remainingAttempts: number;
}> {
  try {
    // 记录登录尝试到数据库(用于长期审计)
    await recordLoginAttempt({
      username: params.username,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: false,
      failureReason: params.failureReason,
    });

    // 委托给 login-log-service 处理 Redis 限制
    await logLoginFailure(
      params.username,
      params.ipAddress,
      params.failureReason as any,
      params.userAgent
    );

    // 检查是否被限制
    const isBlocked = await checkIfBlocked(params.username);

    return {
      shouldLock: isBlocked,
      remainingAttempts: isBlocked ? 0 : 5, // 简化返回
    };
  } catch (error) {
    logger.error('security', '处理登录失败错误', error, {
      username: params.username,
      ipAddress: params.ipAddress,
      failureReason: params.failureReason,
    });
    return {
      shouldLock: false,
      remainingAttempts: LOGIN_SECURITY_CONFIG.maxFailedAttempts,
    };
  }
}

/**
 * 处理登录成功
 * @deprecated 建议直接使用 login-log-service.logLoginSuccess
 * 本函数保留是为了兼容性,实际委托给 login-log-service
 */
export async function handleLoginSuccess(params: {
  username: string;
  ipAddress: string;
  userAgent?: string;
}): Promise<void> {
  try {
    // 记录登录成功到数据库(用于长期审计)
    await recordLoginAttempt({
      username: params.username,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: true,
    });

    // 委托给 login-log-service 重置失败次数(Redis)
    // 这会自动重置基于用户名和IP的失败计数
    await logLoginSuccess(
      'temp-user-id', // userId会在实际登录成功后由auth.ts提供
      params.username,
      params.ipAddress,
      params.userAgent
    );

    // 如果账户被手动锁定,自动解锁
    const lockStatus = await isAccountLocked(params.username);
    if (lockStatus.locked) {
      await unlockAccount({
        username: params.username,
        unlockedBy: 'system',
      });
    }
  } catch (error) {
    logger.error('security', '处理登录成功错误', error, {
      username: params.username,
      ipAddress: params.ipAddress,
    });
  }
}

/**
 * 清理过期的登录记录
 */
export async function cleanupOldLoginAttempts(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - LOGIN_SECURITY_CONFIG.cleanupAfterDays
    );

    const result = await prisma.loginAttempt.deleteMany({
      where: {
        attemptAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  } catch (error) {
    logger.error('security', '清理登录记录失败', error, {
      cleanupAfterDays: String(LOGIN_SECURITY_CONFIG.cleanupAfterDays),
    });
    return 0;
  }
}

/**
 * 获取登录安全统计
 */
export async function getLoginSecurityStats(): Promise<{
  totalAttempts: number;
  failedAttempts: number;
  successRate: number;
  lockedAccounts: number;
}> {
  try {
    const [totalAttempts, failedAttempts, lockedAccounts] = await Promise.all([
      prisma.loginAttempt.count(),
      prisma.loginAttempt.count({
        where: { success: false },
      }),
      prisma.accountLockout.count({
        where: { unlocked: false },
      }),
    ]);

    const successRate =
      totalAttempts > 0
        ? ((totalAttempts - failedAttempts) / totalAttempts) * 100
        : 100;

    return {
      totalAttempts,
      failedAttempts,
      successRate: Math.round(successRate * 100) / 100,
      lockedAccounts,
    };
  } catch (error) {
    logger.error('security', '获取登录安全统计失败', error);
    return {
      totalAttempts: 0,
      failedAttempts: 0,
      successRate: 100,
      lockedAccounts: 0,
    };
  }
}
