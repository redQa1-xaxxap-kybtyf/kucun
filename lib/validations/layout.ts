/**
 * Zod验证Schema定义
 * 为布局系统提供运行时数据验证
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

/**
 * 导航项Schema
 */
export const NavigationItemSchema = z.object({
  id: z.string().min(1, '导航项ID不能为空'),
  title: z.string().min(1, '导航项标题不能为空'),
  href: z.string().min(1, '导航项链接不能为空'),
  icon: z.function().optional(),
  badge: z.union([z.string(), z.number()]).optional(),
  badgeVariant: z
    .enum(['default', 'secondary', 'destructive', 'outline'])
    .optional(),
  disabled: z.boolean().optional(),
  requiredRoles: z.array(z.string()).optional(),
  requiredPermissions: z.array(z.string()).optional(),
});

/**
 * 用户信息Schema
 */
export const UserInfoSchema = z.object({
  id: z.string().min(1, '用户ID不能为空'),
  name: z.string().min(1, '用户名不能为空'),
  email: z.string().email('邮箱格式不正确'),
  avatar: z.string().url('头像URL格式不正确').optional(),
  role: z.string().min(1, '用户角色不能为空').optional(),
});

/**
 * 通知项Schema
 */
export const NotificationItemSchema = z.object({
  id: z.string().min(1, '通知ID不能为空'),
  title: z.string().min(1, '通知标题不能为空'),
  message: z.string().min(1, '通知内容不能为空'),
  type: z.enum(['info', 'warning', 'error', 'success'], {
    error: '通知类型必须是 info、warning、error 或 success',
  }),
  isRead: z.boolean(),
  createdAt: z.date(),
  onClick: z.function().optional(),
  href: z.string().optional(),
});

/**
 * 侧边栏状态Schema
 */
export const SidebarStateSchema = z.object({
  isOpen: z.boolean(),
  isCollapsed: z.boolean(),
  toggle: z.function(),
  setOpen: z.function(),
  setCollapsed: z.function(),
});

/**
 * 面包屑项Schema
 */
export const BreadcrumbItemSchema = z.object({
  title: z.string().min(1, '面包屑标题不能为空'),
  href: z.string().optional(),
  isCurrent: z.boolean().optional(),
});

/**
 * 页面元数据Schema
 */
export const PageMetadataSchema = z.object({
  title: z.string().min(1, '页面标题不能为空'),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  requireAuth: z.boolean().optional(),
  requiredRoles: z.array(z.string()).optional(),
});

/**
 * 路由配置Schema
 */
