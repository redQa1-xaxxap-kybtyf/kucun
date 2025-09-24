import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from './db';
import { env } from './env';
import { logSecurityEvent, logUserAction } from './logger';
import { userValidations } from './validations/base';

/**
 * 验证验证码
 * @param sessionId 验证码会话ID
 * @param captcha 用户输入的验证码
 * @returns 验证是否成功
 */
async function verifyCaptcha(
  sessionId: string,
  captcha: string
): Promise<boolean> {
  try {
    // 查找验证码会话
    const session = await prisma.captchaSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      console.warn('验证码会话不存在:', sessionId);
      return false;
    }

    // 检查是否过期
    if (new Date() > session.expiresAt) {
      // 删除过期的会话
      await prisma.captchaSession.delete({
        where: { sessionId },
      });
      console.warn('验证码已过期:', sessionId);
      return false;
    }

    // 检查尝试次数
    if (session.attempts >= 5) {
      // 删除超过尝试次数的会话
      await prisma.captchaSession.delete({
        where: { sessionId },
      });
      console.warn('验证码尝试次数过多:', sessionId);
      return false;
    }

    // 验证验证码（不区分大小写）
    const isValid = captcha.toUpperCase() === session.captchaText.toUpperCase();

    if (isValid) {
      // 验证成功，删除会话（一次性使用）
      await prisma.captchaSession.delete({
        where: { sessionId },
      });
      return true;
    } else {
      // 验证失败，增加尝试次数
      await prisma.captchaSession.update({
        where: { sessionId },
        data: {
          attempts: session.attempts + 1,
        },
      });
      return false;
    }
  } catch (error) {
    console.error('验证码验证失败:', error);
    return false;
  }
}

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
        captchaSessionId: { label: '验证码会话ID', type: 'text' },
      },
      async authorize(credentials, req) {
        if (
          !credentials?.username ||
          !credentials?.password ||
          !credentials?.captcha ||
          !credentials?.captchaSessionId
        ) {
          throw new Error('用户名、密码、验证码和验证码会话ID不能为空');
        }

        // 验证输入格式
        const validationResult = userValidations.login.safeParse({
          username: credentials.username,
          password: credentials.password,
          captcha: credentials.captcha,
        });

        if (!validationResult.success) {
          throw new Error('用户名、密码或验证码格式不正确');
        }

        // 验证验证码
        const captchaValid = await verifyCaptcha(
          credentials.captchaSessionId,
          credentials.captcha
        );

        if (!captchaValid) {
          // 记录验证码验证失败的安全日志
          await logSecurityEvent(
            'failed_login',
            `登录失败：验证码错误 - ${credentials.username}`,
            'warning',
            null,
            null,
            null,
            {
              username: credentials.username,
              reason: 'invalid_captcha',
            }
          );
          throw new Error('验证码错误或已过期');
        }

        try {
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
            // 记录用户不存在的安全日志
            await logSecurityEvent(
              'failed_login',
              `登录失败：用户不存在 - ${credentials.username}`,
              'warning',
              null,
              null,
              null,
              {
                username: credentials.username,
                reason: 'user_not_found',
              }
            );
            throw new Error('用户不存在');
          }

          // 检查用户状态
          if (user.status !== 'active') {
            // 记录账户被禁用的安全日志
            await logSecurityEvent(
              'failed_login',
              `登录失败：账户已被禁用 - ${credentials.username}`,
              'error',
              user.id,
              null,
              null,
              {
                username: credentials.username,
                userId: user.id,
                reason: 'account_disabled',
                status: user.status,
              }
            );
            throw new Error('用户账户已被禁用');
          }

          // 验证密码
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!isPasswordValid) {
            // 记录登录失败日志
            await logSecurityEvent(
              'failed_login',
              `登录失败：密码错误 - ${credentials.username}`,
              'warning',
              null,
              null,
              null,
              {
                username: credentials.username,
                reason: 'invalid_password',
              }
            );
            throw new Error('密码错误');
          }

          // 记录登录成功日志
          await logUserAction(
            'login',
            `用户登录系统 - ${user.username}`,
            user.id,
            null,
            null,
            {
              username: user.username,
              role: user.role,
            }
          );

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
          throw error;
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
