import type { MonthlyExpenses } from '@/lib/types/report';

export interface MonthlyExpenseBreakdownItem {
  key: string;
  label: string;
  value: number;
}

/**
 * 月度报表费用看板使用的展示分组。
 * 保留主要费用类型，同时把差旅费/生活费合并展示，并单独保留真正的“其他费用”。
 */
export function buildMonthlyExpenseBreakdown(
  expenses: MonthlyExpenses
): MonthlyExpenseBreakdownItem[] {
  return [
    {
      key: 'shipping',
      label: '运费',
      value: expenses.byType.shipping,
    },
    {
      key: 'storage',
      label: '仓储费',
      value: expenses.byType.storage,
    },
    {
      key: 'labor',
      label: '人工费',
      value: expenses.byType.labor,
    },
    {
      key: 'loading-unloading',
      label: '装卸费',
      value: expenses.byType.loading_unloading,
    },
    {
      key: 'travel-living',
      label: '差旅/生活费',
      value: expenses.byType.travel + expenses.byType.living,
    },
    {
      key: 'other',
      label: '其他费用',
      value: expenses.byType.other,
    },
  ];
}
