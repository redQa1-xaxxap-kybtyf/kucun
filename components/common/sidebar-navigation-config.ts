import {
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  FolderTree,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

import type { NavigationItem } from '@/lib/types/layout';

/**
 * 主要功能模块导航配置
 * 严格按照项目要求包含所有功能模块
 */
export const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: '仪表盘',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'inventory',
    title: '库存管理',
    href: '/inventory',
    icon: Warehouse,
    children: [
      {
        id: 'inventory-overview',
        title: '库存总览',
        href: '/inventory',
        icon: Warehouse,
      },
      {
        id: 'inventory-inbound-create',
        title: '产品入库',
        href: '/inventory/inbound/create',
        icon: Plus,
      },
      {
        id: 'inventory-inbound',
        title: '入库记录',
        href: '/inventory/inbound',
        icon: TrendingUp,
      },
      {
        id: 'inventory-outbound',
        title: '出库记录',
        href: '/inventory/outbound',
        icon: TrendingDown,
      },
      {
        id: 'inventory-adjustments',
        title: '调整记录',
        href: '/inventory/adjustments',
        icon: Edit,
      },
    ],
  },
  {
    id: 'products',
    title: '产品管理',
    href: '/products',
    icon: Package,
  },
  {
    id: 'categories',
    title: '分类管理',
    href: '/categories',
    icon: FolderTree,
  },
  {
    id: 'sales-orders',
    title: '销售订单',
    href: '/sales-orders',
    icon: ShoppingCart,
  },
  {
    id: 'factory-shipments',
    title: '厂家发货',
    href: '/factory-shipments',
    icon: Truck,
  },
  {
    id: 'return-orders',
    title: '退货订单',
    href: '/return-orders',
    icon: RotateCcw,
  },
  {
    id: 'customers',
    title: '客户管理',
    href: '/customers',
    icon: Users,
  },
  {
    id: 'suppliers',
    title: '供应商管理',
    href: '/suppliers',
    icon: Truck,
  },
  {
    id: 'finance',
    title: '财务管理',
    href: '/finance',
    icon: DollarSign,
    children: [
      {
        id: 'finance-receivables',
        title: '应收货款',
        href: '/finance/receivables',
        icon: TrendingUp,
      },
      {
        id: 'finance-payables',
        title: '应付货款',
        href: '/finance/payables',
        icon: TrendingDown,
      },
      {
        id: 'finance-refunds',
        title: '应退货款',
        href: '/finance/refunds',
        icon: RotateCcw,
      },
      {
        id: 'finance-payments',
        title: '收款记录',
        href: '/finance/payments',
        icon: CreditCard,
      },
      {
        id: 'finance-payments-out',
        title: '付款记录',
        href: '/finance/payments-out',
        icon: ArrowUpRight,
      },
      {
        id: 'finance-statements',
        title: '往来账单',
        href: '/finance/statements',
        icon: Receipt,
      },
    ],
  },
  {
    id: 'settings',
    title: '系统设置',
    href: '/settings',
    icon: Settings,
    requiredRoles: ['admin'],
    children: [
      {
        id: 'settings-basic',
        title: '基本设置',
        href: '/settings/basic',
        icon: Settings,
        requiredRoles: ['admin'],
      },
      {
        id: 'settings-users',
        title: '用户管理',
        href: '/settings/users',
        icon: Users,
        requiredRoles: ['admin'],
      },
      {
        id: 'settings-storage',
        title: '七牛云存储',
        href: '/settings/storage',
        icon: Package,
        requiredRoles: ['admin'],
      },
      {
        id: 'settings-logs',
        title: '系统日志',
        href: '/settings/logs',
        icon: Receipt,
        requiredRoles: ['admin'],
      },
      {
        id: 'settings-shipping-sites',
        title: '运输站点管理',
        href: '/settings/shipping-sites',
        icon: Globe,
        requiredRoles: ['admin'],
      },
      {
        id: 'settings-shipping-query',
        title: '运输查询',
        href: '/settings/shipping-query',
        icon: Search,
        requiredRoles: ['admin'],
      },
    ],
  },
];

/**
 * 底部辅助功能导航
 */
export const bottomNavigationItems: NavigationItem[] = [
  {
    id: 'help',
    title: '帮助中心',
    href: '/help',
    icon: HelpCircle,
  },
];
