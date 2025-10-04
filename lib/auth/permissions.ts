/**
 * 声明式权限系统
 * 职责：提供基于能力(capability)的权限判断机制
 *
 * 设计原则：
 * 1. 使用 can('resource:action') 风格的声明式 API
 * 2. 权限规则集中定义，易于维护
 * 3. 支持角色继承和权限组合
 * 4. 类型安全的权限检查
 */

import type { AuthUser } from './context';

// ==================== 权限定义 ====================

/**
 * 系统权限列表
 * 格式：'resource:action'
 */
export type Permission =
  // 财务权限
  | 'finance:view' // 查看财务数据
  | 'finance:manage' // 管理财务数据（包括应收应付、收退款）
  | 'finance:export' // 导出财务报表
  | 'finance:approve' // 审批财务单据
  // 客户权限
  | 'customers:view' // 查看客户信息
  | 'customers:create' // 创建客户
  | 'customers:edit' // 编辑客户
  | 'customers:delete' // 删除客户
  // 产品权限
  | 'products:view' // 查看产品
  | 'products:create' // 创建产品
  | 'products:edit' // 编辑产品
  | 'products:delete' // 删除产品
  | 'products:manage_price' // 管理产品价格
  // 库存权限
  | 'inventory:view' // 查看库存
  | 'inventory:adjust' // 调整库存
  | 'inventory:inbound' // 入库操作
  | 'inventory:outbound' // 出库操作
  | 'inventory:transfer' // 库存调拨
  // 订单权限
  | 'orders:view' // 查看订单
  | 'orders:create' // 创建订单
  | 'orders:edit' // 编辑订单
  | 'orders:delete' // 删除订单
  | 'orders:approve' // 审批订单
  | 'orders:ship' // 发货
  | 'orders:complete' // 完成订单
  // 退货权限
  | 'returns:view' // 查看退货单
  | 'returns:create' // 创建退货单
  | 'returns:edit' // 编辑退货单
  | 'returns:delete' // 删除退货单
  | 'returns:approve' // 审批退货单
  | 'returns:reject' // 拒绝退货单
  // 供应商权限
  | 'suppliers:view' // 查看供应商
  | 'suppliers:create' // 创建供应商
  | 'suppliers:edit' // 编辑供应商
  | 'suppliers:delete' // 删除供应商
  // 系统设置权限
  | 'settings:view' // 查看系统设置
  | 'settings:edit' // 编辑系统设置
  | 'settings:manage_users' // 管理用户
  | 'settings:manage_roles' // 管理角色权限
  | 'settings:view_logs' // 查看系统日志
  // 报表权限
  | 'reports:view' // 查看报表
  | 'reports:export' // 导出报表
  | 'reports:advanced' // 高级报表分析
  // 仓库发货权限
  | 'shipments:view' // 查看仓库发货
  | 'shipments:create' // 创建发货单
  | 'shipments:edit' // 编辑发货单
  | 'shipments:confirm' // 确认发货
  // 分类权限
  | 'categories:view' // 查看分类
  | 'categories:create' // 创建分类
  | 'categories:edit' // 编辑分类
  | 'categories:delete'; // 删除分类

/**
 * 角色类型
 */
export type Role = 'admin' | 'sales' | 'warehouse' | 'finance';

// ==================== 角色权限映射 ====================

