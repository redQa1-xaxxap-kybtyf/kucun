'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { BreadcrumbItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

import { useBreadcrumbContext } from './BreadcrumbContext';

interface BreadcrumbProps {
  /** 自定义面包屑项 */
  items?: BreadcrumbItem[];
  /** 是否显示首页链接 */
  showHome?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 分隔符 */
  separator?: React.ReactNode;
}

/**
 * 特殊路径面包屑配置
 * 定义某些路径应该跳过中间层级，直接显示最终层级
 * 格式：路径 => [首页, 父级, 当前页]
 */
const SKIP_INTERMEDIATE_PATHS: Record<string, string[]> = {
  // 库存管理 - 入库相关
  '/inventory/inbound/create': [
    '/dashboard',
    '/inventory',
    '/inventory/inbound/create',
  ],

  // 库存管理 - 出库相关
  '/inventory/outbound/create': [
    '/dashboard',
    '/inventory',
    '/inventory/outbound/create',
  ],

  // 库存管理 - 调整相关
  '/inventory/adjustments/create': [
    '/dashboard',
    '/inventory',
    '/inventory/adjustments/create',
  ],
};

/**
 * 路径到标题的映射
 * 严格遵循代码质量规范，统一使用中文标题
 */
const PATH_TITLES: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/inventory': '库存管理',
  '/inventory/inbound': '入库记录',
  '/inventory/inbound/create': '手工采购入库',
  '/inventory/outbound': '出库记录',
  '/inventory/outbound/create': '产品出库',
  '/inventory/adjust': '库存调整',
  '/inventory/adjustments': '调整记录',
  '/inventory/adjustments/create': '新建库存调整',
  '/inventory/counts': '库存盘点',
  '/inventory/counts/new': '创建盘点计划',
  '/inventory/counts/statistics': '盘点统计',
  '/inventory/batch': '批次管理',
  '/inventory/temporary-products': '调货产品库',
  '/products': '产品管理',
  '/products/create': '新建产品',
  '/sales-orders': '销售订单',
  '/sales-orders/create': '新建订单',
  '/return-orders': '退货订单',
  '/return-orders/create': '新建退货',
  '/return-orders/edit': '编辑退货订单',
  '/customers': '客户管理',
  '/customers/create': '新建客户',
  '/suppliers': '供应商管理',
  '/suppliers/create': '新建供应商',
  '/factory-shipments': '厂家发货',
  '/factory-shipments/create': '新建发货',
  '/purchase-orders': '仓库进货',
  '/purchase-orders/create': '新建采购订单',
  '/payments': '支付管理',
  '/categories': '分类管理',
  '/categories/create': '新建分类',
  '/settings': '系统设置',
  '/settings/shipping-query': '物流查询',
  '/settings/shipping-sites': '发货网点',
  '/help': '帮助中心',
  '/help/shortcuts': '快捷键指南',
  '/profile': '个人资料',
  '/notifications': '通知中心',
  '/create': '新建',
  '/edit': '编辑',
  '/products/edit': '编辑产品',
  '/categories/edit': '编辑分类',
  '/customers/edit': '编辑客户',
  '/suppliers/edit': '编辑供应商',
  '/inbound': '入库管理',
  '/inbound/create': '新建入库',
  '/outbound': '出库管理',
  '/adjust': '库存调整',
  '/test-api': '接口测试',
  // 财务管理模块路径映射
  '/finance': '财务管理',
  '/finance/reports': '财务报表',
  '/finance/reports/monthly': '月度报表',
  '/finance/reports/annual': '年度报表',
  '/finance/reports/profit-loss': '盈亏分析',
  '/finance/receivables': '客户待收款',
  '/finance/receivables/create': '新建应收',
  '/finance/customer-statements': '客户往来明细',
  '/finance/refunds': '退款处理',
  '/finance/refunds/create': '新建退款',
  '/finance/statements': '往来对账',
  '/finance/statements/create': '新建账单',
  '/finance/payments': '收款管理',
  '/finance/payments/create': '登记收款',
  '/finance/payables': '供应商待付款',
  '/finance/payables/create': '登记应付款',
  '/finance/payments-out': '付款管理',
  '/finance/payments-out/create': '登记付款',
  '/finance/expenses': '费用管理',
  '/finance/expenses/create': '新建费用',
  // 财务管理子路由
  reports: '财务报表',
  monthly: '月度报表',
  annual: '年度报表',
  'profit-loss': '盈亏分析',
  receivables: '客户待收款',
  refunds: '退款处理',
  statements: '往来对账',
  payments: '收款管理',
  payables: '供应商待付款',
  'payments-out': '付款管理',
  'customer-statements': '客户往来明细',
  expenses: '费用管理',

  // 设置模块路径映射
  '/settings/logs': '操作记录',
  '/settings/basic': '基本设置',
  '/settings/storage': '存储设置',
  '/settings/users': '用户管理',

  // 特殊子路径（用于动态路由识别）
  process: '处理',
  logs: '记录',
  basic: '基本设置',
  storage: '存储',
  users: '用户',
  history: '变动历史',
  batch: '批次管理',
  counts: '库存盘点',
  statistics: '统计分析',
  shortcuts: '快捷键',
  notifications: '通知中心',
  execute: '执行盘点',
};

