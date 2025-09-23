// 仪表盘模块验证规则文件
// 类型即文档原则：完整的Zod验证规则定义

import { z } from 'zod';

import {
  DASHBOARD_DEFAULTS,
  ALERT_LEVELS,
  TODO_PRIORITIES,
  WIDGET_TYPES,
} from '@/lib/config/dashboard';

// ==================== 基础验证规则 ====================

// 时间范围验证
export const timeRangeSchema = z.enum(['1d', '7d', '30d', '90d', '1y']).default(DASHBOARD_DEFAULTS.TIME_RANGE);

// 颜色验证
export const colorSchema = z.enum(['blue', 'green', 'yellow', 'red', 'purple', 'gray', 'orange', 'indigo']);

// 布局验证
export const layoutSchema = z.enum(['grid', 'list']).default(DASHBOARD_DEFAULTS.LAYOUT);

// 主题验证
export const themeSchema = z.enum(['light', 'dark']).default(DASHBOARD_DEFAULTS.THEME);

// 小部件尺寸验证
export const widgetSizeSchema = z.enum(['sm', 'md', 'lg', 'xl']).default(DASHBOARD_DEFAULTS.WIDGET_SIZE);

// 预警级别验证
export const alertLevelSchema = z.enum(['warning', 'danger', 'critical']);

// 预警类型验证
export const alertTypeSchema = z.enum(['low_stock', 'out_of_stock', 'overstock', 'expired']);

// 待办事项优先级验证
export const todoPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']).default('medium');

// 待办事项状态验证
export const todoStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending');

// 待办事项类型验证
export const todoTypeSchema = z.enum(['sales_order', 'return_order', 'inventory_alert', 'customer_follow_up', 'custom']);

// 小部件类型验证
export const widgetTypeSchema = z.enum(['stat', 'chart', 'list', 'alert', 'todo', 'quick_action']);

// ==================== 查询参数验证 ====================

// 仪表盘查询参数验证
export const dashboardQuerySchema = z.object({
  timeRange: timeRangeSchema,
  productCategory: z.string().optional(),
  customerType: z.string().optional(),
  salesChannel: z.string().optional(),
  region: z.string().optional(),
});

// 业务概览查询参数验证
export const businessOverviewQuerySchema = z.object({
  timeRange: timeRangeSchema,
});

// 销售趋势查询参数验证
export const salesTrendQuerySchema = z.object({
  timeRange: timeRangeSchema,
  productCategory: z.string().optional(),
  customerType: z.string().optional(),
});

// 库存趋势查询参数验证
export const inventoryTrendQuerySchema = z.object({
  timeRange: timeRangeSchema,
  productCategory: z.string().optional(),
  warehouseId: z.string().optional(),
});

// 产品排行查询参数验证
export const productRankingQuerySchema = z.object({
  timeRange: timeRangeSchema,
  limit: z.number().min(1).max(50).default(DASHBOARD_DEFAULTS.MAX_RANKING_ITEMS),
  sortBy: z.enum(['sales_quantity', 'sales_value']).default('sales_value'),
});

// 客户排行查询参数验证
export const customerRankingQuerySchema = z.object({
  timeRange: timeRangeSchema,
  limit: z.number().min(1).max(50).default(DASHBOARD_DEFAULTS.MAX_RANKING_ITEMS),
  sortBy: z.enum(['sales_value', 'order_count']).default('sales_value'),
});

// ==================== 配置验证规则 ====================

// 仪表盘配置验证
export const dashboardConfigSchema = z.object({
  refreshInterval: z.number().min(5000).max(300000).default(30000),
  showAlerts: z.boolean().default(DASHBOARD_DEFAULTS.SHOW_ALERTS),
  showTodos: z.boolean().default(DASHBOARD_DEFAULTS.SHOW_TODOS),
  showCharts: z.boolean().default(DASHBOARD_DEFAULTS.SHOW_CHARTS),
  showQuickActions: z.boolean().default(DASHBOARD_DEFAULTS.SHOW_QUICK_ACTIONS),
  layout: layoutSchema,
  theme: themeSchema,
  timeRange: timeRangeSchema,
  customSettings: z.record(z.any()).optional(),
});

// 仪表盘配置更新验证
export const dashboardConfigUpdateSchema = dashboardConfigSchema.partial();

// ==================== 小部件验证规则 ====================

// 小部件位置验证
export const widgetPositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().min(1).max(12),
  h: z.number().min(1).max(12),
});

// 小部件配置验证
export const widgetConfigSchema = z.record(z.any());

