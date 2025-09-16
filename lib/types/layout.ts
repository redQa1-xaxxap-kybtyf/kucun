/**
 * 布局系统类型定义
 * 严格遵循全栈项目统一约定规范中的字段命名约定
 * 前端层使用camelCase命名
 */

import type { LucideIcon } from 'lucide-react';

/**
 * 导航菜单项类型
 */
export interface NavigationItem {
  /** 菜单项唯一标识 */
  id: string;
  /** 菜单项标题 */
  title: string;
  /** 路由路径 */
  href: string;
  /** 图标组件 */
  icon: LucideIcon;
  /** 是否为当前激活项 */
  isActive?: boolean;
  /** 子菜单项 */
  children?: NavigationItem[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 权限要求 */
  requiredRoles?: string[];
  /** 徽章文本（如通知数量） */
  badge?: string | number;
  /** 徽章变体 */
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * 用户信息类型（与Next-Auth.js Session类型对应）
 */
export interface UserInfo {
  /** 用户ID */
  id: string;
  /** 用户邮箱 */
  email: string;
  /** 用户名 */
  username: string;
  /** 显示名称 */
  name: string;
  /** 用户角色 */
  role: string;
  /** 用户状态 */
  status: string;
  /** 头像URL（可选） */
  avatar?: string;
}

/**
 * 布局配置类型
 */
export interface LayoutConfig {
  /** 是否显示侧边栏 */
  showSidebar: boolean;
  /** 是否显示顶部导航栏 */
  showHeader: boolean;
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 是否为移动端模式 */
  isMobile: boolean;
  /** 主题模式 */
  theme: 'light' | 'dark' | 'system';
}

/**
 * 侧边栏状态类型
 */
export interface SidebarState {
  /** 是否展开 */
  isOpen: boolean;
  /** 是否折叠模式 */
  isCollapsed: boolean;
  /** 切换展开/折叠 */
  toggle: () => void;
  /** 设置展开状态 */
  setOpen: (open: boolean) => void;
  /** 设置折叠状态 */
  setCollapsed: (collapsed: boolean) => void;
}

/**
 * 通知项类型
 */
export interface NotificationItem {
  /** 通知ID */
  id: string;
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  message: string;
  /** 通知类型 */
  type: 'info' | 'success' | 'warning' | 'error';
  /** 是否已读 */
  isRead: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 点击操作 */
  onClick?: () => void;
  /** 关联链接 */
  href?: string;
}

/**
 * 快速操作项类型
 */
export interface QuickAction {
  /** 操作ID */
  id: string;
  /** 操作标题 */
  title: string;
  /** 操作描述 */
  description?: string;
  /** 图标 */
  icon: LucideIcon;
  /** 点击处理函数 */
  onClick: () => void;
  /** 快捷键 */
  shortcut?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 面包屑导航项类型
 */
export interface BreadcrumbItem {
  /** 标题 */
  title: string;
  /** 链接地址 */
  href?: string;
  /** 是否为当前页面 */
  isCurrent?: boolean;
}

/**
 * 设备类型
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'large';

/**
 * 布局变体类型
 */
export type LayoutVariant = 'default' | 'compact' | 'minimal';

/**
 * 页面元数据类型
 */
export interface PageMetadata {
  /** 页面标题 */
  title: string;
  /** 页面描述 */
  description?: string;
  /** 关键词 */
  keywords?: string[];
  /** 是否需要认证 */
  requireAuth?: boolean;
  /** 需要的角色权限 */
  requiredRoles?: string[];
}

/**
 * 路由配置类型
 */
export interface RouteConfig {
  /** 路径 */
  path: string;
  /** 页面元数据 */
  metadata: PageMetadata;
  /** 是否在导航中显示 */
  showInNav?: boolean;
  /** 导航图标 */
  icon?: React.ComponentType<{ className?: string }>;
  /** 父路由路径 */
  parentPath?: string;
}

/**
 * 布局配置类型
 */
export interface LayoutConfig {
  /** 是否显示侧边栏 */
  showSidebar: boolean;
  /** 是否显示顶部导航栏 */
  showHeader: boolean;
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 是否为移动端 */
  isMobile: boolean;
  /** 主题模式 */
  theme: 'light' | 'dark' | 'system';
}
