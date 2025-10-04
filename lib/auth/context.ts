/**
 * 认证上下文模块
 * 职责：统一封装 Next-Auth session 信息和用户上下文
 *
 * 设计原则：
 * 1. API 路由通过中间件注入的 x-user-* 头读取用户信息
 * 2. 服务器组件通过 getServerSession 读取 session
 * 3. 客户端组件通过 useSession hook 读取 session
 * 4. 提供类型安全的用户信息访问接口
 */

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';

import { authOptions } from '@/lib/auth';

// ==================== 类型定义 ====================

/**
 * 认证用户信息
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
}

/**
 * 认证上下文
 */
export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

/**
 * API 认证结果
 */
export interface ApiAuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// ==================== API 路由认证 ====================

/**
 * 从 API 请求头中提取用户信息
 * 使用中间件注入的 x-user-* 头
 *
 * @param request - Next.js API 请求对象
 * @returns 认证结果
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = getApiAuthContext(request);
 *   if (!auth.success) {
 *     return NextResponse.json({ error: auth.error }, { status: 401 });
 *   }
 *   // 使用 auth.user
 * }
 * ```
 */
export function getApiAuthContext(request: NextRequest): ApiAuthResult {
  const userId = request.headers.get('x-user-id');
  const username = request.headers.get('x-user-username');
  const userRole = request.headers.get('x-user-role');
  const userEmail = request.headers.get('x-user-email');
  const userName = request.headers.get('x-user-name');
  const userStatus = request.headers.get('x-user-status');

  // 验证必需的认证头是否存在
  if (!userId || !username || !userRole) {
    return {
      success: false,
      error: '未授权访问：缺少认证信息',
    };
  }

  // 构建用户对象
  const user: AuthUser = {
    id: userId,
    email: userEmail || '',
    username,
    name: userName || username,
    role: userRole,
    status: userStatus || 'active',
  };

  return {
    success: true,
    user,
  };
}

/**
 * 要求 API 请求必须已认证
 * 如果未认证，抛出错误
 *
 * @param request - Next.js API 请求对象
 * @returns 已认证的用户信息
 * @throws Error 如果未认证
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const user = requireApiAuth(request);
 *   // user 一定存在，可以安全使用
 * }
 * ```
 */
export function requireApiAuth(request: NextRequest): AuthUser {
  const auth = getApiAuthContext(request);
  if (!auth.success || !auth.user) {
    throw new Error(auth.error || '未授权访问');
  }
  return auth.user;
}

// ==================== 服务器组件认证 ====================

/**
 * 在服务器组件中获取认证上下文
 *
 * @returns 认证上下文
 *
 * @example
 * ```typescript
 * export default async function Page() {
 *   const auth = await getServerAuthContext();
 *   if (!auth.isAuthenticated) {
 *     redirect('/auth/signin');
 *   }
 *   return <div>Welcome {auth.user.name}</div>;
 * }
 * ```
 */
export async function getServerAuthContext(): Promise<AuthContext> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      user: null,
      isAuthenticated: false,
    };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      name: session.user.name,
      role: session.user.role,
      status: session.user.status,
    },
    isAuthenticated: true,
  };
}

/**
 * 要求服务器组件必须已认证
 * 如果未认证，抛出错误
 *
 * @returns 已认证的用户信息
 * @throws Error 如果未认证
 *
 * @example
 * ```typescript
 * export default async function Page() {
 *   const user = await requireServerAuth();
 *   // user 一定存在，可以安全使用
 *   return <div>Welcome {user.name}</div>;
 * }
 * ```
 */
export async function requireServerAuth(): Promise<AuthUser> {
  const auth = await getServerAuthContext();
  if (!auth.isAuthenticated || !auth.user) {
    throw new Error('未授权访问');
  }
  return auth.user;
}

// ==================== 客户端认证 Hook ====================

/**
 * 客户端组件使用说明：
 *
 * 在客户端组件中，继续使用 next-auth 的 useSession hook：
 *
 * ```typescript
 * 'use client';
 * import { useSession } from 'next-auth/react';
 *
 * export function ClientComponent() {
 *   const { data: session, status } = useSession();
 *
 *   if (status === 'loading') return <div>Loading...</div>;
 *   if (status === 'unauthenticated') return <div>Not logged in</div>;
 *
 *   return <div>Welcome {session?.user.name}</div>;
 * }
 * ```
 *
 * 如果需要统一的认证上下文类型，可以创建自定义 hook：
 *
 * ```typescript
 * import { useSession } from 'next-auth/react';
 * import type { AuthContext } from '@/lib/auth/context';
 *
 * export function useAuthContext(): AuthContext {
 *   const { data: session } = useSession();
 *
 *   if (!session?.user) {
 *     return { user: null, isAuthenticated: false };
 *   }
 *
 *   return {
 *     user: {
 *       id: session.user.id,
 *       email: session.user.email,
 *       username: session.user.username,
 *       name: session.user.name,
 *       role: session.user.role,
 *       status: session.user.status,
 *     },
 *     isAuthenticated: true,
 *   };
 * }
 * ```
 */
