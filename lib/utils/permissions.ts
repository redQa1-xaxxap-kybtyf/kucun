/**
 * 权限管理工具函数
 * 提供基于角色的权限检查功能
 */

import type { UserRole } from '@/lib/types/user';

/**
 * 权限检查类
 */
export class Permissions {
  private role: UserRole | undefined;

  constructor(role: UserRole | undefined) {
    this.role = role;
  }

  /**
   * 检查是否为管理员
   */
  isAdmin(): boolean {
    return this.role === 'admin';
  }

  /**
   * 检查是否为销售员
   */
  isSales(): boolean {
    return this.role === 'sales';
  }

  /**
   * 检查是否有特定权限
   */
  hasPermission(permission: string): boolean {
    if (!this.role) {return false;}

    const rolePermissions = ROLE_PERMISSIONS[this.role] || [];
    return rolePermissions.includes(permission);
  }

  /**
   * 检查是否有任一权限
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * 检查是否有所有权限
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * 获取用户角色
   */
  getRole(): UserRole | undefined {
    return this.role;
  }
}

/**
 * 角色权限映射
 */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    // 系统管理
    'system:settings:read',
    'system:settings:write',
    'system:settings:interface',
    'system:settings:notifications',
    'system:users:read',
    'system:users:write',
    'system:users:delete',

    // 产品管理
    'products:read',
    'products:write',
    'products:delete',
    'products:import',
    'products:export',

    // 库存管理
    'inventory:read',
    'inventory:write',
    'inventory:adjust',

    // 销售管理
    'sales:read',
    'sales:write',
    'sales:delete',
    'sales:approve',

    // 客户管理
    'customers:read',
    'customers:write',
    'customers:delete',

    // 财务管理
    'finance:read',
    'finance:write',
    'finance:approve',
    'finance:reports',

    // 报表查看
    'reports:read',
    'reports:export',
  ],
  sales: [
    // 界面和通知设置
    'system:settings:interface',
    'system:settings:notifications',

    // 产品管理（只读）
    'products:read',

    // 库存管理（只读）
    'inventory:read',

    // 销售管理
    'sales:read',
    'sales:write',

    // 客户管理
    'customers:read',
    'customers:write',

    // 财务管理（只读）
    'finance:read',

    // 报表查看（限制）
    'reports:read',
  ],
};

/**
 * 权限常量
 */
export const PERMISSIONS = {
  // 系统管理
  SYSTEM_SETTINGS_READ: 'system:settings:read',
  SYSTEM_SETTINGS_WRITE: 'system:settings:write',
  SYSTEM_SETTINGS_INTERFACE: 'system:settings:interface',
  SYSTEM_SETTINGS_NOTIFICATIONS: 'system:settings:notifications',
  SYSTEM_USERS_READ: 'system:users:read',
  SYSTEM_USERS_WRITE: 'system:users:write',
  SYSTEM_USERS_DELETE: 'system:users:delete',

  // 产品管理
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_IMPORT: 'products:import',
  PRODUCTS_EXPORT: 'products:export',

  // 库存管理
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  INVENTORY_ADJUST: 'inventory:adjust',

  // 销售管理
  SALES_READ: 'sales:read',
  SALES_WRITE: 'sales:write',
  SALES_DELETE: 'sales:delete',
  SALES_APPROVE: 'sales:approve',

  // 客户管理
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  CUSTOMERS_DELETE: 'customers:delete',

  // 财务管理
  FINANCE_READ: 'finance:read',
  FINANCE_WRITE: 'finance:write',
  FINANCE_APPROVE: 'finance:approve',
  FINANCE_REPORTS: 'finance:reports',

  // 报表查看
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
} as const;

/**
 * 创建权限检查实例的Hook
 */
export function usePermissions(role: UserRole | undefined): Permissions {
  return new Permissions(role);
}

/**
 * 检查用户是否有访问路由的权限
 */
