import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Edit,
  FileText,
  FolderTree,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Package,
  PackageSearch,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Trash2,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import type { NavigationItem } from '@/lib/types/layout';

/**
 * 主要功能模块导航配置
 * 优化后的菜单结构：按业务流程分组，层级扁平化
 */
export const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: '仪表盘',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'business',
    title: '业务管理',
    href: '/sales-orders',
    icon: Briefcase,
    children: [
      {
        id: 'sales-orders',
        title: '销售订单',
        href: '/sales-orders',
        icon: ShoppingCart,
      },
      {
        id: 'return-orders',
        title: '退货订单',
        href: '/return-orders',
        icon: RotateCcw,
      },
      {
        id: 'factory-shipments',
        title: '厂家发货',
        href: '/factory-shipments',
        icon: Truck,
        children: [
          {
            id: 'factory-shipments-factory',
            title: '厂家发货',
            href: '/factory-shipments?mode=factory',
            icon: Truck,
          },
          {
            id: 'factory-shipments-warehouse-inbound',
            title: '仓库进货',
            href: '/purchase-orders',
            icon: Warehouse,
          },
        ],
      },
    ],
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
        title: '手工采购入库',
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
      {
        id: 'inventory-batches',
        title: '批次管理',
        href: '/inventory/batch',
        icon: PackageSearch,
      },
      {
        id: 'inventory-temporary-products',
        title: '调货产品库',
        href: '/inventory/temporary-products',
        icon: FileText,
      },
      {
        id: 'inventory-counts',
        title: '库存盘点',
        href: '/inventory/counts',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    id: 'product-center',
    title: '产品中心',
    href: '/products',
    icon: Package,
    children: [
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
    ],
  },
  {
    id: 'partners',
    title: '客户供应商',
    href: '/customers',
    icon: Users,
    children: [
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
    ],
  },
  {
    id: 'finance',
    title: '财务管理',
    href: '/finance',
    icon: ChineseYuan,
    children: [
      {
        id: 'finance-reports-monthly',
        title: '月度报表',
        href: '/finance/reports/monthly',
        icon: Calendar,
      },
      {
        id: 'finance-reports-annual',
        title: '年度报表',
        href: '/finance/reports/annual',
        icon: CalendarDays,
      },
      {
        id: 'finance-reports-profit-loss',
        title: '盈亏分析',
        href: '/finance/reports/profit-loss',
        icon: BarChart3,
      },
      {
        id: 'finance-receivables',
        title: '客户待收款',
        href: '/finance/receivables',
        icon: TrendingUp,
      },
      {
        id: 'finance-payables',
        title: '供应商待付款',
        href: '/finance/payables',
        icon: TrendingDown,
      },
      {
        id: 'finance-refunds',
        title: '退款处理',
        href: '/finance/refunds',
        icon: RotateCcw,
      },
      {
        id: 'finance-payments',
        title: '已收款记录',
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
        title: '往来对账',
        href: '/finance/statements',
        icon: Receipt,
      },
      {
        id: 'finance-customer-statements',
        title: '客户往来明细',
        href: '/finance/customer-statements',
        icon: FileText,
      },
      {
        id: 'finance-expenses',
        title: '费用记录',
        href: '/finance/expenses',
        icon: Receipt,
      },
    ],
  },
  {
    id: 'settings',
    title: '系统设置',
    href: '/settings',
    icon: Settings,
    requiredRoles: ['admin', 'finance'],
    children: [
      {
        id: 'settings-basic',
        title: '基本设置',
        href: '/settings/basic',
        icon: Settings,
        requiredRoles: ['admin'],
      },
      {
        id: 'settings-data-management',
        title: '数据管理',
        href: '/settings/data-management',
        icon: Trash2,
        requiredRoles: ['admin', 'finance'],
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
        id: 'settings-print',
        title: '打印',
        href: '/settings/print-templates',
        icon: Printer,
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
