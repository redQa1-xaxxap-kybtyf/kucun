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
  '/dashboard': '首页',
  '/dev': '开发工具',
  '/dev/tokens-preview': '设计令牌预览',
  '/dev/print-preview': '打印预览',
  '/inventory': '库存管理',
  '/inventory/inbound': '入库记录',
  '/inventory/inbound/create': '手工采购入库',
  '/inventory/outbound': '出库记录',
  '/inventory/outbound/create': '产品出库',
  '/inventory/outbound/history': '出库历史',
  '/inventory/adjust': '库存调整',
  '/inventory/adjustments': '调整记录',
  '/inventory/adjustments/create': '新建库存调整',
  '/inventory/counts': '库存盘点',
  '/inventory/counts/new': '创建盘点计划',
  '/inventory/counts/statistics': '盘点统计',
  '/inventory/batch': '批次管理',
  '/inventory/temporary-products': '调货产品库',
  '/inventory/purchase-damage': '到货破损台账',
  '/inventory/manual-damage': '手工报损台账',
  '/products': '产品管理',
  '/products/create': '新建产品',
  '/products/tracking': '产品流向',
  '/sales-orders': '销售订单',
  '/sales-orders/create': '新建订单',
  '/return-orders': '退货订单',
  '/return-orders/create': '新建退货',
  '/return-orders/edit': '编辑退货订单',
  '/customers': '客户档案',
  '/customers/create': '新建客户',
  '/suppliers': '供应商档案',
  '/suppliers/create': '新建供应商',
  '/factory-shipments': '厂家直发',
  '/factory-shipments/create': '新建直发',
  '/purchase-orders': '仓库进货',
  '/purchase-orders/create': '新建采购订单',
  '/payments': '支付管理',
  '/categories': '分类管理',
  '/categories/create': '新建分类',
  '/settings': '系统设置',
  '/settings/shipping-query': '运输查询',
  '/settings/shipping-sites': '运输站点管理',
  '/help': '帮助',
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
  '/finance/receivables': '应收账款',
  '/finance/receivables/create': '新建应收',
  '/finance/customer-statements': '客户明细账',
  '/finance/refunds': '退款单',
  '/finance/refunds/create': '新建退款',
  '/finance/statements': '往来对账',
  '/finance/statements/create': '新建账单',
  '/finance/payments': '收款单',
  '/finance/payments/create': '登记收款',
  '/finance/payables': '应付账款',
  '/finance/payables/create': '登记应付款',
  '/finance/payments-out': '付款单',
  '/finance/payments-out/create': '登记付款',
  '/finance/expenses': '费用支出',
  '/finance/expenses/create': '新建费用',
  // 财务管理子路由
  reports: '财务报表',
  monthly: '月度报表',
  annual: '年度报表',
  'profit-loss': '盈亏分析',
  receivables: '应收账款',
  refunds: '退款单',
  statements: '往来对账',
  payments: '收款单',
  payables: '应付账款',
  'payments-out': '付款单',
  'customer-statements': '客户明细账',
  expenses: '费用支出',
  transactions: '流水明细',

  // 设置模块路径映射
  '/settings/logs': '操作记录',
  '/settings/basic': '基本设置',
  '/settings/storage': '存储设置',
  '/settings/users': '用户管理',
  '/settings/data-management': '数据管理',
  '/settings/print-templates': '打印模板',
  '/settings/print-designer': '模板设计',
  '/settings/shipping-sites/selector-helper': '识别规则设置',

  // 特殊子路径（用于动态路由识别）
  process: '处理',
  logs: '记录',
  basic: '基本设置',
  storage: '存储',
  users: '用户',
  'data-management': '数据管理',
  'print-templates': '打印模板',
  'print-designer': '模板设计',
  'shipping-query': '运输查询',
  'shipping-sites': '运输站点管理',
  'purchase-damage': '到货破损台账',
  'manual-damage': '手工报损台账',
  'selector-helper': '识别规则设置',
  'tokens-preview': '设计令牌预览',
  'print-preview': '打印预览',
  tracking: '产品流向',
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
  客户档案: '客户详情',
  供应商档案: '供应商详情',
  销售订单: '订单详情',
  退货订单: '退货详情',
  厂家发货: '发货详情',
  厂家直发: '直发详情',
  客户往来明细: '明细账详情',
  客户明细账: '明细账详情',
  客户待收款: '应收详情',
  应收账款: '应收详情',
  退款处理: '退款详情',
  退款单: '退款详情',
  往来对账: '对账详情',
  收款管理: '收款详情',
  收款记录: '收款详情',
  收款单: '收款详情',
  供应商待付款: '应付款详情',
  应付款: '应付款详情',
  应付账款: '应付款详情',
  付款管理: '付款详情',
  付款单: '付款详情',
  费用管理: '费用详情',
  费用支出: '费用详情',
  入库记录: '入库详情',
  出库记录: '出库详情',
  调整记录: '库存调整详情',
  库存调整: '库存调整详情',
  批次管理: '批次详情',
  库存盘点: '盘点计划详情',
  仓库进货: '进货详情',
};

