import {
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  Receipt,
} from 'lucide-react';

import type { ShortcutGroup } from '@/lib/types/finance-dashboard';

export const financeShortcutGroups: ShortcutGroup[] = [
  {
    id: 'records',
    title: '常用记录',
    description: '日常记账和核对常用入口。',
    items: [
      {
        id: 'payments',
        title: '收款管理',
        description: '查看收款、确认到账',
        href: '/finance/payments',
        icon: CreditCard,
      },
      {
        id: 'payments-out',
        title: '付款管理',
        description: '查看待确认与已完成付款',
        href: '/finance/payments-out',
        icon: CreditCard,
      },
      {
        id: 'expenses',
        title: '费用管理',
        description: '登记费用并审核入账',
        href: '/finance/expenses',
        icon: Receipt,
      },
    ],
  },
  {
    id: 'reconciliation',
    title: '对账与报表',
    description: '需要看余额、流水和报表时从这里进入。',
    items: [
      {
        id: 'statements',
        title: '往来对账',
        description: '查看客户和供应商余额汇总',
        href: '/finance/statements',
        icon: FileText,
      },
      {
        id: 'customer-statements',
        title: '客户往来明细',
        description: '按客户查看往来流水',
        href: '/finance/customer-statements',
        icon: FileText,
      },
      {
        id: 'monthly-report',
        title: '月度报表',
        description: '查看当月收入、成本和费用',
        href: '/finance/reports/monthly',
        icon: Calendar,
      },
      {
        id: 'annual-report',
        title: '年度报表',
        description: '查看年度经营数据',
        href: '/finance/reports/annual',
        icon: Calendar,
      },
      {
        id: 'profit-loss',
        title: '利润分析',
        description: '查看利润结构与趋势',
        href: '/finance/reports/profit-loss',
        icon: BarChart3,
      },
    ],
  },
];
