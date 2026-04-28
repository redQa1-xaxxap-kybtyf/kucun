import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import NextAuth, { type NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from './db';
import { env } from './env';
import { logger } from './logger';
import {
  checkLoginLimit,
  logLoginBlocked,
  logLoginFailure,
  logLoginSuccess,
} from './services/login-log-service';
import {
  getMaxConcurrentSessionsForRole,
  registerUserSession,
  validateAndTouchUserSession,
} from './services/user-session-service';
import { userValidations } from './validations/base';
import { validatePassword } from './validations/user';

// 扩展 NextAuth 类型定义
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      name: string;
      role: string;
      status: string;
      avatar?: string;
      rememberMe?: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    username: string;
    name: string;
    role: string;
    status: string;
    rememberMe?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    role: string;
    status: string;
    rememberMe?: boolean;
    sessionId?: string;
    exp?: number;
  }
}

// ==================== Authorize 辅助函数 ====================

/**
 * 从请求中提取客户端 IP 和 User-Agent
 */
function getRequestInfo(req: unknown): {
  clientIp: string;
  userAgent: string | undefined;
} {
  const request = req as {
    headers?: { get?: (key: string) => string | null };
    ip?: string;
  };

  const rawForwarded = request.headers?.get?.('x-forwarded-for');

  // 从 X-Forwarded-For 中提取客户端 IP
  // 按建议：从右往左查找第一个非空且看起来像公网 IP
  let forwardedIp: string | undefined;
  if (rawForwarded) {
    const forwardedIps = rawForwarded
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    // 简单的“内网IP”判定：10.x.x.x / 172.16-31.x.x / 192.168.x.x / 127.0.0.1
    const isPrivateIp = (ip: string) =>
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^127\./.test(ip) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);

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

  const fallbackIp = request.headers?.get?.('x-real-ip');
  const requestIp = request.ip;
  const clientIp = forwardedIp || fallbackIp || requestIp || '127.0.0.1';

  const userAgent = request.headers?.get?.('user-agent') || undefined;

  return { clientIp, userAgent };
}

/**
 * 验证登录凭证和安全检查
 */
async function validateLoginCredentials(
  credentials: Record<string, unknown> | undefined,
  clientIp: string,
  userAgent: string | undefined
): Promise<void> {
  // 1. 检查必填字段
  if (
    !credentials?.username ||
    !credentials?.password ||
    !credentials?.captcha
  ) {
    throw new Error('MISSING_FIELDS');
  }

  // 2. 验证输入格式
  const validationResult = userValidations.login.safeParse({
    username: credentials.username,
    password: credentials.password,
    captcha: credentials.captcha,
  });

  if (!validationResult.success) {
    throw new Error('INVALID_FORMAT');
  }

  // 3. 验证验证码（先校验验证码，再检查登录限制，避免无效验证码占用尝试次数配额）
  const captchaSessionId = (credentials as { captchaSessionId?: string })
    .captchaSessionId;
  if (!captchaSessionId) {
    throw new Error('CAPTCHA_SESSION_MISSING');
  }

  // 🚀 性能优化：直接调用验证码服务，避免内部 HTTP 调用开销
  const { verifyCaptcha } = await import('@/lib/services/captcha-service');

  const captchaResult = await verifyCaptcha(
    captchaSessionId,
    credentials.captcha as string,
    clientIp,
    true // deleteAfterVerify: 验证成功后删除会话
  );

  if (!captchaResult.success) {
    // 记录验证码验证失败
    await logLoginFailure(
      credentials.username as string,
      clientIp,
      'captcha_incorrect',
      userAgent
    );
    throw new Error('CAPTCHA_INCORRECT');
  }

  // 4. 验证码通过后再检查登录限制(失败次数过多)
  const limitCheck = await checkLoginLimit(
    credentials.username as string,
    clientIp
  );
  if (!limitCheck.allowed) {
    // 记录被阻止的登录尝试
    await logLoginBlocked(credentials.username as string, clientIp, userAgent);
    throw new Error('TOO_MANY_ATTEMPTS');
  }
}

/**
 * 验证用户并返回用户信息
 */
