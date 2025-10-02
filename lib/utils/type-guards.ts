/**
 * TypeScript类型守卫工具
 * 提供运行时类型检查和验证功能
 * 严格遵循全栈项目统一约定规范
 */

import type {
  NavigationItem,
  UserInfo,
  NotificationItem,
  SidebarState,
  BreadcrumbItem,
  PageMetadata,
  RouteConfig,
  LayoutConfig,
} from '@/lib/types/layout';

/**
 * 检查是否为有效的导航项
 */
export function isNavigationItem(item: unknown): item is NavigationItem {
  if (!item || typeof item !== 'object') {return false;}

  const nav = item as Record<string, unknown>;

  return (
    typeof nav.id === 'string' &&
    typeof nav.title === 'string' &&
    typeof nav.href === 'string' &&
    (nav.icon === undefined || typeof nav.icon === 'function') &&
    (nav.badge === undefined ||
      typeof nav.badge === 'string' ||
      typeof nav.badge === 'number') &&
    (nav.disabled === undefined || typeof nav.disabled === 'boolean') &&
    (nav.requiredRoles === undefined || Array.isArray(nav.requiredRoles))
  );
}

/**
 * 检查是否为有效的用户信息
 */
export function isUserInfo(user: unknown): user is UserInfo {
  if (!user || typeof user !== 'object') {return false;}

  const userObj = user as Record<string, unknown>;

  return (
    typeof userObj.id === 'string' &&
    typeof userObj.name === 'string' &&
    typeof userObj.email === 'string' &&
    (userObj.avatar === undefined || typeof userObj.avatar === 'string') &&
    (userObj.role === undefined || typeof userObj.role === 'string')
  );
}

/**
 * 检查是否为有效的通知项
 */
export function isNotificationItem(item: unknown): item is NotificationItem {
  if (!item || typeof item !== 'object') {return false;}

  const notification = item as Record<string, unknown>;

  return (
    typeof notification.id === 'string' &&
    typeof notification.title === 'string' &&
    typeof notification.message === 'string' &&
    ['info', 'warning', 'error', 'success'].includes(
      notification.type as string
    ) &&
    typeof notification.isRead === 'boolean' &&
    notification.createdAt instanceof Date &&
    (notification.href === undefined || typeof notification.href === 'string')
  );
}

/**
 * 检查是否为有效的侧边栏状态
 */
export function isSidebarState(state: unknown): state is SidebarState {
  if (!state || typeof state !== 'object') {return false;}

  const sidebar = state as Record<string, unknown>;

  return (
    typeof sidebar.isOpen === 'boolean' &&
    typeof sidebar.isCollapsed === 'boolean' &&
    typeof sidebar.toggle === 'function' &&
    typeof sidebar.setOpen === 'function' &&
    typeof sidebar.setCollapsed === 'function'
  );
}

/**
 * 检查是否为有效的面包屑项
 */
export function isBreadcrumbItem(item: unknown): item is BreadcrumbItem {
  if (!item || typeof item !== 'object') {return false;}

  const breadcrumb = item as Record<string, unknown>;

  return (
    typeof breadcrumb.title === 'string' &&
    (breadcrumb.href === undefined || typeof breadcrumb.href === 'string') &&
    (breadcrumb.isCurrent === undefined ||
      typeof breadcrumb.isCurrent === 'boolean')
  );
}

/**
 * 检查是否为有效的页面元数据
 */
export function isPageMetadata(metadata: unknown): metadata is PageMetadata {
  if (!metadata || typeof metadata !== 'object') {return false;}

  const meta = metadata as Record<string, unknown>;

  return (
    typeof meta.title === 'string' &&
    (meta.description === undefined || typeof meta.description === 'string') &&
    (meta.keywords === undefined || Array.isArray(meta.keywords)) &&
    (meta.requireAuth === undefined || typeof meta.requireAuth === 'boolean') &&
    (meta.requiredRoles === undefined || Array.isArray(meta.requiredRoles))
  );
}

/**
 * 检查是否为有效的路由配置
 */
export function isRouteConfig(config: unknown): config is RouteConfig {
  if (!config || typeof config !== 'object') {return false;}

  const route = config as Record<string, unknown>;

  return (
    typeof route.path === 'string' &&
    isPageMetadata(route.metadata) &&
    (route.showInNav === undefined || typeof route.showInNav === 'boolean') &&
    (route.icon === undefined || typeof route.icon === 'function') &&
    (route.parentPath === undefined || typeof route.parentPath === 'string')
  );
}

/**
 * 检查是否为有效的布局配置
 */