const DETAIL_TITLE_MAP: Record<string, string> = {
  产品管理: '产品详情',
  分类管理: '分类详情',
  客户管理: '客户详情',
  供应商管理: '供应商详情',
  销售订单: '订单详情',
  退货订单: '退货详情',
  厂家发货: '发货详情',
  客户往来明细: '明细账详情',
  客户待收款: '应收详情',
  退款处理: '退款详情',
  往来对账: '对账详情',
  收款管理: '收款详情',
  收款记录: '收款详情',
  供应商待付款: '应付款详情',
  应付款: '应付款详情',
  付款管理: '付款详情',
  费用管理: '费用详情',
  入库记录: '入库详情',
  出库记录: '出库详情',
  调整记录: '库存调整详情',
  库存调整: '库存调整详情',
  批次管理: '批次详情',
  库存盘点: '盘点计划详情',
};

const EDIT_TITLE_MAP: Record<string, string> = {
  产品管理: '编辑产品',
  分类管理: '编辑分类',
  客户管理: '编辑客户',
  供应商管理: '编辑供应商',
  销售订单: '编辑订单',
  退货订单: '编辑退货订单',
  厂家发货: '编辑发货',
  客户往来明细: '编辑明细账',
  客户待收款: '编辑待收款',
  退款处理: '编辑退款',
  往来对账: '编辑对账',
  收款管理: '编辑收款信息',
  收款记录: '编辑收款信息',
  供应商待付款: '编辑应付款',
  应付款: '编辑应付款',
  付款管理: '编辑付款信息',
  费用管理: '编辑费用',
  入库记录: '编辑入库记录',
  出库记录: '编辑出库记录',
  调整记录: '编辑库存调整',
  库存调整: '编辑库存调整',
  批次管理: '编辑批次',
  库存盘点: '编辑盘点计划',
};

/**
 * 面包屑导航组件
 * 自动根据当前路径生成面包屑，支持自定义项目
 */
