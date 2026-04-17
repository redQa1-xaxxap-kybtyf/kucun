import { RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';

import type { FinanceOverview } from '@/lib/services/finance-statistics';
import type { PriorityCard } from '@/lib/types/finance-dashboard';

export function buildFinancePriorityCards(
  overview: FinanceOverview
): PriorityCard[] {
  return [
    {
      id: 'receivables',
      title: '客户待收款',
      description: '按客户跟进未回款订单，先处理最容易收回的款项。',
      href: '/finance/receivables',
      icon: TrendingUp,
      accentClassName:
        'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
      hint: `${overview.receivableCount} 个账户待跟进`,
    },
    {
      id: 'payables',
      title: '供应商待付款',
      description: '查看应付款余额和结算进度，避免漏付或逾期。',
      href: '/finance/payables',
      icon: TrendingDown,
      accentClassName:
        'bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
      hint: '查看待付款和已付款进度',
    },
    {
      id: 'refunds',
      title: '退款处理',
      description: '集中处理退货产生的退款，明确待处理和待退款金额。',
      href: '/finance/refunds',
      icon: RotateCcw,
      accentClassName:
        'bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
      hint: `${overview.refundCount} 笔退款待处理`,
    },
  ];
}
