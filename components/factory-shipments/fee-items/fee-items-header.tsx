/**
 * FeeItems Header - 头部组件
 *
 * 显示标题、费用项数量和添加按钮
 */

'use client';

import { Plus } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getDefaultFeePaidBy } from '@/lib/types/sales-order-fee';

import { useFeeItemsContext } from './fee-items-context';

export function FeeItemsHeader() {
  const { fields, append, isDisabled } = useFeeItemsContext();

  const handleAddFeeItem = () => {
    // 添加新的费用项,使用智能默认值
    append({
      feeType: 'other',
      feeName: '其他费用',
      feeAmount: 0,
      paidBy: getDefaultFeePaidBy('other'), // 根据费用类型自动选择默认承担方
      remarks: '',
    });
  };

  return (
    <div className="flex items-center justify-between">
      <Label className="text-base font-semibold">
        额外费用
        {fields.length > 0 && (
          <span className="ml-2 text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
            (共 {fields.length} 项)
          </span>
        )}
      </Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddFeeItem}
        disabled={isDisabled}
        aria-label="添加费用项"
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        添加费用
      </Button>
    </div>
  );
}
