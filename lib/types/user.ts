/**
 * 用户相关类型定义
 * 严格遵循全栈项目统一约定规范
 */

// 用户角色枚举
export type UserRole = 'admin' | 'sales';

// 用户状态枚举
export type UserStatus = 'active' | 'inactive' | 'pending';

// 基础用户信息
export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// 用户创建输入
export interface UserCreateInput {
  email: string;
  username: string;
  name: string;
  password: string;
  role?: UserRole;
  status?: UserStatus;
}

// 用户更新输入
export interface UserUpdateInput {
  id: string;
  email?: string;
  username?: string;
  name?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  avatar?: string;
}

// 用户查询参数
export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy?: 'name' | 'email' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// 用户信息（用于布局系统）
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
}

// 用户角色标签
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  sales: '销售员',
};

// 用户状态标签
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: '活跃',
  inactive: '停用',
  pending: '待激活',
};

// 用户角色变体（用于Badge组件）
export const USER_ROLE_VARIANTS: Record<UserRole, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  admin: 'destructive',
  sales: 'default',
};

// 用户状态变体（用于Badge组件）
export const USER_STATUS_VARIANTS: Record<UserStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inactive: 'secondary',
  pending: 'outline',
};

// 用户权限检查函数
export function hasPermission(user: User, permission: string): boolean {
  // 管理员拥有所有权限
  if (user.role === 'admin') {
    return true;
  }

  // 销售员权限检查
  if (user.role === 'sales') {
    const salesPermissions = [
      'customers:read',
      'customers:create',
      'customers:update',
      'products:read',
      'sales-orders:read',
      'sales-orders:create',
      'sales-orders:update',
      'inventory:read',
      'payments:read',
    ];
    return salesPermissions.includes(permission);
  }

  return false;
}

// 检查用户是否可以访问特定页面
export function canAccessPage(user: User, page: string): boolean {
  const pagePermissions: Record<string, string[]> = {
    '/dashboard': ['admin', 'sales'],
    '/products': ['admin', 'sales'],
    '/customers': ['admin', 'sales'],
    '/sales-orders': ['admin', 'sales'],
    '/inventory': ['admin', 'sales'],
    '/payments': ['admin', 'sales'],
    '/return-orders': ['admin'],
    '/users': ['admin'],
    '/settings': ['admin'],
  };

  const allowedRoles = pagePermissions[page] || [];
  return allowedRoles.includes(user.role);
}
