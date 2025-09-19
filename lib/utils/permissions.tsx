/**
 * 权限控制工具函数
 * 严格遵循全栈项目统一约定规范中的类型安全和命名约定
 */

/**
 * 用户角色枚举
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  SALES: 'sales',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * 权限定义
 */
export const PERMISSIONS = {
  // 产品管理权限
  PRODUCT: {
    CREATE: 'product:create',
    READ: 'product:read',
    UPDATE: 'product:update',
    DELETE: 'product:delete',
  },
  // 销售订单权限
  SALES: {
    CREATE: 'sales:create',
    READ: 'sales:read',
    UPDATE: 'sales:update',
    DELETE: 'sales:delete',
    APPROVE: 'sales:approve',
  },
  // 客户管理权限
  CUSTOMER: {
    CREATE: 'customer:create',
    READ: 'customer:read',
    UPDATE: 'customer:update',
    DELETE: 'customer:delete',
  },
  // 库存管理权限
  INVENTORY: {
    READ: 'inventory:read',
    UPDATE: 'inventory:update',
    ADJUST: 'inventory:adjust',
  },
  // 支付管理权限
  PAYMENT: {
    CREATE: 'payment:create',
    READ: 'payment:read',
    UPDATE: 'payment:update',
    DELETE: 'payment:delete',
  },
  // 系统管理权限
  SYSTEM: {
    SETTINGS: 'system:settings',
    USER_MANAGEMENT: 'system:user_management',
    REPORTS: 'system:reports',
  },
} as const;

/**
 * 角色权限映射
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [USER_ROLES.ADMIN]: [
    // 管理员拥有所有权限
    ...Object.values(PERMISSIONS.PRODUCT),
    ...Object.values(PERMISSIONS.SALES),
    ...Object.values(PERMISSIONS.CUSTOMER),
    ...Object.values(PERMISSIONS.INVENTORY),
    ...Object.values(PERMISSIONS.PAYMENT),
    ...Object.values(PERMISSIONS.SYSTEM),
  ],
  [USER_ROLES.SALES]: [
    // 销售员权限
    PERMISSIONS.PRODUCT.READ,
    PERMISSIONS.SALES.CREATE,
    PERMISSIONS.SALES.READ,
    PERMISSIONS.SALES.UPDATE,
    PERMISSIONS.CUSTOMER.CREATE,
    PERMISSIONS.CUSTOMER.READ,
    PERMISSIONS.CUSTOMER.UPDATE,
    PERMISSIONS.INVENTORY.READ,
    PERMISSIONS.PAYMENT.CREATE,
    PERMISSIONS.PAYMENT.READ,
    PERMISSIONS.PAYMENT.UPDATE,
  ],
};

/**
 * 检查用户是否具有指定角色
 */
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * 检查用户是否具有指定权限
 */
export function hasPermission(userRole: string, permission: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole as UserRole];
  return rolePermissions ? rolePermissions.includes(permission) : false;
}

/**
 * 检查用户是否为管理员
 */
export function isAdmin(userRole: string): boolean {
  return userRole === USER_ROLES.ADMIN;
}

/**
 * 检查用户是否为销售员
 */
export function isSales(userRole: string): boolean {
  return userRole === USER_ROLES.SALES;
}

/**
 * 检查用户是否可以访问指定路径
 */
export function canAccessPath(userRole: string, pathname: string): boolean {
  // 管理员可以访问所有路径
  if (isAdmin(userRole)) {
    return true;
  }

  // 销售员权限检查
  if (isSales(userRole)) {
    // 销售员不能访问的路径
    const restrictedPaths = ['/settings', '/users', '/system'];

    return !restrictedPaths.some(path => pathname.startsWith(path));
  }

  return false;
}

/**
 * 获取用户可访问的导航项
 */
export function getAccessibleNavItems<T extends { requiredRoles?: string[] }>(
  items: T[],
  userRole: string
): T[] {
  return items.filter(item => {
    // 如果没有权限要求，所有用户都可以访问
    if (!item.requiredRoles || item.requiredRoles.length === 0) {
      return true;
    }

    // 检查用户角色是否满足要求
    return hasRole(userRole, item.requiredRoles);
  });
}

/**
 * 权限检查装饰器（用于组件）
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles: string[],
  fallback?: React.ComponentType<P>
) {
  return function PermissionWrapper(props: P & { userRole?: string }) {
    const { userRole, ...componentProps } = props;

    if (!userRole || !hasRole(userRole, requiredRoles)) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent {...(componentProps as P)} />;
      }
      return null;
    }

    return <Component {...(componentProps as P)} />;
  };
}

/**
 * 权限检查Hook
 */
export function usePermissions(userRole?: string) {
  return {
    hasRole: (requiredRoles: string[]) =>
      userRole ? hasRole(userRole, requiredRoles) : false,
    hasPermission: (permission: string) =>
      userRole ? hasPermission(userRole, permission) : false,
    isAdmin: () => (userRole ? isAdmin(userRole) : false),
    isSales: () => (userRole ? isSales(userRole) : false),
    canAccessPath: (pathname: string) =>
      userRole ? canAccessPath(userRole, pathname) : false,
  };
}
