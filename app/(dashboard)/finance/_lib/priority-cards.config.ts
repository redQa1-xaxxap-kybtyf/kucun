import { RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';

import type { FinanceOverview } from '@/lib/services/finance-statistics';
import type { PriorityCard } from '@/lib/types/finance-dashboard';

export function buildFinancePriorityCards(
  overview: FinanceOverview
): PriorityCard[] {
  return [
    {
      id: 'receivables',
      title: '应收账款',
      description:
        '按客户和订单查看待收余额，优先跟进金额较大或时间较久的款项。',
      href: '/finance/receivables',
      icon: TrendingUp,
      accentClassName:
        'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
      hint: `${overview.receivableCount} 个账户待跟进`,
    },
    {
      id: 'payables',
      title: '应付账款',
      description: '查看供应商待付余额和付款进度，避免漏付或逾期。',
      href: '/finance/payables',
      icon: TrendingDown,
      accentClassName:
        'bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
      hint: '查看待付款和已付款',
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
