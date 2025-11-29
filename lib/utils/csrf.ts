/**
 * CSRF 工具函数
 *
 * 实现“双提交 Cookie”模式：
 * - 服务器在用户登录后设置一个非 HttpOnly 的 `csrf_token` Cookie
 * - 客户端在发起状态变更请求时：
 *   - 从 Cookie 中读取 `csrf_token`
 *   - 同时在 Header 中携带 `X-CSRF-Token`，值与 Cookie 相同
 * - 服务器在 `withAuth` 中验证：
 *   - 请求方法为 POST/PUT/PATCH/DELETE 时，
 *   - 要求 `X-CSRF-Token` 与 `csrf_token` Cookie 完全一致
 */

/**
 * 从浏览器 Cookie 中读取 csrf_token
 * 仅在浏览器环境中有效
 */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('csrf_token='));

  if (!match) return null;

  const [, rawValue] = match.split('=');
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

/**
 * 为 fetch 请求附加 CSRF 头部
 *
 * 用法示例：
 * ```ts
 * const response = await fetch(
 *   '/api/xxx',
 *   getCsrfTokenHeader({
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(data),
 *   })
 * );
 * ```
 */
export function getCsrfTokenHeader(
  init: RequestInit = {}
): RequestInit & { headers: Record<string, string> } {
  const token = getCsrfTokenFromCookie();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers['X-CSRF-Token'] = token;
  }

  return {
    ...init,
    headers,
  };
}

/**
 * 包装 fetch，自动附带 CSRF 头
 * 建议在客户端对所有 API 调用统一使用
 */
export function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input as any, getCsrfTokenHeader(init));
}