const EDIT_TITLE_MAP: Record<string, string> = {
  产品管理: '编辑产品',
  分类管理: '编辑分类',
  客户档案: '编辑客户',
  供应商档案: '编辑供应商',
  销售订单: '编辑订单',
  退货订单: '编辑退货订单',
  厂家发货: '编辑发货',
  厂家直发: '编辑直发',
  客户往来明细: '编辑明细账',
  客户明细账: '编辑明细账',
  客户待收款: '编辑待收款',
  应收账款: '编辑应收',
  退款处理: '编辑退款',
  退款单: '编辑退款',
  往来对账: '编辑对账',
  收款管理: '编辑收款信息',
  收款记录: '编辑收款信息',
  收款单: '编辑收款',
  供应商待付款: '编辑应付款',
  应付款: '编辑应付款',
  应付账款: '编辑应付款',
  付款管理: '编辑付款信息',
  付款单: '编辑付款',
  费用管理: '编辑费用',
  费用支出: '编辑费用',
  入库记录: '编辑入库记录',
  出库记录: '编辑出库记录',
  调整记录: '编辑库存调整',
  库存调整: '编辑库存调整',
  批次管理: '编辑批次',
  库存盘点: '编辑盘点计划',
  仓库进货: '编辑采购订单',
};

const DETAIL_TITLE_BY_PARENT_PATH: Record<string, string> = {
  '/products': '产品详情',
  '/categories': '分类详情',
  '/customers': '客户详情',
  '/suppliers': '供应商详情',
  '/sales-orders': '订单详情',
  '/return-orders': '退货详情',
  '/factory-shipments': '发货详情',
  '/purchase-orders': '进货详情',
  '/inventory/inbound': '入库详情',
  '/inventory/outbound': '出库详情',
  '/inventory/adjustments': '库存调整详情',
  '/inventory/batch': '批次详情',
  '/inventory/counts': '盘点计划详情',
  '/finance/statements': '对账详情',
  '/finance/expenses': '费用详情',
  '/finance/customer-statements': '明细账详情',
  '/finance/refunds': '退款详情',
  '/finance/receivables': '应收详情',
  '/finance/payments': '收款详情',
  '/finance/payables': '应付款详情',
  '/finance/payments-out': '付款详情',
};

function isIdentifierSegment(segment: string): boolean {
  return (
    /^[0-9a-f-]{36}$/i.test(segment) ||
    /^\d+$/.test(segment) ||
    (segment.length >= 6 && /\d/.test(segment))
  );
}

function getDetailTitleForParent(parentPath: string): string | undefined {
  const parentTitle = PATH_TITLES[parentPath];
  return (
    DETAIL_TITLE_BY_PARENT_PATH[parentPath] ||
    (parentTitle ? DETAIL_TITLE_MAP[parentTitle] : undefined)
  );
}