export function isLayoutConfig(config: unknown): config is LayoutConfig {
  if (!config || typeof config !== 'object') {return false;}

  const layout = config as Record<string, unknown>;

  return (
    typeof layout.showSidebar === 'boolean' &&
    typeof layout.showHeader === 'boolean' &&
    typeof layout.sidebarCollapsed === 'boolean' &&
    typeof layout.isMobile === 'boolean' &&
    ['light', 'dark', 'system'].includes(layout.theme as string)
  );
}

/**
 * 验证导航项数组
 */
export function validateNavigationItems(items: unknown[]): NavigationItem[] {
  return items.filter(isNavigationItem);
}

/**
 * 验证通知项数组
 */
export function validateNotificationItems(
  items: unknown[]
): NotificationItem[] {
  return items.filter(isNotificationItem);
}

/**
 * 验证面包屑项数组
 */
export function validateBreadcrumbItems(items: unknown[]): BreadcrumbItem[] {
  return items.filter(isBreadcrumbItem);
}

/**
 * 安全的类型转换工具
 */
export class TypeSafeConverter {
  /**
   * 安全转换为导航项
   */
  static toNavigationItem(
    item: unknown,
    fallback?: Partial<NavigationItem>
  ): NavigationItem | null {
    if (isNavigationItem(item)) {
      return item;
    }

    if (fallback && typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const converted = {
        id: typeof obj.id === 'string' ? obj.id : fallback.id || '',
        title: typeof obj.title === 'string' ? obj.title : fallback.title || '',
        href: typeof obj.href === 'string' ? obj.href : fallback.href || '',
        icon: typeof obj.icon === 'function' ? obj.icon : fallback.icon,
        badge:
          typeof obj.badge === 'string' || typeof obj.badge === 'number'
            ? obj.badge
            : fallback.badge,
        disabled:
          typeof obj.disabled === 'boolean' ? obj.disabled : fallback.disabled,
        requiredRoles: Array.isArray(obj.requiredRoles)
          ? obj.requiredRoles
          : fallback.requiredRoles,
      };

      if (isNavigationItem(converted)) {
        return converted;
      }
    }

    return null;
  }

  /**
   * 安全转换为用户信息
   */
  static toUserInfo(user: unknown): UserInfo | null {
    if (isUserInfo(user)) {
      return user;
    }
    return null;
  }

  /**
   * 安全转换为通知项
   */
  static toNotificationItem(item: unknown): NotificationItem | null {
    if (isNotificationItem(item)) {
      return item;
    }
    return null;
  }

  /**
   * 安全转换为布局配置
   */
  static toLayoutConfig(config: unknown, fallback: LayoutConfig): LayoutConfig {
    if (isLayoutConfig(config)) {
      return config;
    }
    return fallback;
  }
}

/**
 * 运行时类型断言工具
 */
export class TypeAssert {
  /**
   * 断言为导航项
   */
  static navigationItem(
    item: unknown,
    message?: string
  ): asserts item is NavigationItem {
    if (!isNavigationItem(item)) {
      throw new TypeError(message || 'Expected NavigationItem');
    }
  }

  /**
   * 断言为用户信息
   */
  static userInfo(user: unknown, message?: string): asserts user is UserInfo {
    if (!isUserInfo(user)) {
      throw new TypeError(message || 'Expected UserInfo');
    }
  }

  /**
   * 断言为通知项
   */
  static notificationItem(
    item: unknown,
    message?: string
  ): asserts item is NotificationItem {
    if (!isNotificationItem(item)) {
      throw new TypeError(message || 'Expected NotificationItem');
    }
  }

  /**
   * 断言为侧边栏状态
   */
  static sidebarState(
    state: unknown,
    message?: string
  ): asserts state is SidebarState {
    if (!isSidebarState(state)) {
      throw new TypeError(message || 'Expected SidebarState');
    }
  }

  /**
   * 断言为布局配置
   */
  static layoutConfig(
    config: unknown,
    message?: string
  ): asserts config is LayoutConfig {
    if (!isLayoutConfig(config)) {
      throw new TypeError(message || 'Expected LayoutConfig');
    }
  }
}

/**
 * 类型验证装饰器
 */
export function validateTypes<T extends (...args: any[]) => any>(
  fn: T,
  validators: Array<(arg: any) => boolean>
): T {
  return ((...args: Parameters<T>) => {
    args.forEach((arg, index) => {
      const validator = validators[index];
      if (validator && !validator(arg)) {
        throw new TypeError(`Invalid argument at position ${index}`);
      }
    });
    return fn(...args);
  }) as T;
}
