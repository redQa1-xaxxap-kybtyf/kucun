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
import { userValidations } from './validations/base';

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
    };
  }

  interface User {
    id: string;
    email: string;
    username: string;
    name: string;
    role: string;
    status: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    role: string;
    status: string;
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
  const primaryForwardedIp = rawForwarded
    ?.split(',')
    ?.map(value => value.trim())
    ?.find(Boolean);
  const fallbackIp = request.headers?.get?.('x-real-ip');
  const requestIp = request.ip;
  const clientIp = primaryForwardedIp || fallbackIp || requestIp || '127.0.0.1';

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
  // 检查必填字段
  if (
    !credentials?.username ||
    !credentials?.password ||
    !credentials?.captcha
  ) {
    throw new Error('MISSING_FIELDS');
  }

  // 验证输入格式
  const validationResult = userValidations.login.safeParse({
    username: credentials.username,
    password: credentials.password,
    captcha: credentials.captcha,
  });

  if (!validationResult.success) {
    throw new Error('INVALID_FORMAT');
  }

  // 检查登录限制(失败次数过多)
  const limitCheck = await checkLoginLimit(
    credentials.username as string,
    clientIp
  );
  if (!limitCheck.allowed) {
    // 记录被阻止的登录尝试
    await logLoginBlocked(credentials.username as string, clientIp, userAgent);
    throw new Error('TOO_MANY_ATTEMPTS');
  }

  // 验证验证码
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
    // 记录登录失败(账户被禁用)
    await logLoginFailure(username, clientIp, 'account_disabled', userAgent);
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
          };

          // 验证用户并返回用户信息
          return await authenticateUser(
            validCredentials.username,
            validCredentials.password,
            clientIp,
            userAgent
          );
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
    maxAge: 24 * 60 * 60, // 24 小时
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 小时
  },
  callbacks: {
    async jwt({ token, user }) {
      // 首次登录时，将用户信息添加到 token
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      // 将 token 中的信息添加到 session
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  // 移除 fallback 值,强制使用环境变量
  // 如果 NEXTAUTH_SECRET 未配置,应用启动时会失败
  secret: env.NEXTAUTH_SECRET,
};

// Server Actions / Route Handlers 统一会话获取
export async function auth() {
  return getServerSession(authOptions);
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
  // 验证密码强度
  if (newPassword.length < 6) {
    throw new Error('密码至少需要6个字符');
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