async function authenticateUser(
  username: string,
  password: string,
  clientIp: string,
  userAgent: string | undefined
): Promise<{
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
}> {
  // 查找用户（仅支持用户名登录）
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
      lastLoginAt: true,
    },
  });

  if (!user) {
    // 记录登录失败(用户不存在)
    await logLoginFailure(username, clientIp, 'invalid_credentials', userAgent);
    // 为了安全性,不明确告知用户不存在,统一返回凭证错误
    throw new Error('INVALID_CREDENTIALS');
  }

  // 检查用户状态
  if (user.status !== 'active') {
    // 记录登录失败(账户被禁用) - 为避免在日志中暴露账户状态,统一记录为 invalid_credentials
    await logLoginFailure(username, clientIp, 'invalid_credentials', userAgent);
    throw new Error('INVALID_CREDENTIALS');
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    // 记录登录失败(密码错误)
    await logLoginFailure(username, clientIp, 'invalid_credentials', userAgent);
    // 为了安全性,不明确告知密码错误,统一返回凭证错误
    throw new Error('INVALID_CREDENTIALS');
  }

  // 登录成功 - 记录日志并重置失败次数
  await logLoginSuccess(user.id, user.username, clientIp, userAgent);

  // 更新最后登录时间（不影响主流程，失败时仅记录日志）
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

  // 返回用户信息（不包含密码）
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

