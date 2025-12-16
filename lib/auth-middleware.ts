import { type NextRequest, NextResponse } from 'next/server';
import { decode, getToken } from 'next-auth/jwt';

import { env } from './env';

// 内部调用密钥（与 verify-token API 保持一致）
const INTERNAL_API_KEY = `internal_${env.NEXTAUTH_SECRET?.slice(0, 16)}`;
const MINI_PROGRAM_JWT_SALT = 'mini-program';

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
  '/purchase-orders', // 采购订单页面
  '/settings',
  '/help',
  '/profile', // 个人资料页面

  // API 路径
  '/api/settings',
  '/api/customers',
  '/api/products',
  '/api/sales',
  '/api/sales-orders',
  '/api/inventory',
  '/api/inbound',
  '/api/finance',
  '/api/suppliers',
  '/api/categories',
  '/api/factory-shipments',
  '/api/purchase-orders', // 采购订单 API
  '/api/return-orders',
  '/api/payments',
  '/api/dashboard',
  '/api/refunds',
  '/api/shipping',
  '/api/upload',
  '/api/batch-specifications',
  '/api/product-variants',
  '/api/seed-test-data',
  '/api/notifications', // 通知 API
  '/api/price-history', // 价格历史 API
  '/api/profile', // 个人资料 API
  '/api/admin', // 管理端 API（仅管理员可用）
];

// 需要管理员权限的路径
const adminOnlyPaths = [
  '/api/settings/users',
  '/api/admin',
  '/dashboard/users',
  '/dashboard/settings',
  '/settings', // 系统设置页面（包括基本设置、用户管理等）
];

// 公开路径（不需要认证）
const publicPaths = [
  '/auth/signin',
  '/auth/error',
  '/api/auth',
  '/api/captcha',
  '/api/address', // 地址数据 API（省市区）
  '/api/internal', // 内部API（仅供middleware使用）
  '/api/uploads', // 本地上传文件读取（供 Web/小程序图片展示）
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
  // 其他路径使用 startsWith 匹配
  return publicPaths.some(path => pathname.startsWith(path));
}

// 小程序游客允许访问的公开 API（仅 GET）
function isMiniProgramPublicApiPath(pathname: string, method: string): boolean {
  if (method !== 'GET') {
    return false;
  }

  // 仅用于产品 / 分类 / 库存的只读接口
  if (
    pathname === '/api/products' ||
    /^\/api\/products\/[^/]+$/.test(pathname)
  ) {
    return true;
  }

  if (
    pathname === '/api/categories' ||
    /^\/api\/categories\/[^/]+$/.test(pathname)
  ) {
    return true;
  }

  // 库存只放行列表和单条明细，不包含 adjust / counts / alerts 等
  if (pathname === '/api/inventory') {
    return true;
  }

  if (/^\/api\/inventory\/[^/]+$/.test(pathname)) {
    return true;
  }

  return false;
}

// 认证中间件
export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🚀 性能优化：处理首页重定向（避免多次 session 查询）
  if (pathname === '/') {
    const token = await getToken({
      req: request,
      secret: env.NEXTAUTH_SECRET,
    });

    if (token && token.status === 'active') {
      // 已登录用户重定向到 dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      // 未登录用户重定向到登录页
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
  }

  // 第一层防护：静态资源和公开路径直接放行（防止循环重定向）
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  // 第二层防护：检查是否需要认证（非受保护路径直接放行）
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith('/api/');
  const method = request.method.toUpperCase();

  // 小程序游客模式：带有 x-client-from=mini-program 的请求，
  // 对产品 / 分类 / 库存的只读接口放行，不强制登录
  if (isApiRoute) {
    const clientFrom = request.headers.get('x-client-from');
    if (
      clientFrom === 'mini-program' &&
      isMiniProgramPublicApiPath(pathname, method)
    ) {
      return NextResponse.next();
    }
  }

  try {
    let token: any = null;

    // 🔧 小程序支持：检查 Bearer Token（用于微信小程序）
    // 说明：部分代理/网关可能不透传 Authorization 头，故同时支持 x-mini-token 作为兜底
    const authHeader = request.headers.get('Authorization');
    const miniTokenHeader = request.headers.get('x-mini-token');

    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : miniTokenHeader || null;

    if (bearerToken) {
      // 0) 优先直接解码小程序 token，避免中间件内部 fetch 自己的 API 在某些部署环境下不稳定
      try {
        const payload = await decode({
          token: bearerToken,
          secret: env.NEXTAUTH_SECRET,
          salt: MINI_PROGRAM_JWT_SALT,
        });

        if (payload && typeof payload === 'object') {
          const userId = String((payload as any).sub || (payload as any).id || '');
          const username = String((payload as any).username || '');
          if (userId && username) {
            token = {
              sub: userId,
              email: (payload as any).email ?? '',
              name: (payload as any).name ?? '',
              username,
              role: (payload as any).role ?? 'user',
              status: (payload as any).status ?? 'active',
            };
          }
        }
      } catch (_error) {
        // ignore，继续走内部验证兜底
      }

      // 1) 兜底：调用内部API验证 Bearer Token
      if (!token) {
        try {
          const verifyResponse = await fetch(
            new URL('/api/internal/verify-token', request.url),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_API_KEY,
              },
              body: JSON.stringify({ token: bearerToken }),
            }
          );

          if (verifyResponse.ok) {
            const result = await verifyResponse.json();
            if (result.success && result.user) {
              // 构造与NextAuth token格式兼容的对象
              token = {
                sub: result.user.id,
                email: result.user.email,
                name: result.user.name,
                username: result.user.username,
                role: result.user.role,
                status: result.user.status,
              };
            }
          }
        } catch (error) {
          // Bearer Token验证失败，继续尝试NextAuth
          // eslint-disable-next-line no-console
          console.warn(
            'Bearer token verification failed, trying NextAuth',
            error
          );
        }
      }
    }

    // 如果Bearer Token验证失败，尝试NextAuth（Web前端）
    if (!token) {
      token = await getToken({
        req: request,
        secret: env.NEXTAUTH_SECRET,
      });
    }

    // 未登录用户处理
    if (!token) {
      if (isApiRoute) {
        // 小程序端排查：输出是否拿到了认证头（避免“线上能登录但写操作全 401”难以定位）
        if (request.headers.get('x-client-from') === 'mini-program') {
          // eslint-disable-next-line no-console
          console.warn('mini-program unauthorized (missing token)', {
            pathname,
            method,
            hasAuthorization: !!request.headers.get('Authorization'),
            hasMiniToken: !!request.headers.get('x-mini-token'),
          });
        }

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

    // 使用新的请求头创建响应，并确保设置 CSRF Token Cookie（双提交 Cookie 模式）
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // 如果不存在 csrf_token，则生成并设置一个非 HttpOnly 的 Cookie
    const existingCsrf = request.cookies.get('csrf_token')?.value;
    const csrfToken = existingCsrf ?? crypto.randomUUID();

    // 注意：双提交 Cookie 需要客户端可读，因此 httpOnly 必须为 false
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
    });

    return response;
  } catch (error) {
    // 在 Edge Runtime 中避免引入 Prisma 等 Node 专用依赖，这里仅做简单日志输出
    // eslint-disable-next-line no-console
    console.error('auth-middleware error', {
      error,
      url: request.url,
      method: request.method,
    });

    // 认证错误时重定向到登录页
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('error', 'AuthenticationError');
    return NextResponse.redirect(signInUrl);
  }
}