/**
 * 角色权限配置
 * 定义每个角色拥有的权限列表
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // 管理员：拥有所有权限
  admin: [
    // 财务
    'finance:view',
    'finance:manage',
    'finance:export',
    'finance:approve',
    // 客户
    'customers:view',
    'customers:create',
    'customers:edit',
    'customers:delete',
    // 产品
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'products:manage_price',
    // 库存
    'inventory:view',
    'inventory:adjust',
    'inventory:inbound',
    'inventory:outbound',
    'inventory:transfer',
    // 订单
    'orders:view',
    'orders:create',
    'orders:edit',
    'orders:delete',
    'orders:approve',
    'orders:ship',
    'orders:complete',
    // 退货
    'returns:view',
    'returns:create',
    'returns:edit',
    'returns:delete',
    'returns:approve',
    'returns:reject',
    // 供应商
    'suppliers:view',
    'suppliers:create',
    'suppliers:edit',
    'suppliers:delete',
    // 系统设置
    'settings:view',
    'settings:edit',
    'settings:manage_users',
    'settings:manage_roles',
    'settings:view_logs',
    // 报表
    'reports:view',
    'reports:export',
    'reports:advanced',
    // 仓库发货
    'shipments:view',
    'shipments:create',
    'shipments:edit',
    'shipments:confirm',
    // 分类
    'categories:view',
    'categories:create',
    'categories:edit',
    'categories:delete',
  ],

  // 销售：核心业务权限
  sales: [
    // 财务（只读）
    'finance:view',
    // 客户
    'customers:view',
    'customers:create',
    'customers:edit',
    // 产品（只读 + 价格管理）
    'products:view',
    'products:manage_price',
    // 库存（只读）
    'inventory:view',
    // 订单
    'orders:view',
    'orders:create',
    'orders:edit',
    'orders:ship',
    'orders:complete',
    // 退货
    'returns:view',
    'returns:create',
    'returns:edit',
    // 供应商（只读）
    'suppliers:view',
    // 报表（基础）
    'reports:view',
    'reports:export',
    // 仓库发货
    'shipments:view',
    'shipments:create',
    'shipments:edit',
    // 分类（只读）
    'categories:view',
  ],

  // 仓库：库存和发货权限
  warehouse: [
    // 产品（只读）
    'products:view',
    // 库存
    'inventory:view',
    'inventory:adjust',
    'inventory:inbound',
    'inventory:outbound',
    'inventory:transfer',
    // 订单（只读 + 发货）
    'orders:view',
    'orders:ship',
    // 退货（只读）
    'returns:view',
    // 供应商（只读）
    'suppliers:view',
    // 仓库发货
    'shipments:view',
    'shipments:create',
    'shipments:edit',
    'shipments:confirm',
    // 分类（只读）
    'categories:view',
  ],

  // 财务：财务相关权限
  finance: [
    // 财务
    'finance:view',
    'finance:manage',
    'finance:export',
    'finance:approve',
    // 客户（只读）
    'customers:view',
    // 产品（只读）
    'products:view',
    // 订单（只读）
    'orders:view',
    // 退货（审批）
    'returns:view',
    'returns:approve',
    'returns:reject',
    // 供应商（只读）
    'suppliers:view',
    // 报表
    'reports:view',
    'reports:export',
    'reports:advanced',
    // 分类（只读）
    'categories:view',
  ],
};

// ==================== 权限检查函数 ====================

/**
 * 检查用户是否拥有指定权限
 *
 * @param user - 用户信息
 * @param permission - 权限标识
 * @returns 是否拥有权限
 *
 * @example
 * ```typescript
 * const user = await requireApiAuth(request);
 * if (!can(user, 'finance:view')) {
 *   return NextResponse.json({ error: '权限不足' }, { status: 403 });
 * }
 * ```
 */
export function can(user: AuthUser | null, permission: Permission): boolean {
  if (!user) {
    return false;
  }

  // 获取用户角色的权限列表
  const rolePermissions = ROLE_PERMISSIONS[user.role as Role];
  if (!rolePermissions) {
    return false;
  }

  // 检查权限列表中是否包含指定权限
  return rolePermissions.includes(permission);
}

/**
 * 检查用户是否拥有任一指定权限
 *
 * @param user - 用户信息
 * @param permissions - 权限标识数组
 * @returns 是否拥有任一权限
 *
 * @example
 * ```typescript
 * if (!canAny(user, ['finance:view', 'finance:manage'])) {
 *   return NextResponse.json({ error: '权限不足' }, { status: 403 });
 * }
 * ```
 */
export function canAny(
  user: AuthUser | null,
  permissions: Permission[]
): boolean {
  return permissions.some(permission => can(user, permission));
}

/**
 * 检查用户是否拥有所有指定权限
 *
 * @param user - 用户信息
 * @param permissions - 权限标识数组
 * @returns 是否拥有所有权限
 *
 * @example
 * ```typescript
 * if (!canAll(user, ['finance:view', 'finance:export'])) {
 *   return NextResponse.json({ error: '权限不足' }, { status: 403 });
 * }
 * ```
 */
