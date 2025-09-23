// 仪表盘模块统一配置文件
// 单一真理源原则：所有仪表盘相关的配置常量统一管理

import type { QuickAction, StatCard } from '@/lib/types/dashboard';

// ==================== 刷新间隔配置 ====================
export const DASHBOARD_REFRESH_INTERVALS = {
  // 仪表盘主数据刷新间隔（毫秒）
  DASHBOARD_DATA: 30 * 1000,        // 30秒
  BUSINESS_OVERVIEW: 5 * 60 * 1000, // 5分钟
  INVENTORY_ALERTS: 60 * 1000,      // 1分钟
  TODO_ITEMS: 5 * 60 * 1000,        // 5分钟
  SALES_TREND: 10 * 60 * 1000,      // 10分钟
  INVENTORY_TREND: 10 * 60 * 1000,  // 10分钟
  PRODUCT_RANKING: 15 * 60 * 1000,  // 15分钟
  CUSTOMER_RANKING: 15 * 60 * 1000, // 15分钟
  QUICK_ACTIONS: 60 * 60 * 1000,    // 1小时
} as const;

// ==================== 默认配置 ====================
export const DASHBOARD_DEFAULTS = {
  // 时间范围选项
  TIME_RANGE: '30d' as const,
  TIME_RANGE_OPTIONS: ['1d', '7d', '30d', '90d', '1y'] as const,
  
  // 布局配置
  LAYOUT: 'grid' as const,
  LAYOUT_OPTIONS: ['grid', 'list'] as const,
  
  // 主题配置
  THEME: 'light' as const,
  THEME_OPTIONS: ['light', 'dark'] as const,
  
  // 功能开关
  SHOW_ALERTS: true,
  SHOW_TODOS: true,
  SHOW_CHARTS: true,
  SHOW_QUICK_ACTIONS: true,
  
  // 小部件配置
  WIDGET_SIZE: 'md' as const,
  WIDGET_SIZES: ['sm', 'md', 'lg', 'xl'] as const,
  
  // 分页配置
  PAGE_SIZE: 10,
  MAX_ALERTS: 20,
  MAX_TODOS: 10,
  MAX_RANKING_ITEMS: 10,
} as const;

// ==================== 颜色配置 ====================
export const DASHBOARD_COLORS = {
  blue: {
    bg: 'bg-blue-50',
    bgHover: 'bg-blue-100',
    text: 'text-blue-600',
    icon: 'text-blue-500',
    border: 'border-blue-200',
    borderHover: 'border-blue-300',
  },
  green: {
    bg: 'bg-green-50',
    bgHover: 'bg-green-100',
    text: 'text-green-600',
    icon: 'text-green-500',
    border: 'border-green-200',
    borderHover: 'border-green-300',
  },
  yellow: {
    bg: 'bg-yellow-50',
    bgHover: 'bg-yellow-100',
    text: 'text-yellow-600',
    icon: 'text-yellow-500',
    border: 'border-yellow-200',
    borderHover: 'border-yellow-300',
  },
  red: {
    bg: 'bg-red-50',
    bgHover: 'bg-red-100',
    text: 'text-red-600',
    icon: 'text-red-500',
    border: 'border-red-200',
    borderHover: 'border-red-300',
  },
  purple: {
    bg: 'bg-purple-50',
    bgHover: 'bg-purple-100',
    text: 'text-purple-600',
    icon: 'text-purple-500',
    border: 'border-purple-200',
    borderHover: 'border-purple-300',
  },
  gray: {
    bg: 'bg-gray-50',
    bgHover: 'bg-gray-100',
    text: 'text-gray-600',
    icon: 'text-gray-500',
    border: 'border-gray-200',
    borderHover: 'border-gray-300',
  },
  orange: {
    bg: 'bg-orange-50',
    bgHover: 'bg-orange-100',
    text: 'text-orange-600',
    icon: 'text-orange-500',
    border: 'border-orange-200',
    borderHover: 'border-orange-300',
  },
  indigo: {
    bg: 'bg-indigo-50',
    bgHover: 'bg-indigo-100',
    text: 'text-indigo-600',
    icon: 'text-indigo-500',
    border: 'border-indigo-200',
    borderHover: 'border-indigo-300',
  },
} as const;

// 默认颜色配置（防御性编程）
export const DEFAULT_COLOR_CONFIG = {
  bg: 'bg-gray-50',
  bgHover: 'bg-gray-100',
  text: 'text-gray-600',
  icon: 'text-gray-500',
  border: 'border-gray-200',
  borderHover: 'border-gray-300',
} as const;

// ==================== 图标映射 ====================
export const DASHBOARD_ICONS = {
  // 统计卡片图标
  'dollar-sign': 'DollarSign',
  'shopping-cart': 'ShoppingCart',
  'package': 'Package',
  'users': 'Users',
  'alert-triangle': 'AlertTriangle',
  'rotate-ccw': 'RotateCcw',
  'trending-up': 'TrendingUp',
  'trending-down': 'TrendingDown',
  
  // 快速操作图标
  'plus': 'Plus',
  'upload': 'Upload',
  'download': 'Download',
  'bar-chart-3': 'BarChart3',
  'settings': 'Settings',
  'search': 'Search',
  'file-text': 'FileText',
  'truck': 'Truck',
  'eye': 'Eye',
  'refresh-cw': 'RefreshCw',
  'calendar': 'Calendar',
  'credit-card': 'CreditCard',
  'zap': 'Zap',
} as const;

