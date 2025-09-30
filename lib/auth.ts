import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from './db';
import { env } from './env';

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
      async authorize(credentials) {
        if (
          !credentials?.username ||
          !credentials?.password ||
          !credentials?.captcha
        ) {
          throw new Error('用户名、密码和验证码不能为空');
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

        try {
          // 验证验证码
          const captchaSessionId = (credentials as any).captchaSessionId;
          if (!captchaSessionId) {
            throw new Error('验证码会话ID缺失');
          }

          // 调用验证码验证API
          const captchaResponse = await fetch(
            `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/captcha`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId: captchaSessionId,
                captcha: credentials.captcha,
              }),
            }
          );

          if (!captchaResponse.ok) {
            const captchaError = await captchaResponse.json();
            throw new Error(captchaError.error || '验证码验证失败');
          }

          const captchaResult = await captchaResponse.json();
          if (!captchaResult.success) {
            throw new Error(captchaResult.error || '验证码错误');
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
            throw new Error('用户不存在');
          }

          // 检查用户状态
          if (user.status !== 'active') {
            throw new Error('用户账户已被禁用');
          }

          // 验证密码
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!isPasswordValid) {
            throw new Error('密码错误');
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
