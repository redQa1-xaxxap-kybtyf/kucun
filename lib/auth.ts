import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from './db';
import { env } from './env';
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
        const clientIp =
          (
            req as unknown as {
              headers?: { get?: (key: string) => string | null };
            }
          )?.headers?.get?.('x-forwarded-for') ||
          (
            req as unknown as {
              headers?: { get?: (key: string) => string | null };
            }
          )?.headers?.get?.('x-real-ip') ||
          '127.0.0.1';

        const userAgent =
          (
            req as unknown as {
              headers?: { get?: (key: string) => string | null };
            }
          )?.headers?.get?.('user-agent') || undefined;

        try {
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
            credentials.username,
            clientIp
          );
          if (!limitCheck.allowed) {
            // 记录被阻止的登录尝试
            await logLoginBlocked(credentials.username, clientIp, userAgent);
            throw new Error('TOO_MANY_ATTEMPTS');
          }

          // 验证验证码
          const captchaSessionId = (
            credentials as unknown as { captchaSessionId?: string }
          ).captchaSessionId;
          if (!captchaSessionId) {
            throw new Error('CAPTCHA_SESSION_MISSING');
          }

          // 调用验证码验证API
          // 使用相对路径或从环境变量获取完整URL
          const baseUrl =
            process.env.NEXTAUTH_URL ||
            `http://localhost:${process.env.PORT || 3003}`;
          const captchaResponse = await fetch(`${baseUrl}/api/auth/captcha`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // 传递客户端 IP 用于安全验证
              'X-Forwarded-For':
                (
                  req as unknown as {
                    headers?: { get?: (key: string) => string | null };
                  }
                )?.headers?.get?.('x-forwarded-for') || '127.0.0.1',
            },
            body: JSON.stringify({
              sessionId: captchaSessionId,
              captcha: credentials.captcha,
              deleteAfterVerify: true, // 验证成功后删除会话
            }),
          });

          if (!captchaResponse.ok) {
            // 记录验证码验证失败
            await logLoginFailure(
              credentials.username,
              clientIp,
              'captcha_incorrect',
              userAgent
            );
            // 尝试解析 JSON,如果失败则使用默认错误
            try {
              const captchaError = await captchaResponse.json();
              throw new Error(captchaError.error || 'CAPTCHA_VERIFY_FAILED');
            } catch {
              throw new Error('CAPTCHA_VERIFY_FAILED');
            }
          }

          // 尝试解析验证结果
          let captchaResult;
          try {
            captchaResult = await captchaResponse.json();
          } catch {
            throw new Error('CAPTCHA_VERIFY_FAILED');
          }

          if (!captchaResult.success) {
            // 记录验证码错误
            await logLoginFailure(
              credentials.username,
              clientIp,
              'captcha_incorrect',
              userAgent
            );
            throw new Error('CAPTCHA_INCORRECT');
          }

          // 查找用户（支持用户名或邮箱登录）
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { username: credentials.username },
                { email: credentials.username }, // 兼容邮箱登录
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
            // 记录登录失败(用户不存在)
            await logLoginFailure(
              credentials.username,
              clientIp,
              'invalid_credentials',
              userAgent
            );
            // 为了安全性,不明确告知用户不存在,统一返回凭证错误
            throw new Error('INVALID_CREDENTIALS');
          }

          // 检查用户状态
          if (user.status !== 'active') {
            // 记录登录失败(账户被禁用)
            await logLoginFailure(
              credentials.username,
              clientIp,
              'account_disabled',
              userAgent
            );
            throw new Error('ACCOUNT_DISABLED');
          }

          // 验证密码
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!isPasswordValid) {
            // 记录登录失败(密码错误)
            await logLoginFailure(
              credentials.username,
              clientIp,
              'invalid_credentials',
              userAgent
            );
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
        } catch (error) {
          console.error('认证错误:', error);

          // 根据 Next-Auth 最佳实践,返回 null 表示认证失败
          // 错误信息会通过 signIn 的返回值传递
          if (error instanceof Error) {
            // 记录详细错误信息到服务器日志
            console.error('认证失败原因:', error.message);

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
  secret: env.NEXTAUTH_SECRET || 'fallback-secret-for-development',
};

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
  });

  if (existingEmailUser) {
    throw new Error('该邮箱已被注册');
  }

  // 检查用户名是否已存在
  const existingUsernameUser = await prisma.user.findUnique({
    where: { username: data.username },
  });

  if (existingUsernameUser) {
    throw new Error('该用户名已被使用');
  }

  // 加密密码
  const passwordHash = await bcrypt.hash(data.password, 10);

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

  // 加密新密码
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // 更新密码
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
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
  });
}
