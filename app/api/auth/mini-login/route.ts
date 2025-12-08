// 小程序专用登录API
// 不需要验证码，简化认证流程

import { randomBytes } from 'crypto';

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  checkLoginLimit,
  logLoginFailure,
  logLoginSuccess,
} from '@/lib/services/login-log-service';
import { baseValidations } from '@/lib/validations/base';

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
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "user": {
 *     "id": "...",
 *     "username": "admin",
 *     "name": "管理员",
 *     "email": "admin@example.com",
 *     "role": "admin"
 *   },
 *   "expiresIn": 86400
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
      return NextResponse.json(
        { success: false, error: usernameValidation.error.errors[0].message },
        { status: 400 }
      );
    }

    const passwordValidation =
      baseValidations.simplePassword.safeParse(password);
    if (!passwordValidation.success) {
      return NextResponse.json(
        { success: false, error: passwordValidation.error.errors[0].message },
        { status: 400 }
      );
    }

    // 3. 检查登录限制（防止暴力破解）
    const limitCheck = await checkLoginLimit(username, clientIp);
    if (!limitCheck.allowed) {
      await logLoginFailure(username, clientIp, 'too_many_attempts', userAgent);
      return NextResponse.json(
        {
          success: false,
          error: '登录尝试次数过多，请稍后再试',
          retryAfter: limitCheck.retryAfter,
        },
        { status: 429 }
      );
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
      await logLoginFailure(
        username,
        clientIp,
        'invalid_credentials',
        userAgent
      );
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 5. 检查用户状态
    if (user.status !== 'active') {
      await logLoginFailure(username, clientIp, 'account_disabled', userAgent);
      return NextResponse.json(
        { success: false, error: '账户已被禁用' },
        { status: 403 }
      );
    }

    // 6. 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await logLoginFailure(
        username,
        clientIp,
        'invalid_credentials',
        userAgent
      );
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 7. 登录成功 - 记录日志
    await logLoginSuccess(user.id, user.username, clientIp, userAgent);

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

    // 9. 生成简单的会话Token（32字节随机字符串）
    const token = randomBytes(32).toString('hex');

    // 10. 将会话信息存储到数据库
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

    await prisma.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        expires: expiresAt,
      },
    });

    // 11. 返回成功响应
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      expiresIn: 7 * 24 * 60 * 60, // 7天，单位：秒
    });
  } catch (error) {
    logger.error('auth', '小程序登录失败', error);
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
