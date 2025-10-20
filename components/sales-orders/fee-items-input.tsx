'use client';

import { Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type FeeType,
  type SalesOrderFeeItem,
  FEE_TYPE_OPTIONS,
  FEE_TYPE_LABELS,
} from '@/lib/types/sales-order-fee';
import { formatCurrency } from '@/lib/utils/format';

interface FeeItemsInputProps {
  feeItems: SalesOrderFeeItem[];
  onChange: (feeItems: SalesOrderFeeItem[]) => void;
  disabled?: boolean;
}

/**
 * 销售订单费用项输入组件
 * 支持添加加工费、运费等额外费用
 * 使用 React.memo 优化性能
 */
export const FeeItemsInput = React.memo<FeeItemsInputProps>(
  function FeeItemsInput({ feeItems, onChange, disabled = false }) {
    const sanitizeFeeItems = (
      items: SalesOrderFeeItem[]
    ): SalesOrderFeeItem[] =>
      items.map((item, index, array) => {
        const trimmedName = item.feeName?.trim() ?? '';
        const baseLabel = FEE_TYPE_LABELS[item.feeType] ?? '费用';
        const fallbackName =
          array.length > 1 ? `${baseLabel}${index + 1}` : baseLabel;

        return {
          ...item,
          feeName: trimmedName.length > 0 ? trimmedName : fallbackName,
          feeAmount: Number.isFinite(item.feeAmount)
            ? item.feeAmount
            : Number(item.feeAmount) || 0,
        };
      });

    const [localItems, setLocalItems] = useState<SalesOrderFeeItem[]>(
      sanitizeFeeItems(feeItems)
    );

    // 与外部受控数据保持同步，避免编辑模式下初始值不同步
    useEffect(() => {
      const sanitized = sanitizeFeeItems(feeItems);
      setLocalItems(sanitized);
    }, [feeItems]);

    const emitChange = (items: SalesOrderFeeItem[]) => {
      const sanitized = sanitizeFeeItems(items);
      setLocalItems(sanitized);
      onChange(sanitized);
    };

    const handleAddFeeItem = () => {
      const newItem: SalesOrderFeeItem = {
        feeType: 'other',
        feeName: FEE_TYPE_LABELS.other,
        feeAmount: 0,
        remarks: '',
      };
      const updated = [...localItems, newItem];
      emitChange(updated);
    };

    const handleRemoveFeeItem = (index: number) => {
      const updated = localItems.filter((_, i) => i !== index);
      emitChange(updated);
    };

    const handleUpdateFeeItem = (
      index: number,
      field: keyof SalesOrderFeeItem,
      value: string | number
    ) => {
      const updated = localItems.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            [field]: value,
          };
        }
        return item;
      });
      emitChange(updated);
    };

    const totalFees = localItems.reduce(
      (sum, item) => sum + (Number(item.feeAmount) || 0),
      0
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">额外费用</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddFeeItem}
            disabled={disabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            添加费用
          </Button>
        </div>

        {localItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] p-8 text-center">
            <p className="text-sm text-[hsl(var(--color-text-tertiary))]">
              暂无额外费用，点击上方按钮添加
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {localItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-card))] p-4"
              >
                {/* 费用类型 */}
                <div className="col-span-3">
                  <Label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                    费用类型
                  </Label>
                  <Select
                    value={item.feeType}
                    onValueChange={(value: FeeType) =>
                      handleUpdateFeeItem(index, 'feeType', value)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEE_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 费用名称 */}
                <div className="col-span-3">
                  <Label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                    费用名称
                  </Label>
                  <Input
                    className="mt-1"
                    placeholder={`如：${FEE_TYPE_LABELS[item.feeType]}`}
                    value={item.feeName}
                    onChange={e =>
                      handleUpdateFeeItem(index, 'feeName', e.target.value)
                    }
                    disabled={disabled}
                  />
                </div>

                {/* 费用金额 */}
                <div className="col-span-2">
                  <Label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                    费用金额
                  </Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={item.feeAmount ?? ''}
                    onChange={e =>
                      handleUpdateFeeItem(
                        index,
                        'feeAmount',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    disabled={disabled}
                  />
                </div>

                {/* 备注 */}
                <div className="col-span-3">
                  <Label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                    备注
                  </Label>
                  <Input
                    className="mt-1"
                    placeholder="选填"
                    value={item.remarks || ''}
                    onChange={e =>
                      handleUpdateFeeItem(index, 'remarks', e.target.value)
                    }
                    disabled={disabled}
                  />
                </div>

                {/* 删除按钮 */}
                <div className="col-span-1 flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFeeItem(index)}
                    disabled={disabled}
                    className="text-[hsl(var(--color-error))] hover:bg-[hsl(var(--color-error))]/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* 费用合计 */}
            <div className="flex items-center justify-end gap-2 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] p-3">
              <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                额外费用合计：
              </span>
              <span className="text-lg font-bold text-[hsl(var(--color-primary))]">
                {formatCurrency(totalFees)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);
