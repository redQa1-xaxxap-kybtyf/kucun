import { getToken } from 'next-auth/jwt';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from './env';

// 需要认证的路径
const protectedPaths = [
  // 页面路径
  '/dashboard',
  '/customers',
  '/products',
  '/inventory',
  '/sales-orders',
  '/return-orders',
  '/payments',
  '/finance',
  '/suppliers',
  '/categories',
  '/factory-shipments',
  '/settings',
  '/help',

  // API 路径
  '/api/settings',
  '/api/customers',
  '/api/products',
  '/api/sales',
  '/api/inventory',
  '/api/inbound',
  '/api/finance',
  '/api/suppliers',
  '/api/categories',
  '/api/factory-shipments',
  '/api/return-orders',
  '/api/payments',
  '/api/dashboard',
  '/api/upload',
  '/api/batch-specifications',
  '/api/product-variants',
  '/api/seed-test-data',
];

// 需要管理员权限的路径
const adminOnlyPaths = [
  '/api/settings/users',
  '/dashboard/users',
  '/dashboard/settings',
  '/settings', // 系统设置页面（包括基本设置、用户管理等）
];

// 公开路径（不需要认证）
const publicPaths = [
  '/auth/signin',
  '/auth/signup',
  '/auth/error',
  '/api/auth',
  '/api/captcha',
  '/api/address', // 地址数据 API（省市区）
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
  // 精确匹配首页
  if (pathname === '/') {
    return true;
  }
  // 其他路径使用 startsWith 匹配
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

    // 判断是否为 API 路由
    const isApiRoute = pathname.startsWith('/api/');

    // 未登录用户处理
    if (!token) {
      if (isApiRoute) {
        // API 路由返回 401 JSON 响应
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      } else {
        // 页面路由重定向到登录页
        const signInUrl = new URL('/auth/signin', request.url);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(signInUrl);
      }
    }

    // 检查用户状态
    if (token.status !== 'active') {
      if (isApiRoute) {
        // API 路由返回 403 JSON 响应
        return NextResponse.json(
          { success: false, error: '账户已被禁用' },
          { status: 403 }
        );
      } else {
        // 页面路由重定向到错误页
        const errorUrl = new URL('/auth/error', request.url);
        errorUrl.searchParams.set('error', 'AccountDisabled');
        return NextResponse.redirect(errorUrl);
      }
    }

    // 检查管理员权限
    if (isAdminOnlyPath(pathname) && token.role !== 'admin') {
      if (isApiRoute) {
        // API 路由返回 403 JSON 响应
        return NextResponse.json(
          { success: false, error: '权限不足' },
          { status: 403 }
        );
      } else {
        // 页面路由重定向到错误页
        const errorUrl = new URL('/auth/error', request.url);
        errorUrl.searchParams.set('error', 'AccessDenied');
        return NextResponse.redirect(errorUrl);
      }
    }

    // 认证通过，透传用户信息到请求头（供 API 路由使用）
    // 创建新的请求头，包含完整的用户信息
    // 注意：HTTP Headers 只支持 ASCII 字符，中文等非 ASCII 字符需要进行 URL 编码
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.sub || '');
    requestHeaders.set('x-user-email', token.email || '');
    requestHeaders.set(
      'x-user-name',
      encodeURIComponent(token.name || token.username || '')
    );
    requestHeaders.set('x-user-username', token.username || '');
    requestHeaders.set('x-user-role', token.role || 'user');
    requestHeaders.set('x-user-status', token.status || 'active');

    // 使用新的请求头创建响应
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
