import { NextRequest, NextResponse } from 'next/server';

import { authMiddleware } from './lib/auth-middleware';

/**
 * 主中间件函数
 * 1. 执行身份验证
 * 2. 添加安全响应头
 */
export async function middleware(request: NextRequest) {
  // 1. 执行身份验证中间件
  const authResponse = await authMiddleware(request);

  // 如果身份验证失败(重定向),直接返回
  if (authResponse.status === 307 || authResponse.status === 308) {
    return authResponse;
  }

  // 2. 添加安全头
  const response = NextResponse.next({
    request: {
      headers: authResponse.headers,
    },
  });

  // 生成 nonce 用于 CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''};
    style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`};
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
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
       * - api/auth/* (Next-Auth.js 路由)
       * - _next/static (静态文件)
       * - _next/image (图片优化)
       * - favicon.ico (网站图标)
       * - public/* (公共静态文件)
       */
      source: '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
