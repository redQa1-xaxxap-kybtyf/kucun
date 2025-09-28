import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { env } from './env';

// 需要认证的路径
const protectedPaths = [
  '/dashboard',
  '/customers',
  '/products',
  '/inventory',
  '/sales-orders',
  '/return-orders',
  '/payments',
  '/api/users',
  '/api/customers',
  '/api/products',
  '/api/sales',
  '/api/inventory',
  '/api/inbound',
];

// 需要管理员权限的路径
const adminOnlyPaths = [
  '/api/users',
  '/dashboard/users',
  '/dashboard/settings',
  '/settings', // 系统设置页面（包括基本设置、用户管理等）
];

// 公开路径（不需要认证）
const publicPaths = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/error',
  '/api/auth',
];

// 检查路径是否需要认证
function isProtectedPath(pathname: string): boolean {
  return protectedPaths.some(path => pathname.startsWith(path));
}

// 检查路径是否需要管理员权限
function isAdminOnlyPath(pathname: string): boolean {
  return adminOnlyPaths.some(path => pathname.startsWith(path));
}

// 检查路径是否为公开路径
function isPublicPath(pathname: string): boolean {
  return publicPaths.some(path => pathname.startsWith(path));
}

// 认证中间件
export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源和公开路径直接放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  // 检查是否需要认证
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  try {
    // 获取用户 token
    const token = await getToken({
      req: request,
      secret: env.NEXTAUTH_SECRET,
    });

    // 未登录用户重定向到登录页
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // 检查用户状态
    if (token.status !== 'active') {
      const errorUrl = new URL('/auth/error', request.url);
      errorUrl.searchParams.set('error', 'AccountDisabled');
      return NextResponse.redirect(errorUrl);
    }

    // 检查管理员权限
    if (isAdminOnlyPath(pathname) && token.role !== 'admin') {
      const errorUrl = new URL('/auth/error', request.url);
      errorUrl.searchParams.set('error', 'AccessDenied');
      return NextResponse.redirect(errorUrl);
    }

    // 在请求头中添加用户信息，供 API 路由使用
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-role', token.role as string);
    requestHeaders.set('x-user-email', token.email as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('认证中间件错误:', error);

    // 认证错误时重定向到登录页
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('error', 'AuthenticationError');
    return NextResponse.redirect(signInUrl);
  }
}

// 从请求头中获取用户信息的工具函数
export function getUserFromHeaders(request: NextRequest) {
  return {
    id: request.headers.get('x-user-id'),
    role: request.headers.get('x-user-role'),
    email: request.headers.get('x-user-email'),
  };
}

// 检查用户权限的工具函数
export function hasPermission(
  userRole: string,
  requiredRoles: string[]
): boolean {
  return requiredRoles.includes(userRole);
}

// 权限检查装饰器函数
export function requireAuth(requiredRoles: string[] = []) {
  return function (handler: Function) {
    return async function (request: NextRequest, context: any) {
      const user = getUserFromHeaders(request);

      if (!user.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }

      if (
        requiredRoles.length > 0 &&
        !hasPermission(user.role!, requiredRoles)
      ) {
        return NextResponse.json(
          { success: false, error: '权限不足' },
          { status: 403 }
        );
      }

      // 将用户信息添加到上下文
      context.user = user;

      return handler(request, context);
    };
  };
}

// 管理员权限检查
export function requireAdmin() {
  return requireAuth(['admin']);
}

// 销售员或管理员权限检查
export function requireSalesOrAdmin() {
  return requireAuth(['sales', 'admin']);
}

// API 路由权限验证工具
export async function verifyApiAuth(
  request: NextRequest,
  requiredRoles: string[] = []
) {
  const user = getUserFromHeaders(request);

  if (!user.id) {
    throw new Error('未授权访问');
  }

  if (requiredRoles.length > 0 && !hasPermission(user.role!, requiredRoles)) {
    throw new Error('权限不足');
  }

  return user;
}
