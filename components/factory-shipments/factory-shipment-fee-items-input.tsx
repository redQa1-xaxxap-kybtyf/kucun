'use client';

import { Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { SupplierSelector } from '@/components/suppliers/supplier-selector';
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
  type FactoryShipmentFeeItem,
  type FactoryShipmentFeeType,
  FACTORY_SHIPMENT_FEE_TYPE_LABELS,
  FACTORY_SHIPMENT_FEE_TYPE_OPTIONS,
} from '@/lib/types/factory-shipment-fee';
import { formatCurrency } from '@/lib/utils/format';

interface FactoryShipmentFeeItemsInputProps {
  feeItems: FactoryShipmentFeeItem[];
  onChange: (feeItems: FactoryShipmentFeeItem[]) => void;
  disabled?: boolean;
}

/**
 * 厂家发货订单费用项输入组件
 * 支持添加运费、仓储费、报关费等费用
 *
 * 遵循 KISS 原则：简单直观的费用录入界面
 * 遵循 DRY 原则：复用销售订单的费用录入逻辑
 */
export const FactoryShipmentFeeItemsInput =
  React.memo<FactoryShipmentFeeItemsInputProps>(
    ({ feeItems, onChange, disabled = false }) => {
      /**
       * 清理和规范化费用项数据
       * 确保费用名称和金额的有效性
       */
      const sanitizeFeeItems = (
        items: FactoryShipmentFeeItem[]
      ): FactoryShipmentFeeItem[] => {
        // ✅ 添加空值检查,防止运行时错误
        if (!items || !Array.isArray(items)) {
          return [];
        }

        return items.map((item, index, array) => {
          const trimmedName = item.feeName?.trim() ?? '';
          const baseLabel =
            FACTORY_SHIPMENT_FEE_TYPE_LABELS[item.feeType] ?? '费用';
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
      };

      const [localItems, setLocalItems] = useState<FactoryShipmentFeeItem[]>(
        sanitizeFeeItems(feeItems)
      );

      // 与外部受控数据保持同步，避免编辑模式下初始值不同步
      useEffect(() => {
        const sanitized = sanitizeFeeItems(feeItems);
        setLocalItems(sanitized);
      }, [feeItems]);

      const emitChange = (items: FactoryShipmentFeeItem[]) => {
        const sanitized = sanitizeFeeItems(items);
        setLocalItems(sanitized);
        onChange(sanitized);
      };

      const handleAddFeeItem = () => {
        const newItem: FactoryShipmentFeeItem = {
          feeType: 'freight', // 默认为运费（最常用）
          feeName: FACTORY_SHIPMENT_FEE_TYPE_LABELS.freight,
          feeAmount: 0,
          paidBy: 'customer', // 默认客户承担
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
        field: keyof FactoryShipmentFeeItem,
        value: string | number
      ) => {
        const updated = localItems.map((item, i) => {
          if (i === index) {
            // 当费用类型改变时，同时更新费用名称为对应的默认名称
            if (field === 'feeType') {
              const newFeeType = value as FactoryShipmentFeeType;
              return {
                ...item,
                feeType: newFeeType,
                feeName: FACTORY_SHIPMENT_FEE_TYPE_LABELS[newFeeType],
              };
            }
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
          <div className="mb-4 flex justify-end">
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
                暂无费用项目，点击上方按钮添加
              </p>
              <p className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                提示：费用将按订单项金额比例自动分摊
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {localItems.map((item, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-card))] p-4"
                >
                  <div className="grid grid-cols-12 gap-3">
                    {/* 费用类型 */}
                    <div className="col-span-3">
                      <Label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                        费用类型
                      </Label>
                      <Select
                        value={item.feeType}
                        onValueChange={(value: FactoryShipmentFeeType) =>
                          handleUpdateFeeItem(index, 'feeType', value)
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FACTORY_SHIPMENT_FEE_TYPE_OPTIONS.map(option => (
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
                        placeholder={`如：${FACTORY_SHIPMENT_FEE_TYPE_LABELS[item.feeType]}`}
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

                    {/* 费用供应商（可选，用于应付归属，如物流公司） */}
                    <div className="col-span-3">
                      <Label className="text-xs text-[hsl(var(--color-text-tertiary))]">
                        费用供应商（可选）
                      </Label>
                      <div className="mt-1">
                        <SupplierSelector
                          value={item.supplierId}
                          onValueChange={value =>
                            handleUpdateFeeItem(index, 'supplierId', value)
                          }
                          disabled={disabled}
                          placeholder="选择费用结算对象"
                        />
                      </div>
                    </div>

                    {/* 删除按钮 */}
                    <div className="col-span-1 flex items-end justify-end">
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

                  {/* 备注 */}
                  <div>
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
                </div>
              ))}

              {/* 费用合计 */}
              <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--color-border-primary))] bg-gradient-to-r from-amber-50/60 to-orange-50/40 p-4">
                <div>
                  <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                    费用合计
                  </span>
                  <p className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                    将按订单项金额比例分摊到成本中
                  </p>
                </div>
                <span className="text-xl font-bold text-amber-600">
                  {formatCurrency(totalFees)}
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }
  );

FactoryShipmentFeeItemsInput.displayName = 'FactoryShipmentFeeItemsInput';