// 小部件创建验证
export const dashboardWidgetCreateSchema = z.object({
  type: widgetTypeSchema,
  title: z.string().min(1).max(100),
  size: widgetSizeSchema,
  position: widgetPositionSchema,
  config: widgetConfigSchema.optional(),
  visible: z.boolean().default(true),
  refreshable: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

// 小部件更新验证
export const dashboardWidgetUpdateSchema = dashboardWidgetCreateSchema.partial().extend({
  id: z.string().uuid(),
});

// 小部件批量更新验证
export const dashboardWidgetBatchUpdateSchema = z.object({
  widgets: z.array(dashboardWidgetUpdateSchema),
});

// ==================== 待办事项验证规则 ====================

// 待办事项创建验证
export const todoItemCreateSchema = z.object({
  type: todoTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: todoPrioritySchema,
  dueDate: z.string().datetime().optional(),
  relatedId: z.string().optional(),
  relatedType: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

// 待办事项更新验证
export const todoItemUpdateSchema = todoItemCreateSchema.partial().extend({
  id: z.string().uuid(),
  status: todoStatusSchema.optional(),
  completedAt: z.string().datetime().optional(),
});

// 待办事项查询验证
export const todoItemQuerySchema = z.object({
  status: todoStatusSchema.optional(),
  priority: todoPrioritySchema.optional(),
  type: todoTypeSchema.optional(),
  assignedTo: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(DASHBOARD_DEFAULTS.MAX_TODOS),
  offset: z.number().min(0).default(0),
});

// ==================== 库存预警验证规则 ====================

// 库存预警创建验证
export const inventoryAlertCreateSchema = z.object({
  productId: z.string().uuid(),
  colorCode: z.string().optional(),
  alertType: alertTypeSchema,
  alertLevel: alertLevelSchema,
  currentStock: z.number().min(0),
  safetyStock: z.number().min(0),
  suggestedAction: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

// 库存预警更新验证
export const inventoryAlertUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['active', 'acknowledged', 'resolved', 'dismissed']).optional(),
  notes: z.string().max(1000).optional(),
});

// 库存预警查询验证
export const inventoryAlertQuerySchema = z.object({
  alertType: alertTypeSchema.optional(),
  alertLevel: alertLevelSchema.optional(),
  status: z.enum(['active', 'acknowledged', 'resolved', 'dismissed']).optional(),
  productId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(DASHBOARD_DEFAULTS.MAX_ALERTS),
  offset: z.number().min(0).default(0),
});

// ==================== 快速操作验证规则 ====================

// 快速操作验证
export const quickActionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  icon: z.string(),
  href: z.string().url(),
  color: colorSchema,
  requiresPermission: z.string().optional(),
  badge: z.object({
    text: z.string().min(1).max(20),
    variant: z.enum(['default', 'secondary', 'destructive', 'outline']),
  }).optional(),
});

// ==================== API响应验证规则 ====================

// 统一API响应验证
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  });

// 分页响应验证
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.object({
      items: z.array(itemSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
    error: z.string().optional(),
  });

// ==================== 类型推断导出 ====================

// 查询参数类型
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type BusinessOverviewQuery = z.infer<typeof businessOverviewQuerySchema>;
export type SalesTrendQuery = z.infer<typeof salesTrendQuerySchema>;
export type InventoryTrendQuery = z.infer<typeof inventoryTrendQuerySchema>;
export type ProductRankingQuery = z.infer<typeof productRankingQuerySchema>;
export type CustomerRankingQuery = z.infer<typeof customerRankingQuerySchema>;

// 配置类型
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;
export type DashboardConfigUpdate = z.infer<typeof dashboardConfigUpdateSchema>;

// 小部件类型
export type WidgetPosition = z.infer<typeof widgetPositionSchema>;
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type DashboardWidgetCreate = z.infer<typeof dashboardWidgetCreateSchema>;
export type DashboardWidgetUpdate = z.infer<typeof dashboardWidgetUpdateSchema>;
export type DashboardWidgetBatchUpdate = z.infer<typeof dashboardWidgetBatchUpdateSchema>;

// 待办事项类型
export type TodoItemCreate = z.infer<typeof todoItemCreateSchema>;
export type TodoItemUpdate = z.infer<typeof todoItemUpdateSchema>;
export type TodoItemQuery = z.infer<typeof todoItemQuerySchema>;

// 库存预警类型
export type InventoryAlertCreate = z.infer<typeof inventoryAlertCreateSchema>;
export type InventoryAlertUpdate = z.infer<typeof inventoryAlertUpdateSchema>;
export type InventoryAlertQuery = z.infer<typeof inventoryAlertQuerySchema>;

// 快速操作类型
export type QuickActionValidated = z.infer<typeof quickActionSchema>;