export const RouteConfigSchema = z.object({
  path: z
    .string()
    .min(1, '路由路径不能为空')
    .regex(/^\//, '路由路径必须以/开头'),
  metadata: PageMetadataSchema,
  showInNav: z.boolean().optional(),
  icon: z.function().optional(),
  parentPath: z.string().optional(),
});

/**
 * 布局配置Schema
 */
export const LayoutConfigSchema = z.object({
  showSidebar: z.boolean(),
  showHeader: z.boolean(),
  sidebarCollapsed: z.boolean(),
  isMobile: z.boolean(),
  theme: z.enum(['light', 'dark', 'system'], {
    error: '主题必须是 light、dark 或 system',
  }),
});

/**
 * 快速操作项Schema
 */
export const QuickActionSchema = z.object({
  id: z.string().min(1, '操作ID不能为空'),
  title: z.string().min(1, '操作标题不能为空'),
  description: z.string().optional(),
  icon: z.function(),
  onClick: z.function(),
  shortcut: z.string().optional(),
  disabled: z.boolean().optional(),
});

/**
 * 设备类型Schema
 */
export const DeviceTypeSchema = z.enum(
  ['mobile', 'tablet', 'desktop', 'large'],
  {
    error: '设备类型必须是 mobile、tablet、desktop 或 large',
  }
);

/**
 * 布局变体Schema
 */
export const LayoutVariantSchema = z.enum(['default', 'compact', 'minimal'], {
  error: '布局变体必须是 default、compact 或 minimal',
});

/**
 * 导航项数组Schema
 */
export const NavigationItemsSchema = z.array(NavigationItemSchema);

/**
 * 通知项数组Schema
 */
export const NotificationItemsSchema = z.array(NotificationItemSchema);

/**
 * 面包屑项数组Schema
 */
export const BreadcrumbItemsSchema = z.array(BreadcrumbItemSchema);

/**
 * 路由配置数组Schema
 */
export const RouteConfigsSchema = z.array(RouteConfigSchema);

/**
 * 快速操作项数组Schema
 */
export const QuickActionsSchema = z.array(QuickActionSchema);

/**
 * 表单数据验证Schema
 */
export const FormDataSchema = z.object({
  searchQuery: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
  theme: LayoutConfigSchema.shape.theme.optional(),
  sidebarCollapsed: z.boolean().optional(),
});

/**
 * API响应Schema
 */
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * 错误信息Schema
 */
export const ErrorInfoSchema = z.object({
  code: z.string().min(1, '错误代码不能为空'),
  message: z.string().min(1, '错误信息不能为空'),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.date().optional(),
});

/**
 * 验证工具函数
 */
export const validateNavigationItem = (data: unknown) =>
  NavigationItemSchema.safeParse(data);

export const validateUserInfo = (data: unknown) =>
  UserInfoSchema.safeParse(data);

export const validateNotificationItem = (data: unknown) =>
  NotificationItemSchema.safeParse(data);

export const validateSidebarState = (data: unknown) =>
  SidebarStateSchema.safeParse(data);

export const validateBreadcrumbItem = (data: unknown) =>
  BreadcrumbItemSchema.safeParse(data);

export const validatePageMetadata = (data: unknown) =>
  PageMetadataSchema.safeParse(data);

export const validateRouteConfig = (data: unknown) =>
  RouteConfigSchema.safeParse(data);

export const validateLayoutConfig = (data: unknown) =>
  LayoutConfigSchema.safeParse(data);

export const validateFormData = (data: unknown) =>
  FormDataSchema.safeParse(data);

export const validateApiResponse = (data: unknown) =>
  ApiResponseSchema.safeParse(data);

/**
 * 批量验证工具函数
 */
export const validateNavigationItems = (data: unknown) =>
  NavigationItemsSchema.safeParse(data);

export const validateNotificationItems = (data: unknown) =>
  NotificationItemsSchema.safeParse(data);

export const validateBreadcrumbItems = (data: unknown) =>
  BreadcrumbItemsSchema.safeParse(data);

export const validateRouteConfigs = (data: unknown) =>
  RouteConfigsSchema.safeParse(data);

export const validateQuickActions = (data: unknown) =>
  QuickActionsSchema.safeParse(data);

/**
 * 类型推断
 */
export type NavigationItemType = z.infer<typeof NavigationItemSchema>;
export type UserInfoType = z.infer<typeof UserInfoSchema>;
export type NotificationItemType = z.infer<typeof NotificationItemSchema>;
export type SidebarStateType = z.infer<typeof SidebarStateSchema>;
export type BreadcrumbItemType = z.infer<typeof BreadcrumbItemSchema>;
export type PageMetadataType = z.infer<typeof PageMetadataSchema>;
export type RouteConfigType = z.infer<typeof RouteConfigSchema>;
export type LayoutConfigType = z.infer<typeof LayoutConfigSchema>;
export type QuickActionType = z.infer<typeof QuickActionSchema>;
export type DeviceTypeType = z.infer<typeof DeviceTypeSchema>;
export type LayoutVariantType = z.infer<typeof LayoutVariantSchema>;
export type FormDataType = z.infer<typeof FormDataSchema>;
export type ApiResponseType = z.infer<typeof ApiResponseSchema>;
export type ErrorInfoType = z.infer<typeof ErrorInfoSchema>;

/**
 * 数组类型推断
 */
export type NavigationItemsType = z.infer<typeof NavigationItemsSchema>;
export type NotificationItemsType = z.infer<typeof NotificationItemsSchema>;
export type BreadcrumbItemsType = z.infer<typeof BreadcrumbItemsSchema>;
export type RouteConfigsType = z.infer<typeof RouteConfigsSchema>;
export type QuickActionsType = z.infer<typeof QuickActionsSchema>;
