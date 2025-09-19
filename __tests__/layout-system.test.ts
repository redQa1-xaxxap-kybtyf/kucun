/**
 * 布局系统测试
 * 全面测试新布局系统的功能和性能
 * 严格遵循全栈项目统一约定规范
 */

import {
  NavigationItemSchema,
  validateNavigationItem,
  validateUserInfo,
} from '@/lib/schemas/layout';
import type {
  LayoutConfig,
  NavigationItem,
  NotificationItem,
  UserInfo,
} from '@/lib/types/layout';
import {
  canAccessPath,
  getAccessibleNavItems,
  hasPermission,
  hasRole,
} from '@/lib/utils/permissions';
import {
  isLayoutConfig,
  isNavigationItem,
  isNotificationItem,
  isUserInfo,
  TypeAssert,
  TypeSafeConverter,
} from '@/lib/utils/type-guards';
import { describe, expect, it, jest } from '@jest/globals';
import { Home } from 'lucide-react';

describe('布局系统类型守卫测试', () => {
  describe('isNavigationItem', () => {
    it('应该验证有效的导航项', () => {
      const validNavItem: NavigationItem = {
        id: 'test',
        title: '测试',
        href: '/test',
        icon: jest.fn() as any,
        badge: '5',
        disabled: false,
        requiredRoles: ['admin'],
      };

      expect(isNavigationItem(validNavItem)).toBe(true);
    });

    it('应该拒绝无效的导航项', () => {
      const invalidNavItem = {
        id: '',
        title: 123,
        href: null,
      };

      expect(isNavigationItem(invalidNavItem)).toBe(false);
    });

    it('应该拒绝null和undefined', () => {
      expect(isNavigationItem(null)).toBe(false);
      expect(isNavigationItem(undefined)).toBe(false);
    });
  });

  describe('isUserInfo', () => {
    it('应该验证有效的用户信息', () => {
      const validUser: UserInfo = {
        id: '123',
        name: '张三',
        email: 'zhangsan@example.com',
        username: 'zhangsan',
        avatar: 'https://example.com/avatar.jpg',
        role: 'admin',
        status: 'active',
      };

      expect(isUserInfo(validUser)).toBe(true);
    });

    it('应该拒绝无效的邮箱格式', () => {
      const invalidUser = {
        id: '123',
        name: '张三',
        email: 'invalid-email',
      };

      expect(isUserInfo(invalidUser)).toBe(false);
    });
  });

  describe('isNotificationItem', () => {
    it('应该验证有效的通知项', () => {
      const validNotification: NotificationItem = {
        id: '1',
        title: '测试通知',
        message: '这是一条测试通知',
        type: 'info',
        isRead: false,
        createdAt: new Date(),
        href: '/test',
      };

      expect(isNotificationItem(validNotification)).toBe(true);
    });

    it('应该拒绝无效的通知类型', () => {
      const invalidNotification = {
        id: '1',
        title: '测试通知',
        message: '这是一条测试通知',
        type: 'invalid-type',
        isRead: false,
        createdAt: new Date(),
      };

      expect(isNotificationItem(invalidNotification)).toBe(false);
    });
  });

  describe('isLayoutConfig', () => {
    it('应该验证有效的布局配置', () => {
      const validConfig: LayoutConfig = {
        showSidebar: true,
        showHeader: true,
        sidebarCollapsed: false,
        isMobile: false,
        theme: 'light',
      };

      expect(isLayoutConfig(validConfig)).toBe(true);
    });

    it('应该拒绝无效的主题值', () => {
      const invalidConfig = {
        showSidebar: true,
        showHeader: true,
        sidebarCollapsed: false,
        isMobile: false,
        theme: 'invalid-theme',
      };

      expect(isLayoutConfig(invalidConfig)).toBe(false);
    });
  });
});

