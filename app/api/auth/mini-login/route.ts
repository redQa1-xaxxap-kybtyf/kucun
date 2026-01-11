// 小程序专用登录API
// 不需要验证码，简化认证流程

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  checkLoginLimit,
  logLoginFailure,
  logLoginSuccess,
} from '@/lib/services/login-log-service';
import { baseValidations } from '@/lib/validations/base';

const MINI_PROGRAM_JWT_SALT = 'mini-program';
const MINI_PROGRAM_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 天

/**
 * 从请求中提取客户端 IP
 * - 优先解析 X-Forwarded-For（支持多级代理，并尽量选择公网 IP）
 * - 其次使用 X-Real-IP
 * - 最后回退到 request.ip
 */
function getClientIp(request: NextRequest): string {
  const rawForwarded = request.headers.get('x-forwarded-for');

  let forwardedIp: string | undefined;
  if (rawForwarded) {
    const forwardedIps = rawForwarded
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    const isPrivateIp = (ip: string) =>
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^127\./.test(ip) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);

    // 从右往左查找第一个非内网 IP
    for (let i = forwardedIps.length - 1; i >= 0; i--) {
      const ip = forwardedIps[i];
      if (!isPrivateIp(ip)) {
        forwardedIp = ip;
        break;
      }
    }

    // 如果没有找到公网 IP，则退回到链中的最后一个
    if (!forwardedIp && forwardedIps.length > 0) {
      forwardedIp = forwardedIps[forwardedIps.length - 1];
    }
  }

  const realIp = request.headers.get('x-real-ip');
  const requestIp = (request as unknown as { ip?: string }).ip;

  return forwardedIp || realIp || requestIp || '127.0.0.1';
}

/**
 * 小程序登录 POST /api/auth/mini-login
 *
 * 请求体：
 * {
 *   "username": "admin",
 *   "password": "admin123"
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "tokenType": "Bearer",
 *     "expiresIn": 86400,
 *     "user": {
 *       "id": "...",
 *       "username": "admin",
 *       "name": "管理员",
 *       "role": "admin"
 *     }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { username, password } = body;

    // 获取客户端信息
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // 1. 验证必填字段
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 2. 验证输入格式（小程序不需要验证码，只验证用户名和密码）
    const usernameValidation = baseValidations.username.safeParse(username);
    if (!usernameValidation.success) {
      const firstIssue = usernameValidation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstIssue?.message || '用户名格式不正确',
        },
        { status: 400 }
      );
    }

    const passwordValidation =
      baseValidations.simplePassword.safeParse(password);
    if (!passwordValidation.success) {
      const firstIssue = passwordValidation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstIssue?.message || '密码格式不正确',
        },
        { status: 400 }
      );
    }

    // 3. 检查登录限制（防止暴力破解）
    // 注意：这里任何 Redis / 日志异常都不应该导致登录 500，最多视作“未限制”
    try {
      const limitCheck = await checkLoginLimit(username, clientIp);
      if (!limitCheck.allowed) {
        try {
          await logLoginFailure(
            username,
            clientIp,
            'too_many_attempts',
            userAgent
          );
        } catch (logError) {
          logger.error('auth', '记录登录失败日志异常', logError, {
            username,
            clientIp,
            reason: 'too_many_attempts',
          });
        }
        return NextResponse.json(
          {
            success: false,
            error: '登录尝试次数过多，请稍后再试',
            retryAfter: limitCheck.remainingTime,
          },
          { status: 429 }
        );
      }
    } catch (limitError) {
      // 限流检查异常时，只记录日志，不阻塞正常登录流程
      logger.error('auth', '检查登录限制失败(忽略，继续登录流程)', limitError, {
        username,
        clientIp,
      });
    }

    // 4. 查找用户
    const user = await prisma.user.findUnique({
      where: { username },
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
      try {
        await logLoginFailure(
          username,
          clientIp,
          'invalid_credentials',
          userAgent
        );
      } catch (logError) {
        logger.error('auth', '记录用户名不存在的登录失败日志异常', logError, {
          username,
          clientIp,
        });
      }
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 5. 检查用户状态
    if (user.status !== 'active') {
      try {
        await logLoginFailure(
          username,
          clientIp,
          'account_disabled',
          userAgent
        );
      } catch (logError) {
        logger.error('auth', '记录账户禁用登录失败日志异常', logError, {
          username,
          clientIp,
        });
      }
      return NextResponse.json(
        { success: false, error: '账户已被禁用' },
        { status: 403 }
      );
    }

    // 6. 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      try {
        await logLoginFailure(
          username,
          clientIp,
          'invalid_credentials',
          userAgent
        );
      } catch (logError) {
        logger.error('auth', '记录密码错误登录失败日志异常', logError, {
          username,
          clientIp,
        });
      }
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 7. 登录成功 - 记录日志（日志异常不影响登录）
    try {
      await logLoginSuccess(user.id, user.username, clientIp, userAgent);
    } catch (logError) {
      logger.error('auth', '记录登录成功日志异常(忽略)', logError, {
        userId: user.id,
        username: user.username,
      });
    }

    // 8. 更新最后登录时间
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        select: { id: true },
      });
    } catch (error) {
      logger.error('auth', '更新 lastLoginAt 失败', error, {
        userId: user.id,
        username: user.username,
      });
    }

    // 9. 生成小程序 Bearer Token（JWT/JWE），避免依赖 Prisma Session 表（生产环境可能未建表）
    const token = await encode({
      token: {
        // 同时放 sub 与 id，便于不同端统一识别
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
        client: 'mini-program',
      },
      secret: env.NEXTAUTH_SECRET,
      salt: MINI_PROGRAM_JWT_SALT,
      maxAge: MINI_PROGRAM_TOKEN_MAX_AGE_SECONDS,
    });

    // 10. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        token,
        tokenType: 'Bearer',
        expiresIn: MINI_PROGRAM_TOKEN_MAX_AGE_SECONDS, // 单位：秒
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error('auth', '小程序登录失败', error);

    // 开发环境下返回更详细的错误信息，方便排查问题
    if (env.NODE_ENV === 'development') {
      const message =
        error instanceof Error
          ? `小程序登录失败: ${error.message}`
          : '小程序登录失败: 未知错误';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }

    // 生产环境保持通用提示，避免泄露内部细节
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
