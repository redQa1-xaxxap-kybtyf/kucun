/**
 * 认证辅助函数
 * 遵循全局约定规范和唯一真理原则
 */

import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';
import { userValidations } from '@/lib/validations/base';

import {
  handleLoginFailure,
  handleLoginSuccess,
  isAccountLocked,
} from './login-security';

/**
 * 验证用户登录
 * 集成登录安全控制
 */
export async function validateUserLogin(params: {
  username: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
}): Promise<{
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    name: string;
    role: string;
    status: string;
  };
  error?: string;
}> {
  const { username, password, ipAddress, userAgent } = params;

  try {
    // 1. 检查账户是否被锁定
    const lockStatus = await isAccountLocked(username);
    if (lockStatus.locked) {
      const minutesRemaining = lockStatus.lockedUntil
        ? Math.ceil((lockStatus.lockedUntil.getTime() - Date.now()) / 60000)
        : 0;

      return {
        success: false,
        error: `账户已被锁定,请在${minutesRemaining}分钟后重试。原因: ${lockStatus.reason}`,
      };
    }

    // 2. 查找用户（支持用户名或邮箱登录）
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }, // 兼容邮箱登录
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        passwordHash: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      // 记录登录失败
      await handleLoginFailure({
        username,
        ipAddress,
        userAgent,
        failureReason: '用户不存在',
      });

      return {
        success: false,
        error: '用户名或密码错误',
      };
    }

    // 3. 检查用户状态
    if (user.status !== 'active') {
      await handleLoginFailure({
        username,
        ipAddress,
        userAgent,
        failureReason: '用户账户已被禁用',
      });

      return {
        success: false,
        error: '用户账户已被禁用',
      };
    }

    // 4. 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // 处理登录失败
      const failureResult = await handleLoginFailure({
        username,
        ipAddress,
        userAgent,
        failureReason: '密码错误',
      });

      if (failureResult.shouldLock) {
        return {
          success: false,
          error: '连续登录失败次数过多,账户已被锁定15分钟',
        };
      }

      return {
        success: false,
        error: `密码错误,还剩${failureResult.remainingAttempts}次尝试机会`,
      };
    }

    // 5. 登录成功
    await handleLoginSuccess({
      username,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  } catch (error) {
    console.error('验证用户登录失败:', error);
    return {
      success: false,
      error: '登录验证失败,请稍后重试',
    };
  }
}

/**
 * 提取请求信息
 */
export function extractRequestInfo(request: Request): {
  ipAddress: string;
  userAgent: string | null;
} {
  const ipAddress =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = request.headers.get('user-agent');

  return { ipAddress, userAgent };
}