export function canAccessRoute(
  role: UserRole | undefined,
  route: string
): boolean {
  const permissions = new Permissions(role);

  // 路由权限映射
  const routePermissions: Record<string, string[]> = {
    '/settings': [PERMISSIONS.SYSTEM_SETTINGS_READ],
    '/users': [PERMISSIONS.SYSTEM_USERS_READ],
    '/products': [PERMISSIONS.PRODUCTS_READ],
    '/inventory': [PERMISSIONS.INVENTORY_READ],
    '/sales': [PERMISSIONS.SALES_READ],
    '/customers': [PERMISSIONS.CUSTOMERS_READ],
    '/finance': [PERMISSIONS.FINANCE_READ],
    '/reports': [PERMISSIONS.REPORTS_READ],
  };

  const requiredPermissions = routePermissions[route];
  if (!requiredPermissions) {
    // 如果路由没有定义权限要求，默认允许访问
    return true;
  }

  return permissions.hasAnyPermission(requiredPermissions);
}

/**
 * 获取用户可访问的菜单项
 */
export function getAccessibleMenuItems(role: UserRole | undefined) {
  const permissions = new Permissions(role);

  const allMenuItems = [
    {
      id: 'dashboard',
      title: '仪表盘',
      href: '/',
      icon: 'LayoutDashboard',
      requiredPermissions: [],
    },
    {
      id: 'products',
      title: '产品管理',
      href: '/products',
      icon: 'Package',
      requiredPermissions: [PERMISSIONS.PRODUCTS_READ],
    },
    {
      id: 'inventory',
      title: '库存管理',
      href: '/inventory',
      icon: 'Warehouse',
      requiredPermissions: [PERMISSIONS.INVENTORY_READ],
    },
    {
      id: 'sales',
      title: '销售管理',
      href: '/sales',
      icon: 'ShoppingCart',
      requiredPermissions: [PERMISSIONS.SALES_READ],
    },
    {
      id: 'customers',
      title: '客户管理',
      href: '/customers',
      icon: 'Users',
      requiredPermissions: [PERMISSIONS.CUSTOMERS_READ],
    },
    {
      id: 'finance',
      title: '财务管理',
      href: '/finance',
      icon: 'DollarSign',
      requiredPermissions: [PERMISSIONS.FINANCE_READ],
    },
    {
      id: 'reports',
      title: '报表分析',
      href: '/reports',
      icon: 'BarChart3',
      requiredPermissions: [PERMISSIONS.REPORTS_READ],
    },
    {
      id: 'settings',
      title: '系统设置',
      href: '/settings',
      icon: 'Settings',
      requiredPermissions: [PERMISSIONS.SYSTEM_SETTINGS_READ],
    },
  ];

  return allMenuItems.filter(item => {
    if (item.requiredPermissions.length === 0) {
      return true; // 无权限要求的菜单项对所有用户可见
    }
    return permissions.hasAnyPermission(item.requiredPermissions);
  });
}

/**
 * 获取用户可访问的导航项（兼容现有代码）
 */
export function getAccessibleNavItems(
  navItems: Array<{ requiredRoles?: UserRole[] }>,
  role: UserRole | undefined
): Array<{ requiredRoles?: UserRole[] }> {
  return navItems.filter(item => {
    // 如果没有角色要求，所有用户都可以访问
    if (!item.requiredRoles || item.requiredRoles.length === 0) {
      return true;
    }

    // 检查用户角色是否在允许的角色列表中
    const userRole = role || ('user' as any);
    return item.requiredRoles.includes(userRole);
  });
}

/**
 * 检查用户是否可以访问指定路径（兼容测试文件）
 */
export function canAccessPath(
  role: UserRole | undefined,
  path: string
): boolean {
  return canAccessRoute(role, path);
}

/**
 * 检查用户是否有指定权限（兼容测试文件）
 */
export function hasPermission(
  role: UserRole | undefined,
  permission: string
): boolean {
  const permissions = new Permissions(role);
  return permissions.hasPermission(permission);
}

/**
 * 检查用户是否有指定角色（兼容测试文件）
 */
export function hasRole(
  userRole: UserRole | undefined,
  requiredRole: UserRole
): boolean {
  return userRole === requiredRole;
}