// Next-Auth.js 配置
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: '用户名', type: 'text' },
        password: { label: '密码', type: 'password' },
        captcha: { label: '验证码', type: 'text' },
      },
      async authorize(credentials, req) {
        // 获取客户端 IP 和 User-Agent
        const { clientIp, userAgent } = getRequestInfo(req);

        try {
          // 验证登录凭证和安全检查
          await validateLoginCredentials(credentials, clientIp, userAgent);

          // 类型断言：validateLoginCredentials 已经验证了 credentials 不为空
          const validCredentials = credentials as {
            username: string;
            password: string;
            captcha: string;
            rememberMe?: unknown;
          };

          const rememberMeRaw = validCredentials.rememberMe;
          const rememberMe =
            rememberMeRaw === true ||
            rememberMeRaw === 'true' ||
            rememberMeRaw === '1';

          // 验证用户并返回用户信息
          const baseUser = await authenticateUser(
            validCredentials.username,
            validCredentials.password,
            clientIp,
            userAgent
          );

          // 将 rememberMe 标记附加到用户对象，供 JWT 回调使用
          return {
            ...baseUser,
            rememberMe,
          };
        } catch (error) {
          logger.error('security', '认证错误', error, {
            username: credentials?.username,
            clientIp: clientIp || undefined,
          });

          // 根据 Next-Auth 最佳实践,返回 null 表示认证失败
          // 错误信息会通过 signIn 的返回值传递
          if (error instanceof Error) {
            // 记录详细错误信息到服务器日志
            logger.error('security', '认证失败原因', error, {
              username: credentials?.username,
              errorMessage: error.message,
              clientIp: clientIp || undefined,
            });

            // 抛出错误,Next-Auth 会将其转换为 CredentialsSignin
            // 并将错误消息附加到 URL 参数中
            throw error;
          }

          // 未知错误
          throw new Error('SERVER_ERROR');
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // 使用最长的会话时间（用于“记住我”），短会话通过 token.exp 控制
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  callbacks: {
    async jwt({ token, user }) {
      const nowInSeconds = Math.floor(Date.now() / 1000);

      // 首次登录时，将用户信息添加到 token
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.status = user.status;

        // 根据 rememberMe 设置自定义过期时间
        const rememberMe = (user as { rememberMe?: boolean }).rememberMe;
        token.rememberMe = rememberMe ?? false;

        const maxAgeSeconds = token.rememberMe
          ? 30 * 24 * 60 * 60 // 30 天
          : 24 * 60 * 60; // 24 小时

        const expiresAtSeconds = nowInSeconds + maxAgeSeconds;
        token.exp = expiresAtSeconds;

        const sessionId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `sid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

        token.sessionId = sessionId;

        try {
          await registerUserSession({
            userId: token.id,
            sessionId,
            expiresAtMs: expiresAtSeconds * 1000,
            maxSessions: getMaxConcurrentSessionsForRole(token.role),
          });
        } catch (error) {
          // Redis 故障不应阻断登录，只降级并发/空闲超时能力
          token.sessionId = undefined;
          logger.warn(
            'security',
            '注册用户会话失败(忽略)',
            { userId: token.id, username: token.username },
            { error: error instanceof Error ? error.message : String(error) }
          );
        }

        return token;
      }

      // 非首次：校验并刷新会话活跃时间（并发登录限制/空闲超时）
      const userId = token.id || token.sub;
      const sessionId = token.sessionId;
      if (userId && sessionId) {
        try {
          const sessionResult = await validateAndTouchUserSession({
            userId,
            sessionId,
            idleTimeoutSeconds: env.USER_SESSION_TIMEOUT * 60,
          });

          if (!sessionResult.valid) {
            // 让 token 立刻过期，确保 middleware/getToken 也会判定为未登录
            token.exp = nowInSeconds - 10;
            token.sessionId = undefined;
            token.id = '';
            token.username = '';
            token.role = '';
            token.status = '';
            token.rememberMe = false;
            token.sub = '';
          }
        } catch (error) {
          // Redis 故障不应阻断访问，只降级并发/空闲超时能力
          logger.warn(
            'security',
            '会话校验失败(忽略)',
            { userId, username: token.username },
            { error: error instanceof Error ? error.message : String(error) }
          );
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        return null as unknown as typeof session;
      }

      // 将 token 中的信息添加到 session
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.role = token.role;
      session.user.status = token.status;
      session.user.rememberMe = token.rememberMe;

      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  useSecureCookies: env.NODE_ENV === 'production',
  // 移除 fallback 值,强制使用环境变量
  // 如果 NEXTAUTH_SECRET 未配置,应用启动时会失败
  secret: env.NEXTAUTH_SECRET,
};

// Server Actions / Route Handlers 统一会话获取
export async function auth() {
  return getServerSession(authOptions);
}

function isExpectedDynamicAuthError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('Dynamic server usage')
  );
}

/**
 * 安全获取服务端会话
 * 在认证子系统异常时返回 null，避免页面直接 500。
 */
export async function safeAuth(context?: string) {
  try {
    return await getServerSession(authOptions);
  } catch (error) {
    if (isExpectedDynamicAuthError(error)) {
      return null;
    }

    logger.error('auth', '获取服务端会话失败', error, {
      context: context || 'unknown',
    });
    return null;
  }
}

// 权限检查函数
export function hasPermission(
  userRole: string,
  requiredRoles: string[]
): boolean {
  return requiredRoles.includes(userRole);
}

// 管理员权限检查
export function isAdmin(userRole: string): boolean {
  return userRole === 'admin';
}

// 销售员权限检查
export function isSales(userRole: string): boolean {
  return userRole === 'sales';
}

// 用户创建函数（注册）
export async function createUser(data: {
  email: string;
  username: string;
  name: string;
  password: string;
  role?: string;
}) {
  // 验证输入数据
  const validationResult = userValidations.register.safeParse(data);
  if (!validationResult.success) {
    throw new Error('输入数据格式不正确');
  }

  // 检查邮箱是否已存在
  const existingEmailUser = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existingEmailUser) {
    throw new Error('该邮箱已被注册');
  }

  // 检查用户名是否已存在
  const existingUsernameUser = await prisma.user.findUnique({
    where: { username: data.username },
    select: { id: true },
  });

  if (existingUsernameUser) {
    throw new Error('该用户名已被使用');
  }

  // 加密密码 - 使用环境配置的 salt rounds
  const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);

  // 创建用户
  const user = await prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      name: data.name,
      passwordHash,
      role: data.role || 'sales',
      status: 'active',
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return user;
}

// 密码更新函数
export async function updatePassword(userId: string, newPassword: string) {
  // 验证密码强度（统一使用 user 验证规则）
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    // 抛出第一条错误信息，调用方负责展示给用户
    throw new Error(validation.errors[0] || '密码不符合安全要求');
  }

  // 加密新密码 - 使用环境配置的 salt rounds
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

  // 更新密码
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: { id: true },
  });
}

// 用户状态更新函数
export async function updateUserStatus(
  userId: string,
  status: 'active' | 'inactive'
) {
  await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true },
  });
}

// 导出 NextAuth 实例（用于 API 路由）
export default NextAuth(authOptions);
