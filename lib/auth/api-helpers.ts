/**
 * API 认证辅助函数模块
 * 职责：提供统一的 API 路由认证和权限检查工具
 *
 * 使用说明：
 * 1. 使用 requireAuth() 进行基础认证检查
 * 2. 使用 requirePermission() 进行权限检查
 * 3. 使用 withAuth() 包装 API 处理函数，自动处理认证和错误
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { AuthUser } from './context';
import { getApiAuthContext } from './context';
import type { Permission } from './permissions';
import { can, requirePermission } from './permissions';

// ==================== 类型定义 ====================

/**
 * API 处理函数类型
 */
export type ApiHandler = (
  request: NextRequest,
  context: { user: AuthUser; params?: Promise<Record<string, string>> | Record<string, string> }
) => Promise<Response> | Response;

/**
 * 认证选项
 */
export interface AuthOptions {
  /** 是否需要管理员权限 */
  requireAdmin?: boolean;
  /** 所需权限列表 */
  permissions?: Permission[];
  /** 所需权限（任一） */
  anyPermissions?: Permission[];
  /** 所需权限（全部） */
  allPermissions?: Permission[];
}

// ==================== 基础认证函数 ====================

/**
 * 要求 API 请求必须已认证
 * 简化版本，直接返回用户或抛出错误
 *
 * @param request - Next.js API 请求对象
 * @returns 已认证的用户信息
 * @throws Error 如果未认证
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const user = requireAuth(request);
 *   // 继续业务逻辑...
 * }
 * ```
 */
export function requireAuth(request: NextRequest): AuthUser {
  const auth = getApiAuthContext(request);
  if (!auth.success || !auth.user) {
    throw new Error(auth.error || '未授权访问');
  }
  return auth.user;
}

/**
 * 检查用户权限（便捷函数）
 *
 * @param request - Next.js API 请求对象
 * @param permission - 所需权限
 * @returns 已认证且有权限的用户信息
 * @throws Error 如果未认证或权限不足
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const user = requireAuthWithPermission(request, 'finance:view');
 *   // 继续业务逻辑...
 * }
 * ```
 */
export function requireAuthWithPermission(
  request: NextRequest,
  permission: Permission
): AuthUser {
  const user = requireAuth(request);
  requirePermission(user, permission);
  return user;
}

/**
 * 检查用户是否为管理员
 *
 * @param request - Next.js API 请求对象
 * @returns 已认证的管理员用户信息
 * @throws Error 如果未认证或不是管理员
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const admin = requireAdmin(request);
 *   // 继续业务逻辑...
 * }
 * ```
 */
export function requireAdmin(request: NextRequest): AuthUser {
  const user = requireAuth(request);
  if (user.role !== 'admin') {
    throw new Error('权限不足：需要管理员权限');
  }
  return user;
}

// ==================== 高阶函数 ====================

/**
 * API 路由认证包装器
 * 自动处理认证、权限检查和错误响应
 *
 * @param handler - API 处理函数
 * @param options - 认证选项
 * @returns 包装后的处理函数
 *
 * @example
 * ```typescript
 * // 基础认证
 * export const GET = withAuth(async (request, { user }) => {
 *   return NextResponse.json({ data: user });
 * });
 *
 * // 需要特定权限
 * export const POST = withAuth(
 *   async (request, { user }) => {
 *     // 业务逻辑...
 *     return NextResponse.json({ success: true });
 *   },
 *   { permissions: ['finance:manage'] }
 * );
 *
 * // 需要管理员权限
 * export const DELETE = withAuth(
 *   async (request, { user }) => {
 *     // 业务逻辑...
 *     return NextResponse.json({ success: true });
 *   },
 *   { requireAdmin: true }
 * );
 * ```
 */
export function withAuth(
  handler: ApiHandler,
  options: AuthOptions = {}
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => Promise<Response> {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> | Record<string, string> }) => {
    try {
      // 1. 认证检查
      const user = requireAuth(request);

      // 2. 管理员权限检查
      if (options.requireAdmin && user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: '权限不足：需要管理员权限' },
          { status: 403 }
        );
      }

      // 3. 权限检查（单个权限）
      if (options.permissions) {
        for (const permission of options.permissions) {
          if (!can(user, permission)) {
            return NextResponse.json(
              { success: false, error: `权限不足：需要 ${permission} 权限` },
              { status: 403 }
            );
          }
        }
      }

      // 4. 权限检查（任一权限）
      if (options.anyPermissions) {
        const hasAnyPermission = options.anyPermissions.some(permission =>
          can(user, permission)
        );
        if (!hasAnyPermission) {
          return NextResponse.json(
            {
              success: false,
              error: `权限不足：需要以下权限之一 ${options.anyPermissions.join(', ')}`,
            },
            { status: 403 }
          );
        }
      }

      // 5. 权限检查（全部权限）
      if (options.allPermissions) {
        const hasAllPermissions = options.allPermissions.every(permission =>
          can(user, permission)
        );
        if (!hasAllPermissions) {
          return NextResponse.json(
            {
              success: false,
              error: `权限不足：需要所有以下权限 ${options.allPermissions.join(', ')}`,
            },
            { status: 403 }
          );
        }
      }

      // 6. 执行业务逻辑
      return await handler(request, {
        user,
        params: context?.params,
      });
    } catch (error) {
      // 错误处理
      console.error('[API Auth] 请求处理失败:', error);

      // 认证错误
      if (
        error instanceof Error &&
        error.message.includes('未授权')
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }

      // 权限错误
      if (
        error instanceof Error &&
        error.message.includes('权限不足')
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }

      // 其他错误
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '服务器内部错误',
        },
        { status: 500 }
      );
    }
  };
}

// ==================== 错误响应工具 ====================

/**
 * 返回未授权错误响应
 */
export function unauthorizedResponse(message = '未授权访问') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

/**
 * 返回权限不足错误响应
 */
export function forbiddenResponse(message = '权限不足') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

/**
 * 返回成功响应
 */
export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message }),
  });
}

/**
 * 返回错误响应
 */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

// ==================== 使用示例 ====================

/**
 * 使用示例：
 *
 * ```typescript
 * // 1. 基础认证（最简单）
 * export const GET = withAuth(async (request, { user }) => {
 *   // user 已经过认证，可以直接使用
 *   return successResponse({ userId: user.id });
 * });
 *
 * // 2. 需要特定权限
 * export const POST = withAuth(
 *   async (request, { user }) => {
 *     const body = await request.json();
 *     // 业务逻辑...
 *     return successResponse({ created: true });
 *   },
 *   { permissions: ['finance:manage'] }
 * );
 *
 * // 3. 需要管理员权限
 * export const DELETE = withAuth(
 *   async (request, { user }) => {
 *     // 业务逻辑...
 *     return successResponse({ deleted: true });
 *   },
 *   { requireAdmin: true }
 * );
 *
 * // 4. 需要任一权限
 * export const GET = withAuth(
 *   async (request, { user }) => {
 *     // 业务逻辑...
 *     return successResponse({ data: [] });
 *   },
 *   { anyPermissions: ['finance:view', 'finance:manage'] }
 * );
 *
 * // 5. 手动控制（更灵活）
 * export async function GET(request: NextRequest) {
 *   // 方式1: 使用 requireAuth
 *   const user = requireAuth(request);
 *
 *   // 方式2: 使用 requireAuthWithPermission
 *   const user = requireAuthWithPermission(request, 'finance:view');
 *
 *   // 方式3: 使用 requireAdmin
 *   const admin = requireAdmin(request);
 *
 *   // 业务逻辑...
 *   return successResponse({ data: [] });
 * }
 * ```
 */
