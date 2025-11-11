/**
 * FeeItems Summary - 费用汇总组件
 *
 * 显示客户承担费用、公司承担费用和费用总计
 * 使用 useWatch 优化性能
 */

'use client';

import React from 'react';
import { useWatch } from 'react-hook-form';

import { formatCurrency } from '@/lib/utils/format';

import { useFeeItemsContext } from './fee-items-context';

export function FeeItemsSummary() {
  const { fields } = useFeeItemsContext();

  // 使用 useWatch 优化性能,只监听需要的字段
  // 避免不必要的重渲染
  const feeItems = useWatch({ name: 'feeItems' }) || [];

  // 如果没有费用项,不显示汇总
  if (fields.length === 0) {
    return null;
  }

  // 计算客户承担的费用总额
  const customerPaidTotal = feeItems
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => item.paidBy === 'customer')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((sum: number, item: any) => sum + (item.feeAmount || 0), 0);

  // 计算公司承担的费用总额
  const companyPaidTotal = feeItems
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => item.paidBy === 'company')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((sum: number, item: any) => sum + (item.feeAmount || 0), 0);

  // 费用总计
  const totalFees = customerPaidTotal + companyPaidTotal;

  return (
    <div
      className="space-y-2 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] p-4"
      role="status"
      aria-live="polite"
      aria-label="费用汇总"
    >
      {/* 客户承担费用 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
          客户承担费用小计:
        </span>
        <span className="text-sm font-bold text-[hsl(var(--color-success))]">
          {formatCurrency(customerPaidTotal)}
        </span>
      </div>

      {/* 公司承担费用 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
          公司承担费用小计:
        </span>
        <span className="text-sm font-bold text-[hsl(var(--color-warning))]">
          {formatCurrency(companyPaidTotal)}
        </span>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-[hsl(var(--color-border-secondary))]" />

      {/* 费用总计 */}
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
          额外费用总计:
        </span>
        <span className="text-lg font-bold text-[hsl(var(--color-primary))]">
          {formatCurrency(totalFees)}
        </span>
      </div>

      {/* 提示信息 */}
      <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
        * 客户承担费用计入销售收入，公司承担费用计入销售成本
      </p>
    </div>
  );
}
