// 内部API：验证Bearer Token
// 仅供middleware使用，不对外公开

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decode } from 'next-auth/jwt';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// 内部调用密钥（使用 NEXTAUTH_SECRET 的哈希前缀）
const INTERNAL_API_KEY = `internal_${env.NEXTAUTH_SECRET?.slice(0, 16)}`;
const MINI_PROGRAM_JWT_SALT = 'mini-program';

/**
 * POST /api/internal/verify-token
 *
 * 验证小程序的Bearer Token是否有效
 *
 * 请求体：
 * {
 *   "token": "bearer_token_string"
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "user": {
 *     "id": "...",
 *     "email": "...",
 *     "name": "...",
 *     "username": "...",
 *     "role": "...",
 *     "status": "..."
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 安全检查：验证内部调用密钥
    const internalKey = request.headers.get('x-internal-key');
    if (internalKey !== INTERNAL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // 解析 JWT/JWE（由 /api/auth/mini-login 生成）
    // 注意：这里不要访问数据库，避免生产环境 Session 表缺失导致 500
    let payload: any = null;
    try {
      payload = await decode({
        token,
        secret: env.NEXTAUTH_SECRET,
        salt: MINI_PROGRAM_JWT_SALT,
      });
    } catch (decodeError) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = String(payload.id || payload.sub || '').trim();
    const username = String(payload.username || '').trim();
    const status = String(payload.status || '').trim();

    if (!userId || !username) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: payload.email ? String(payload.email) : null,
        name: payload.name ? String(payload.name) : null,
        username,
        role: payload.role ? String(payload.role) : null,
        status: status || 'active',
      },
    });
  } catch (error) {
    logger.error('auth', 'Bearer token verification failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