function getEditTitleForPath(segments: string[], editIndex: number): string {
  const grandParentPath = `/${segments.slice(0, editIndex - 1).join('/')}`;
  const grandParentTitle = PATH_TITLES[grandParentPath];
  const mappedEditTitle = grandParentTitle
    ? EDIT_TITLE_MAP[grandParentTitle]
    : undefined;
  return mappedEditTitle || '编辑内容';
}

interface BuildBreadcrumbItemsOptions {
  pathname: string;
  items?: BreadcrumbItem[];
  showHome?: boolean;
  dynamicTitle?: string | null;
  factoryShipmentMode?: string | null;
}

export function buildBreadcrumbItemsForPath({
  pathname,
  items,
  showHome = true,
  dynamicTitle = null,
  factoryShipmentMode = null,
}: BuildBreadcrumbItemsOptions): BreadcrumbItem[] {
  if (items) {
    return items;
  }

  const normalizedPathname =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  const specialPaths = SKIP_INTERMEDIATE_PATHS[normalizedPathname];
  if (specialPaths) {
    const visibleSpecialPaths = showHome
      ? specialPaths
      : specialPaths.filter(path => path !== '/dashboard');

    return visibleSpecialPaths.map((path, index) => ({
      title: PATH_TITLES[path] || path,
      href: index === visibleSpecialPaths.length - 1 ? undefined : path,
      isCurrent: index === visibleSpecialPaths.length - 1,
    }));
  }

  const segments = normalizedPathname.split('/').filter(Boolean);
  const breadcrumbItems: BreadcrumbItem[] = [];

  if (showHome) {
    breadcrumbItems.push({
      title: '首页',
      href: '/dashboard',
      isCurrent:
        normalizedPathname === '/dashboard' || normalizedPathname === '/',
    });
  }

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    if (currentPath === '/dashboard' && showHome) return;

    const parentPath = `/${segments.slice(0, index).join('/')}`;
    const mappedTitle = PATH_TITLES[currentPath] || PATH_TITLES[segment];
    const detailTitle = getDetailTitleForParent(parentPath);
    const isDynamicSegment = !mappedTitle && Boolean(detailTitle);

    if (!mappedTitle && !isDynamicSegment && !isLast) {
      return;
    }

    let title = mappedTitle || segment;

    if (currentPath === '/factory-shipments' && isLast) {
      if (factoryShipmentMode === 'customer_direct') {
        title = '客户直发';
      } else if (factoryShipmentMode === 'factory') {
        title = '厂家直发';
      }
    }

    if (segment === 'edit' && index >= 2) {
      title = getEditTitleForPath(segments, index);
    } else if (
      isDynamicSegment ||
      (!mappedTitle && isIdentifierSegment(segment))
    ) {
      if (isLast && dynamicTitle) {
        title = dynamicTitle;
      } else {
        title =
          detailTitle ||
          getDetailTitleForParent(parentPath) ||
          `详情 #${segment.slice(0, 8)}`;
      }
    } else if (!mappedTitle && isLast && dynamicTitle) {
      title = dynamicTitle;
    }

    breadcrumbItems.push({
      title,
      href: isLast ? undefined : currentPath,
      isCurrent: isLast,
    });
  });

  return breadcrumbItems;
}

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

  const autoGeneratedItems = React.useMemo(
    () =>
      buildBreadcrumbItemsForPath({
        pathname,
        items,
        showHome,
        dynamicTitle,
        factoryShipmentMode,
      }),
    [pathname, items, showHome, dynamicTitle, factoryShipmentMode]
  );

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
                className="group flex items-center gap-1 rounded-md px-2 py-0.5 text-slate-400 transition-colors hover:bg-slate-100/30 hover:text-slate-900"
              >
                {index === 0 && showHome && (
                  <Home className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                )}
                <span className="text-xs font-medium">{item.title}</span>
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
  const { dynamicTitle } = useBreadcrumbContext();

  const autoGeneratedItems = React.useMemo(() => {
    const fullItems = buildBreadcrumbItemsForPath({
      pathname,
      items,
      showHome: false,
      dynamicTitle,
      factoryShipmentMode,
    });

    return fullItems.slice(-2);
  }, [pathname, items, dynamicTitle, factoryShipmentMode]);

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