describe('Zod验证Schema测试', () => {
  describe('NavigationItemSchema', () => {
    it('应该验证有效的导航项', () => {
      const validData = {
        id: 'test',
        title: '测试',
        href: '/test',
      };

      const result = validateNavigationItem(validData);
      expect(result.success).toBe(true);
    });

    it('应该返回验证错误', () => {
      const invalidData = {
        id: '',
        title: '',
        href: '',
      };

      const result = validateNavigationItem(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('UserInfoSchema', () => {
    it('应该验证有效的用户信息', () => {
      const validData = {
        id: '123',
        name: '张三',
        email: 'zhangsan@example.com',
      };

      const result = validateUserInfo(validData);
      expect(result.success).toBe(true);
    });

    it('应该拒绝无效的邮箱', () => {
      const invalidData = {
        id: '123',
        name: '张三',
        email: 'invalid-email',
      };

      const result = validateUserInfo(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('权限系统测试', () => {
  describe('hasRole', () => {
    it('应该正确检查用户角色', () => {
      expect(hasRole('admin', ['admin', 'user'])).toBe(true);
      expect(hasRole('user', ['admin'])).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('应该正确检查用户权限', () => {
      expect(hasPermission('admin', 'product.create')).toBe(true);
      expect(hasPermission('sales', 'system.admin')).toBe(false);
    });
  });

  describe('canAccessPath', () => {
    it('管理员应该可以访问所有路径', () => {
      expect(canAccessPath('admin', '/settings')).toBe(true);
      expect(canAccessPath('admin', '/users')).toBe(true);
    });

    it('销售员不应该访问受限路径', () => {
      expect(canAccessPath('sales', '/settings')).toBe(false);
      expect(canAccessPath('sales', '/dashboard')).toBe(true);
    });
  });

  describe('getAccessibleNavItems', () => {
    it('应该根据角色过滤导航项', () => {
      const navItems = [
        { id: '1', title: '仪表盘', href: '/dashboard', requiredRoles: [] },
        { id: '2', title: '设置', href: '/settings', requiredRoles: ['admin'] },
      ];

      const adminItems = getAccessibleNavItems(navItems, 'admin');
      const salesItems = getAccessibleNavItems(navItems, 'sales');

      expect(adminItems).toHaveLength(2);
      expect(salesItems).toHaveLength(1);
    });
  });
});

describe('TypeSafeConverter测试', () => {
  describe('toNavigationItem', () => {
    it('应该安全转换有效数据', () => {
      const data = {
        id: 'test',
        title: '测试',
        href: '/test',
      };

      const result = TypeSafeConverter.toNavigationItem(data);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test');
    });

    it('应该返回null对于无效数据', () => {
      const data = {
        invalid: 'data',
      };

      const result = TypeSafeConverter.toNavigationItem(data);
      expect(result).toBeNull();
    });

    it('应该使用fallback值', () => {
      const data = {
        id: 'test',
      };

      const fallback = {
        title: '默认标题',
        href: '/default',
      };

      const result = TypeSafeConverter.toNavigationItem(data, fallback);
      expect(result).not.toBeNull();
      expect(result?.title).toBe('默认标题');
    });
  });
});

describe('TypeAssert测试', () => {
  describe('navigationItem', () => {
    it('应该通过有效数据的断言', () => {
      const validData: NavigationItem = {
        id: 'test',
        title: '测试',
        href: '/test',
        icon: Home,
      };

      expect(() => {
        TypeAssert.navigationItem(validData);
      }).not.toThrow();
    });

    it('应该抛出错误对于无效数据', () => {
      const invalidData = {
        invalid: 'data',
      };

      expect(() => {
        TypeAssert.navigationItem(invalidData);
      }).toThrow(TypeError);
    });

    it('应该使用自定义错误消息', () => {
      const invalidData = {
        invalid: 'data',
      };

      expect(() => {
        TypeAssert.navigationItem(invalidData, '自定义错误消息');
      }).toThrow('自定义错误消息');
    });
  });
});

describe('性能测试', () => {
  it('类型守卫应该有良好的性能', () => {
    const validNavItem: NavigationItem = {
      id: 'test',
      title: '测试',
      href: '/test',
      icon: Home,
    };

    const startTime = performance.now();

    // 执行1000次类型检查
    for (let i = 0; i < 1000; i++) {
      isNavigationItem(validNavItem);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 1000次检查应该在10ms内完成
    expect(duration).toBeLessThan(10);
  });

  it('Zod验证应该有合理的性能', () => {
    const validData = {
      id: 'test',
      title: '测试',
      href: '/test',
    };

    const startTime = performance.now();

    // 执行100次Zod验证
    for (let i = 0; i < 100; i++) {
      NavigationItemSchema.safeParse(validData);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 100次验证应该在50ms内完成
    expect(duration).toBeLessThan(50);
  });
});
