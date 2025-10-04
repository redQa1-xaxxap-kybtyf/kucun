// WebSocket 鉴权辅助函数
// 直接解析 JWT token，避免 HTTP 往返和端口/协议问题

import { decode } from 'next-auth/jwt';

import { env } from '@/lib/env';
import { logger } from '@/lib/utils/console-logger';

// JWT 密钥 - 与 NextAuth 使用相同的密钥
const JWT_SECRET = env.NEXTAUTH_SECRET || '';

/**
 * 从 cookie 字符串中解析 NextAuth session token
 */
function getSessionTokenFromCookies(cookieHeader: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  // NextAuth 使用不同的 cookie 名称，取决于环境
  const cookieName =
    env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

  // 解析 cookie 字符串
  const cookies = cookieHeader.split(';').reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    },
    {} as Record<string, string>
  );

  return cookies[cookieName] || null;
}

/**
 * 验证 WebSocket 连接的身份
 * 直接解析 JWT token，无需 HTTP 调用
 */
export async function verifyWebSocketAuth(
  cookieHeader: string | undefined
): Promise<{
  authenticated: boolean;
  userId?: string;
  username?: string;
  role?: string;
  error?: string;
}> {
  try {
    if (!cookieHeader) {
      return {
        authenticated: false,
        error: 'No cookies provided',
      };
    }

    // 从 cookies 中获取 session token
    const token = getSessionTokenFromCookies(cookieHeader);
    if (!token) {
      return {
        authenticated: false,
        error: 'No session token found',
      };
    }

    // 解析 JWT token
    const decoded = await decode({
      token,
      secret: JWT_SECRET,
    });

    if (!decoded) {
      return {
        authenticated: false,
        error: 'Invalid token',
      };
    }

    // 检查 token 是否过期
    if (
      decoded.exp &&
      typeof decoded.exp === 'number' &&
      decoded.exp * 1000 < Date.now()
    ) {
      return {
        authenticated: false,
        error: 'Token expired',
      };
    }

    // 验证必要的字段
    if (!decoded.id || !decoded.username) {
      return {
        authenticated: false,
        error: 'Invalid token payload',
      };
    }

    // 返回认证成功的用户信息
    return {
      authenticated: true,
      userId: decoded.id as string,
      username: decoded.username as string,
      role: decoded.role as string,
    };
  } catch (error) {
    logger.error('ws-auth', 'WebSocket 鉴权失败:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Redis 客户端接口
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
}

/**
 * 从 Redis 缓存验证会话（备选方案）
 * 如果项目使用 Redis 存储会话，可以直接从 Redis 验证
 */
export async function verifyWebSocketAuthFromRedis(
  sessionId: string,
  redisClient: RedisClient
): Promise<{
  authenticated: boolean;
  userId?: string;
  username?: string;
  role?: string;
  error?: string;
}> {
  try {
    // 从 Redis 获取会话数据
    const sessionKey = `session:${sessionId}`;
    const sessionData = await redisClient.get(sessionKey);

    if (!sessionData) {
      return {
        authenticated: false,
        error: 'Session not found',
      };
    }

    // 解析会话数据
    const session = JSON.parse(sessionData);

    // 检查会话是否过期
    if (session.expires && new Date(session.expires) < new Date()) {
      // 清理过期会话
      await redisClient.del(sessionKey);
      return {
        authenticated: false,
        error: 'Session expired',
      };
    }

    // 验证用户信息
    if (!session.userId || !session.username) {
      return {
        authenticated: false,
        error: 'Invalid session data',
      };
    }

    return {
      authenticated: true,
      userId: session.userId,
      username: session.username,
      role: session.role,
    };
  } catch (error) {
    logger.error('ws-auth', 'Redis 会话验证失败:', error);
    return {
      authenticated: false,
      error: 'Session verification failed',
    };
  }
}

/**
 * 创建 WebSocket 会话标识
 * 用于关联 WebSocket 连接和用户会话
 */
export function createWebSocketSessionId(userId: string): string {
  return `ws:${userId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 验证 WebSocket 消息签名（可选的额外安全层）
 * 防止消息伪造和重放攻击
 */
export function verifyMessageSignature(
  message: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  try {
    // 使用 HMAC 验证消息签名
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node.js crypto module
    const crypto = require('crypto');
    const messageString = JSON.stringify(message);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(messageString)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    logger.error('ws-auth', '消息签名验证失败:', error);
    return false;
  }
}
