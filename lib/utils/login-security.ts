/**
 * 登录安全控制工具
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// 登录安全策略配置
const LOGIN_SECURITY_CONFIG = {
  maxFailedAttempts: 5, // 最大失败次数
  lockoutDuration: 15, // 锁定时长(分钟)
  attemptWindow: 15, // 统计时间窗口(分钟)
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
 * 如果失败次数超过阈值,自动锁定账户
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
    // 记录登录失败
    await recordLoginAttempt({
      username: params.username,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: false,
      failureReason: params.failureReason,
    });

    // 获取最近的失败次数
    const failedCount = await getRecentFailedAttempts(params.username);
    const remainingAttempts = Math.max(
      0,
      LOGIN_SECURITY_CONFIG.maxFailedAttempts - failedCount
    );

    // 检查是否需要锁定
    if (failedCount >= LOGIN_SECURITY_CONFIG.maxFailedAttempts) {
      await lockAccount({
        username: params.username,
        reason: `连续${failedCount}次登录失败`,
      });

      return {
        shouldLock: true,
        remainingAttempts: 0,
      };
    }

    return {
      shouldLock: false,
      remainingAttempts,
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
 * 清除失败记录
 */
export async function handleLoginSuccess(params: {
  username: string;
  ipAddress: string;
  userAgent?: string;
}): Promise<void> {
  try {
    // 记录登录成功
    await recordLoginAttempt({
      username: params.username,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: true,
    });

    // 如果账户被锁定,自动解锁
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
