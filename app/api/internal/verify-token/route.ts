// 内部API：验证Bearer Token
// 仅供middleware使用，不对外公开

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    // 安全检查：仅允许本地调用
    const host = request.headers.get('host');
    if (!host?.includes('localhost') && !host?.includes('127.0.0.1')) {
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

    // 从数据库查询session
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            role: true,
            status: true,
          },
        },
      },
    });

    // 验证session是否存在且未过期
    if (!session || session.expires < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // 返回用户信息
    return NextResponse.json({
      success: true,
      user: session.user,
    });
  } catch (error) {
    logger.error('auth', 'Bearer token verification failed', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