// ==================== 快速操作默认配置 ====================
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-sales-order',
    title: '创建销售订单',
    description: '新建销售订单',
    icon: 'shopping-cart',
    href: '/sales-orders/create',
    color: 'blue',
  },
  {
    id: 'add-product',
    title: '添加产品',
    description: '新增产品信息',
    icon: 'package',
    href: '/products/create',
    color: 'green',
  },
  {
    id: 'add-customer',
    title: '添加客户',
    description: '新增客户信息',
    icon: 'users',
    href: '/customers/create',
    color: 'purple',
  },
  {
    id: 'inventory-inbound',
    title: '库存入库',
    description: '商品入库操作',
    icon: 'upload',
    href: '/inventory/inbound',
    color: 'yellow',
  },
  {
    id: 'inventory-outbound',
    title: '库存出库',
    description: '商品出库操作',
    icon: 'download',
    href: '/inventory/outbound',
    color: 'red',
  },
  {
    id: 'process-returns',
    title: '处理退货',
    description: '退货订单处理',
    icon: 'rotate-ccw',
    href: '/return-orders',
    color: 'yellow',
    badge: {
      text: '待处理',
      variant: 'secondary',
    },
  },
  {
    id: 'inventory-alerts',
    title: '库存预警',
    description: '查看库存预警',
    icon: 'alert-triangle',
    href: '/inventory?filter=alerts',
    color: 'red',
    badge: {
      text: '预警',
      variant: 'destructive',
    },
  },
  {
    id: 'reports',
    title: '业务报表',
    description: '查看业务报表',
    icon: 'bar-chart-3',
    href: '/reports',
    color: 'blue',
  },
] as const;

// ==================== 预警级别配置 ====================
export const ALERT_LEVELS = {
  warning: {
    label: '警告',
    color: 'yellow',
    priority: 1,
  },
  danger: {
    label: '危险',
    color: 'orange',
    priority: 2,
  },
  critical: {
    label: '严重',
    color: 'red',
    priority: 3,
  },
} as const;

// ==================== 待办事项优先级配置 ====================
export const TODO_PRIORITIES = {
  low: {
    label: '低',
    color: 'green',
    order: 1,
  },
  medium: {
    label: '中',
    color: 'yellow',
    order: 2,
  },
  high: {
    label: '高',
    color: 'orange',
    order: 3,
  },
  urgent: {
    label: '紧急',
    color: 'red',
    order: 4,
  },
} as const;

// ==================== 小部件类型配置 ====================
export const WIDGET_TYPES = {
  stat: {
    label: '统计卡片',
    description: '显示关键业务指标',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'lg',
  },
  chart: {
    label: '图表',
    description: '显示趋势和分析图表',
    defaultSize: 'lg',
    minSize: 'md',
    maxSize: 'xl',
  },
  list: {
    label: '列表',
    description: '显示数据列表',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'xl',
  },
  alert: {
    label: '预警',
    description: '显示库存预警信息',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'lg',
  },
  todo: {
    label: '待办事项',
    description: '显示待办任务',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'lg',
  },
  quick_action: {
    label: '快速操作',
    description: '显示常用操作入口',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'lg',
  },
} as const;

// ==================== 工具函数 ====================

/**
 * 获取颜色配置
 * @param color 颜色名称
 * @returns 颜色配置对象
 */
export const getColorConfig = (color: string) =>
  DASHBOARD_COLORS[color as keyof typeof DASHBOARD_COLORS] || DEFAULT_COLOR_CONFIG;

/**
 * 获取预警级别配置
 * @param level 预警级别
 * @returns 预警级别配置
 */
export const getAlertLevelConfig = (level: keyof typeof ALERT_LEVELS) =>
  ALERT_LEVELS[level];

/**
 * 获取待办事项优先级配置
 * @param priority 优先级
 * @returns 优先级配置
 */
export const getTodoPriorityConfig = (priority: keyof typeof TODO_PRIORITIES) =>
  TODO_PRIORITIES[priority];

/**
 * 获取小部件类型配置
 * @param type 小部件类型
 * @returns 小部件类型配置
 */
export const getWidgetTypeConfig = (type: keyof typeof WIDGET_TYPES) =>
  WIDGET_TYPES[type];

// ==================== 类型导出 ====================
export type DashboardColorKey = keyof typeof DASHBOARD_COLORS;
export type DashboardIconKey = keyof typeof DASHBOARD_ICONS;
export type AlertLevelKey = keyof typeof ALERT_LEVELS;
export type TodoPriorityKey = keyof typeof TODO_PRIORITIES;
export type WidgetTypeKey = keyof typeof WIDGET_TYPES;
export type TimeRangeKey = typeof DASHBOARD_DEFAULTS.TIME_RANGE_OPTIONS[number];
export type LayoutKey = typeof DASHBOARD_DEFAULTS.LAYOUT_OPTIONS[number];
export type ThemeKey = typeof DASHBOARD_DEFAULTS.THEME_OPTIONS[number];
export type WidgetSizeKey = typeof DASHBOARD_DEFAULTS.WIDGET_SIZES[number];
