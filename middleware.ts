import { NextResponse, type NextRequest } from 'next/server';

import { authMiddleware } from './lib/auth-middleware';

/**
 * 主中间件函数
 * 1. 执行身份验证
 * 2. 添加安全响应头
 */
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  const isAuthApi = pathname.startsWith('/api/auth');
  const isAuthPage = pathname.startsWith('/auth/');

  // 生产环境下，对认证相关路由强制要求 HTTPS
  if (process.env.NODE_ENV === 'production') {
    const proto =
      request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');

    if ((isAuthApi || isAuthPage) && proto !== 'https') {
      return new Response('HTTPS Required', { status: 403 });
    }
  }

  // 1. 执行身份验证中间件
  let response: Response;

  if (isAuthApi) {
    // 对 NextAuth API 不做登录检查，只追加安全头
    response = NextResponse.next();
  } else {
    const authResponse = await authMiddleware(request);

    // 如果身份验证失败或需要重定向，直接返回
    if (authResponse.status !== 200) {
      return authResponse;
    }

    // 2. 在认证响应上追加安全头
    response = authResponse;
  }

  // 生成 nonce 用于 CSP（Edge 环境下使用 Web API）
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === 'development';

  // Content Security Policy
  // 说明（仅注释，不会出现在 Header 中）：
  // - script-src 使用 nonce + strict-dynamic 严格限制脚本来源
  // - style-src 只使用 'unsafe-inline'，不再同时配置 nonce
  //   （浏览器规范：一旦同时存在 nonce/hash，会忽略 unsafe-inline）
  const cspDirectives = [
    "default-src 'self';",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${
      isDev ? "'unsafe-eval'" : ''
    };`,
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' blob: data: https:;",
    "font-src 'self' data:;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';",
    'upgrade-insecure-requests;',
  ];

  const cspHeader = cspDirectives
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 设置安全响应头
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

// 配置中间件匹配的路径
export const config = {
  matcher: [
    {
      /*
       * 匹配所有路径除了:
       * - /api/auth/* (Next-Auth.js 认证路由)
       * - /api/captcha (验证码 API)
       * - /api/address/* (地址数据 API - 省市区)
       * - /auth/signin, /auth/error (认证页面)
       * - /_next/static (静态文件)
       * - /_next/image (图片优化)
       * - /favicon.ico, /robots.txt, /sitemap.xml (公共文件)
       * - /public/* (公共静态资源)
       */
      source:
        '/((?!api/auth|api/captcha|api/address|auth/signin|auth/error|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|public).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    // 额外匹配认证 API 路由，用于强制 HTTPS 校验和安全头
    '/api/auth/:path*',
  ],
};