export function Breadcrumb({
  items,
  showHome = true,
  className,
  separator = <ChevronRight className="h-3.5 w-3.5 text-slate-300" />,
}: BreadcrumbProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const factoryShipmentMode = searchParams.get('mode');
  const { dynamicTitle } = useBreadcrumbContext();

  // 自动生成面包屑项
  const autoGeneratedItems = React.useMemo(() => {
    if (items) {
      return items;
    }

    // 检查是否有特殊路径配置
    const specialPaths = SKIP_INTERMEDIATE_PATHS[pathname];
    if (specialPaths) {
      return specialPaths.map((path, index) => ({
        title: PATH_TITLES[path] || path,
        href: index === specialPaths.length - 1 ? undefined : path,
        isCurrent: index === specialPaths.length - 1,
      }));
    }

    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbItems: BreadcrumbItem[] = [];

    // 添加首页
    if (showHome) {
      breadcrumbItems.push({
        title: '仪表盘',
        href: '/dashboard',
        isCurrent: pathname === '/dashboard' || pathname === '/',
      });
    }

    // 构建路径面包屑
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;

      // 如果当前路径就是仪表盘，且已经添加了首页，则跳过
      if (currentPath === '/dashboard' && showHome) return;

      // 获取标题
      const mappedTitle = PATH_TITLES[currentPath] || PATH_TITLES[segment];

      // 如果路径没有定义且不是最后一个段，跳过
      if (!mappedTitle && !isLast) {
        return;
      }

      let title = mappedTitle || segment;

      // 如果是ID内容
      if (/^[0-9a-f-]{36}$|^\d+$/.test(segment)) {
        if (isLast && dynamicTitle) {
          title = dynamicTitle;
        } else {
          const parentPath = `/${segments.slice(0, index).join('/')}`;
          const parentTitle = PATH_TITLES[parentPath];
          const mappedDetailTitle = parentTitle
            ? DETAIL_TITLE_MAP[parentTitle]
            : undefined;
          title = mappedDetailTitle || `详情 #${segment.slice(0, 8)}`;
        }
      }

      // 如果是edit
      if (segment === 'edit' && index >= 2) {
        const grandParentPath = `/${segments.slice(0, index - 1).join('/')}`;
        const grandParentTitle = PATH_TITLES[grandParentPath];
        const mappedEditTitle = grandParentTitle
          ? EDIT_TITLE_MAP[grandParentTitle]
          : undefined;
        title = mappedEditTitle || '编辑内容';
      }

      if (currentPath === '/factory-shipments' && isLast) {
        if (factoryShipmentMode === 'customer_direct') {
          title = '客户直发';
        } else if (factoryShipmentMode === 'factory') {
          title = '厂家发货';
        }
      }

      breadcrumbItems.push({
        title,
        href: isLast ? undefined : currentPath,
        isCurrent: isLast,
      });
    });

    return breadcrumbItems;
  }, [pathname, items, showHome, dynamicTitle, factoryShipmentMode]);

  if (autoGeneratedItems.length === 0) return null;

  return (
    <nav
      aria-label="面包屑导航"
      className={cn(
        'flex items-center space-x-1 font-medium transition-all',
        className
      )}
    >
      <ol className="flex items-center gap-1.5">
        {autoGeneratedItems.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <span
                className="flex cursor-default items-center"
                aria-hidden="true"
              >
                {separator}
              </span>
            )}

            {item.isCurrent ? (
              <span
                className="rounded-md bg-slate-100/50 px-2 py-0.5 text-xs font-semibold text-slate-900"
                aria-current="page"
              >
                {item.title}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="group flex items-center gap-1 rounded-md px-2 py-0.5 text-slate-400 transition-all hover:bg-slate-100/30 hover:text-slate-900 active:scale-95"
              >
                {index === 0 && showHome && (
                  <Home className="h-3.5 w-3.5 opacity-60 transition-all group-hover:scale-110 group-hover:opacity-100" />
                )}
                <span className="text-xs font-medium">
                  {item.title}
                </span>
              </Link>
            ) : (
              <span className="px-2 py-0.5 font-medium text-slate-400">
                {item.title}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * 紧凑型面包屑组件
 * 适用于移动端或空间有限的场景
 */
export function CompactBreadcrumb({
  items,
  showHome: _showHome = false,
  className,
}: Omit<BreadcrumbProps, 'separator'>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const factoryShipmentMode = searchParams.get('mode');

  const autoGeneratedItems = React.useMemo(() => {
    if (items) {
      return items;
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return [];
    }

    const breadcrumbItems: BreadcrumbItem[] = [];

    // 只显示当前页面和上一级
    if (segments.length > 1) {
      const parentPath = `/${segments.slice(0, -1).join('/')}`;
      const parentTitle =
        PATH_TITLES[parentPath] || segments[segments.length - 2];

      breadcrumbItems.push({
        title: parentTitle,
        href: parentPath,
        isCurrent: false,
      });
    }

    // 当前页面
    let currentTitle = PATH_TITLES[pathname] || segments[segments.length - 1];
    if (pathname === '/factory-shipments') {
      if (factoryShipmentMode === 'customer_direct') {
        currentTitle = '客户直发';
      } else if (factoryShipmentMode === 'factory') {
        currentTitle = '厂家发货';
      }
    }
    breadcrumbItems.push({
      title: currentTitle,
      isCurrent: true,
    });

    return breadcrumbItems;
  }, [pathname, items, factoryShipmentMode]);

  if (autoGeneratedItems.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="面包屑导航"
      className={cn('flex items-center space-x-2', className)}
    >
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-muted-foreground hover:text-foreground h-8 px-2"
      >
        <Link href={autoGeneratedItems[0].href || '#'}>
          <ChevronRight className="mr-1 h-4 w-4 rotate-180" />
          {autoGeneratedItems[0].title}
        </Link>
      </Button>

      <span className="text-foreground font-medium">
        {autoGeneratedItems[autoGeneratedItems.length - 1].title}
      </span>
    </nav>
  );
}

/**
 * 面包屑项组件
 * 可以单独使用的面包屑项
 */
export function BreadcrumbItem({
  title,
  href,
  isCurrent,
  className,
  children,
}: BreadcrumbItem & {
  className?: string;
  children?: React.ReactNode;
}) {
  if (isCurrent) {
    return (
      <span
        className={cn('text-foreground font-medium', className)}
        aria-current="page"
      >
        {children || title}
      </span>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className={cn('hover:text-foreground transition-colors', className)}
      >
        {children || title}
      </Link>
    );
  }

  return <span className={className}>{children || title}</span>;
}
