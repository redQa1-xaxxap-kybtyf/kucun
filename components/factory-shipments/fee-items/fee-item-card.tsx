/**
 * FeeItem Card - 单个费用项卡片组件
 *
 * 核心功能:
 * - 集成 React Hook Form 的 FormField
 * - 自动处理验证和错误提示
 * - 费用类型变更时自动更新承担方
 * - 支持费用供应商选择（如物流公司）
 * - 完整的可访问性支持
 */

'use client';

import { Trash2 } from 'lucide-react';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FACTORY_SHIPMENT_FEE_PAID_BY_OPTIONS as FEE_PAID_BY_OPTIONS,
  FACTORY_SHIPMENT_FEE_TYPE_LABELS as FEE_TYPE_LABELS,
  FACTORY_SHIPMENT_FEE_TYPE_OPTIONS as FEE_TYPE_OPTIONS,
  getDefaultFactoryShipmentFeePaidBy as getDefaultFeePaidBy,
} from '@/lib/types/factory-shipment-fee';
import { isFactoryShipmentFeeType } from '@/lib/types/unified-fee';

import { useFeeItemsContext } from './fee-items-context';

interface FeeItemCardProps {
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: any;
}

/**
 * 单个费用项卡片组件
 *
 * 包含所有表单字段:
 * - 费用类型选择器
 * - 费用名称输入框
 * - 费用金额输入框
 * - 承担方选择器
 * - 费用供应商选择器（可选，如物流公司）
 * - 备注输入框
 * - 删除按钮
 */
// eslint-disable-next-line max-lines-per-function
export function FeeItemCard({ index }: FeeItemCardProps) {
  const { control, setValue, watch } = useFormContext();
  const { remove, isDisabled } = useFeeItemsContext();

  // 监听费用类型变化,自动更新承担方
  const rawFeeType = watch(`feeItems.${index}.feeType`);
  const feeType = isFactoryShipmentFeeType(rawFeeType) ? rawFeeType : undefined;
  const placeholderType = feeType ?? 'other';

  React.useEffect(() => {
    if (feeType) {
      const defaultPaidBy = getDefaultFeePaidBy(feeType);
      setValue(`feeItems.${index}.paidBy`, defaultPaidBy);
    }
  }, [feeType, index, setValue]);

  return (
    <div
      className="grid grid-cols-12 gap-3 rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-card))] p-4"
      role="listitem"
    >
      {/* 费用类型 */}
      <div className="col-span-2">
        <FormField
          control={control}
          name={`feeItems.${index}.feeType`}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>费用类型</FormLabel>
              <Select
                onValueChange={value => {
                  // 更新费用类型
                  field.onChange(value);
                  // 同步更新费用名称为对应类型的默认名称
                  if (isFactoryShipmentFeeType(value)) {
                    setValue(
                      `feeItems.${index}.feeName`,
                      FEE_TYPE_LABELS[value]
                    );
                  }
                }}
                value={field.value}
                disabled={isDisabled}
              >
                <FormControl>
                  <SelectTrigger id={field.name} aria-label="选择费用类型">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FEE_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 费用名称 */}
      <div className="col-span-2">
        <FormField
          control={control}
          name={`feeItems.${index}.feeName`}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>费用名称</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={`如: ${FEE_TYPE_LABELS[placeholderType]}`}
                  disabled={isDisabled}
                  aria-label="输入费用名称"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 费用金额 */}
      <div className="col-span-2">
        <FormField
          control={control}
          name={`feeItems.${index}.feeAmount`}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>费用金额</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id={field.name}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  disabled={isDisabled}
                  aria-label="输入费用金额"
                  onChange={e => {
                    const value = parseFloat(e.target.value);
                    field.onChange(isNaN(value) ? 0 : value);
                  }}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* ⭐ 承担方 (新增字段) */}
      <div className="col-span-2">
        <FormField
          control={control}
          name={`feeItems.${index}.paidBy`}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>承担方</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isDisabled}
              >
                <FormControl>
                  <SelectTrigger id={field.name} aria-label="选择费用承担方">
                    <SelectValue placeholder="选择承担方" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FEE_PAID_BY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 费用供应商（可选，如物流公司） */}
      <div className="col-span-2">
        <FormField
          control={control}
          name={`feeItems.${index}.supplierId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>费用供应商</FormLabel>
              <FormControl>
                <SupplierSelector
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  placeholder="选择供应商（可选）"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 备注 */}
      <div className="col-span-1">
        <FormField
          control={control}
          name={`feeItems.${index}.remarks`}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>备注</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="选填"
                  disabled={isDisabled}
                  aria-label="输入备注"
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 删除按钮 */}
      <div className="col-span-1 flex items-start pt-8">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => remove(index)}
          disabled={isDisabled}
          className="text-[hsl(var(--color-error))] hover:bg-[hsl(var(--color-error))]/10"
          aria-label={`删除第 ${index + 1} 个费用项`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
