import {
  ClipboardCheck,
  CreditCard,
  ReceiptText,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';

import type { AuthUser } from '@/lib/auth/context';
import { can } from '@/lib/auth/permissions';
import type { FinanceWorkbenchMetrics } from '@/lib/services/finance-workbench-service';
import type {
  FinanceWorkbenchCard,
  WorkbenchTone,
} from '@/lib/types/finance-dashboard';
import type { UserRole } from '@/lib/types/user';

export function buildFinanceWorkbenchCards(
  metrics: FinanceWorkbenchMetrics,
  user: AuthUser | null,
  userRole: UserRole
): FinanceWorkbenchCard[] {
  const canViewFinance = can(user, 'finance:view');
  const canManageFinance = can(user, 'finance:manage');
  const canProcessRefunds =
    can(user, 'finance:refund:process') || canManageFinance;

  const items: Array<FinanceWorkbenchCard & { visible: boolean }> = [
    {
      id: 'overdue-payables',
      title: '逾期待付款',
      description: '优先处理已超过到期日的供应商付款，避免影响结算关系。',
      hint: '建议今天先确认处理',
      href: '/finance/payables',
      count: metrics.overduePayables.count,
      amount: metrics.overduePayables.amount,
      icon: TriangleAlert,
      tone: 'urgent',
      visible: canManageFinance,
    },
    {
      id: 'pending-receipts',
      title: '待确认到账',
      description: '先把已经登记的收款确认到账，避免收到了钱但账上还没更新。',
      hint: '收款到账后会进入正式统计',
      href: '/finance/payments?status=pending',
      count: metrics.pendingReceipts.count,
      amount: metrics.pendingReceipts.amount,
      icon: ReceiptText,
      tone: 'warning',
      visible: canViewFinance,
    },
    {
      id: 'customer-receivables',
      title: '客户待跟进',
      description: '按客户跟进未回款余额，优先处理金额较大或时间较久的款项。',
      hint:
        userRole === 'sales'
          ? '销售今天优先跟进回款'
          : '建议先看金额较大的客户',
      href: '/finance/receivables',
      count: metrics.receivables.count,
      amount: metrics.receivables.amount,
      icon: TrendingUp,
      tone: 'info',
      visible: canViewFinance,
    },
    {
      id: 'pending-payments',
      title: '待确认付款',
      description: '已登记的付款需要尽快确认，避免供应商结算进度滞后。',
      hint: '确认后会计入已付款金额',
      href: '/finance/payments-out?status=pending',
      count: metrics.pendingPayments.count,
      amount: metrics.pendingPayments.amount,
      icon: CreditCard,
      tone: 'warning',
      visible: canManageFinance,
    },
    {
      id: 'pending-refunds',
      title: '待处理退款',
      description: '退货后的退款要尽快处理，减少客户等待和反复沟通。',
      hint: '优先看待处理和待退款金额',
      href: '/finance/refunds',
      count: metrics.pendingRefunds.count,
      amount: metrics.pendingRefunds.amount,
      icon: RotateCcw,
      tone: 'warning',
      visible: canProcessRefunds,
    },
    {
      id: 'expense-drafts',
      title: '待审核费用',
      description: '草稿费用还未进入正式报表，建议尽快核对并审核入账。',
      hint: '审核后才会进入月报和利润分析',
      href: '/finance/expenses?status=draft',
      count: metrics.expenseDrafts.count,
      amount: metrics.expenseDrafts.amount,
      icon: ClipboardCheck,
      tone: 'success',
      visible: canManageFinance,
    },
    {
      id: 'supplier-payables',
      title: '供应商待付款',
      description: '查看供应商待付款余额，避免漏付、迟付或结算节奏失衡。',
      hint: '可先看逾期和金额较大的单据',
      href: '/finance/payables',
      count: metrics.payables.count,
      amount: metrics.payables.amount,
      icon: TrendingDown,
      tone: 'info',
      visible: canManageFinance,
    },
  ];

  return items
    .filter(item => item.visible && item.count > 0)
    .sort((left, right) => {
      const tonePriority: Record<WorkbenchTone, number> = {
        urgent: 4,
        warning: 3,
        info: 2,
        success: 1,
      };

      const priorityDiff = tonePriority[right.tone] - tonePriority[left.tone];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return right.amount - left.amount;
    })
    .slice(0, 6);
}

export function getFinanceWorkbenchSummary(userRole: UserRole) {
  switch (userRole) {
    case 'finance':
      return '财务员今天优先确认到账、确认付款、处理退款，再补齐费用审核。';
    case 'sales':
      return '销售今天优先跟进客户待收和到账进度，避免订单推进和回款脱节。';
    case 'admin':
      return '管理员今天优先关注逾期、待确认和异常金额，先把高风险事项压下去。';
    default:
      return '今天先处理最影响回款和结算的事项，再看报表和对账。';
  }
}

export function getWorkbenchToneStyles(tone: WorkbenchTone) {
  switch (tone) {
    case 'urgent':
      return {
        badge:
          'bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
        icon: 'bg-[hsl(var(--color-error))] text-white',
        amount: 'text-[hsl(var(--color-error))]',
      };
    case 'warning':
      return {
        badge:
          'bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
        icon: 'bg-[hsl(var(--color-warning))] text-white',
        amount: 'text-[hsl(var(--color-warning))]',
      };
    case 'success':
      return {
        badge:
          'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
        icon: 'bg-[hsl(var(--color-success))] text-white',
        amount: 'text-[hsl(var(--color-success))]',
      };
    default:
      return {
        badge:
          'bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]',
        icon: 'bg-[hsl(var(--color-primary))] text-white',
        amount: 'text-[hsl(var(--color-primary))]',
      };
  }
}