export function canAll(
  user: AuthUser | null,
  permissions: Permission[]
): boolean {
  return permissions.every(permission => can(user, permission));
}

/**
 * 要求用户拥有指定权限，否则抛出错误
 *
 * @param user - 用户信息
 * @param permission - 权限标识
 * @throws Error 如果用户没有权限
 *
 * @example
 * ```typescript
 * const user = await requireApiAuth(request);
 * requirePermission(user, 'finance:view');
 * // 继续执行业务逻辑...
 * ```
 */
export function requirePermission(
  user: AuthUser | null,
  permission: Permission
): void {
  if (!can(user, permission)) {
    throw new Error(`权限不足：需要 ${permission} 权限`);
  }
}

/**
 * 要求用户拥有任一指定权限，否则抛出错误
 *
 * @param user - 用户信息
 * @param permissions - 权限标识数组
 * @throws Error 如果用户没有任一权限
 */
export function requireAnyPermission(
  user: AuthUser | null,
  permissions: Permission[]
): void {
  if (!canAny(user, permissions)) {
    throw new Error(`权限不足：需要以下权限之一 ${permissions.join(', ')}`);
  }
}

/**
 * 要求用户拥有所有指定权限，否则抛出错误
 *
 * @param user - 用户信息
 * @param permissions - 权限标识数组
 * @throws Error 如果用户没有所有权限
 */
export function requireAllPermissions(
  user: AuthUser | null,
  permissions: Permission[]
): void {
  if (!canAll(user, permissions)) {
    throw new Error(`权限不足：需要所有以下权限 ${permissions.join(', ')}`);
  }
}

// ==================== 角色检查函数 ====================

/**
 * 检查用户是否为管理员
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin';
}

/**
 * 检查用户是否为销售
 */
export function isSales(user: AuthUser | null): boolean {
  return user?.role === 'sales';
}

/**
 * 检查用户是否为仓库管理员
 */
export function isWarehouse(user: AuthUser | null): boolean {
  return user?.role === 'warehouse';
}

/**
 * 检查用户是否为财务
 */
export function isFinance(user: AuthUser | null): boolean {
  return user?.role === 'finance';
}

/**
 * 获取用户的所有权限列表
 *
 * @param user - 用户信息
 * @returns 权限列表
 *
 * @example
 * ```typescript
 * const permissions = getUserPermissions(user);
 * console.log(permissions); // ['finance:view', 'finance:manage', ...]
 * ```
 */
export function getUserPermissions(user: AuthUser | null): Permission[] {
  if (!user) {
    return [];
  }
  return ROLE_PERMISSIONS[user.role as Role] || [];
}

// ==================== 权限中间件工厂 ====================

/**
 * 创建权限检查中间件
 * 用于在 API 路由中统一处理权限验证
 *
 * @param permission - 所需权限
 * @returns 权限检查函数
 *
 * @example
 * ```typescript
 * import { withPermission } from '@/lib/auth/permissions';
 * import { requireApiAuth } from '@/lib/auth/context';
 *
 * export async function GET(request: NextRequest) {
 *   const user = requireApiAuth(request);
 *   withPermission('finance:view')(user);
 *
 *   // 继续执行业务逻辑...
 * }
 * ```
 */
export function withPermission(permission: Permission) {
  return (user: AuthUser | null) => {
    requirePermission(user, permission);
  };
}

/**
 * 创建多权限检查中间件（任一）
 *
 * @param permissions - 所需权限列表
 * @returns 权限检查函数
 */
export function withAnyPermission(permissions: Permission[]) {
  return (user: AuthUser | null) => {
    requireAnyPermission(user, permissions);
  };
}

/**
 * 创建多权限检查中间件（全部）
 *
 * @param permissions - 所需权限列表
 * @returns 权限检查函数
 */
export function withAllPermissions(permissions: Permission[]) {
  return (user: AuthUser | null) => {
    requireAllPermissions(user, permissions);
  };
}
