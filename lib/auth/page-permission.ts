/**
 * 页面级权限检查工具
 * 用于在 Server Components 中进行权限验证
 *
 * 使用场景：
 * - 保护需要特定权限才能访问的页面
 * - 在用户无权限时重定向到合适的页面
 * - 提供统一的权限检查体验
 *
 * @example
 * ```typescript
 * export default async function InventoryPage() {
 *   await requirePagePermission('inventory:view');
 *   // ... 页面逻辑
 * }
 * ```
 */

import { redirect } from 'next/navigation';

import { safeAuth } from '@/lib/auth';
import { can, type Permission } from '@/lib/auth/permissions';

/**
 * 页面权限检查选项
 */
interface PagePermissionOptions {
  /**
   * 无权限时的重定向路径
   * @default '/dashboard'
   */
  redirectTo?: string;

  /**
   * 是否显示 403 页面而不是重定向
   * @default false
   */
  show403?: boolean;
}

/**
 * 要求用户拥有指定权限才能访问页面
 * 如果用户未登录，重定向到登录页
 * 如果用户无权限，根据配置重定向或显示 403
 *
 * @param permission - 所需权限
 * @param options - 权限检查选项
 * @returns 用户 Session（如果验证通过）
 *
 * @example
 * ```typescript
 * // 基础使用
 * await requirePagePermission('inventory:view');
 *
 * // 自定义重定向
 * await requirePagePermission('inventory:adjust', {
 *   redirectTo: '/inventory'
 * });
 *
 * // 显示 403 页面
 * await requirePagePermission('settings:manage_users', {
 *   show403: true
 * });
 * ```
 */
export async function requirePagePermission(
  permission: Permission,
  options: PagePermissionOptions = {}
) {
  const { redirectTo = '/dashboard', show403 = false } = options;

  // 获取用户 session
  const session = await safeAuth('require-page-permission');

  // 未登录：重定向到登录页
  if (!session) {
    redirect('/auth/signin');
  }

  // 检查权限
  if (!can(session.user, permission)) {
    if (show403) {
      // TODO: 创建 403 页面后启用
      // throw new Error('FORBIDDEN');
      redirect(redirectTo);
    } else {
      redirect(redirectTo);
    }
  }

  return session;
}

/**
 * 要求用户拥有任一指定权限才能访问页面
 *
 * @param permissions - 权限列表（满足任一即可）
 * @param options - 权限检查选项
 * @returns 用户 Session（如果验证通过）
 *
 * @example
 * ```typescript
 * // 允许查看或管理财务数据的用户访问
 * await requireAnyPagePermission([
 *   'finance:view',
 *   'finance:manage'
 * ]);
 * ```
 */
export async function requireAnyPagePermission(
  permissions: Permission[],
  options: PagePermissionOptions = {}
) {
  const { redirectTo = '/dashboard', show403 = false } = options;

  const session = await safeAuth('require-any-page-permission');

  if (!session) {
    redirect('/auth/signin');
  }

  // 检查是否拥有任一权限
  const hasAnyPermission = permissions.some(permission =>
    can(session.user, permission)
  );

  if (!hasAnyPermission) {
    if (show403) {
      redirect(redirectTo);
    } else {
      redirect(redirectTo);
    }
  }

  return session;
}

/**
 * 要求用户拥有所有指定权限才能访问页面
 *
 * @param permissions - 权限列表（必须全部拥有）
 * @param options - 权限检查选项
 * @returns 用户 Session（如果验证通过）
 *
 * @example
 * ```typescript
 * // 需要同时拥有查看和导出权限
 * await requireAllPagePermissions([
 *   'finance:view',
 *   'finance:export'
 * ]);
 * ```
 */
export async function requireAllPagePermissions(
  permissions: Permission[],
  options: PagePermissionOptions = {}
) {
  const { redirectTo = '/dashboard', show403 = false } = options;

  const session = await safeAuth('require-all-page-permissions');

  if (!session) {
    redirect('/auth/signin');
  }

  // 检查是否拥有所有权限
  const hasAllPermissions = permissions.every(permission =>
    can(session.user, permission)
  );

  if (!hasAllPermissions) {
    if (show403) {
      redirect(redirectTo);
    } else {
      redirect(redirectTo);
    }
  }

  return session;
}

/**
 * 检查页面权限但不重定向
 * 适用于条件性显示内容的场景
 *
 * @param permission - 所需权限
 * @returns 是否拥有权限
 *
 * @example
 * ```typescript
 * const canEdit = await checkPagePermission('inventory:adjust');
 *
 * return (
 *   <div>
 *     {canEdit && <EditButton />}
 *   </div>
 * );
 * ```
 */
export async function checkPagePermission(
  permission: Permission
): Promise<boolean> {
  const session = await safeAuth('check-page-permission');

  if (!session) {
    return false;
  }

  return can(session.user, permission);
}
