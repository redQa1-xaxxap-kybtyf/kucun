'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import {
  FormControl,
  FormDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { can } from '@/lib/auth/permissions';
import {
  type InboundFormData,
  INBOUND_REASON_OPTIONS,
  INBOUND_UNIT_OPTIONS,
} from '@/lib/types/inbound';

// ✅ 修复: 使用泛型参数以兼容 standardSchemaResolver
interface InboundFormFieldsProps {
  form: UseFormReturn<InboundFormData, any, any>;
}

export function InboundQuantityFields({ form }: InboundFormFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 入库数量 */}
      <FormField
        control={form.control}
        name="inputQuantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              入库数量 *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="请输入数量"
                className="h-9"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 入库单位 */}
      <FormField
        control={form.control}
        name="inputUnit"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              入库单位 *
            </FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择单位" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {INBOUND_UNIT_OPTIONS.map(option => (
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

      {/* 最终片数 */}
      <FormField
        control={form.control}
        name="quantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-600">
              最终片数
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                readOnly
                className="bg-muted h-9"
                name={field.name}
                ref={field.ref}
                value={field.value && field.value > 0 ? field.value : ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function InboundSpecificationFields({ form }: InboundFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 每件片数 */}
      <FormField
        control={form.control}
        name="piecesPerUnit"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              装箱数 *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="请输入装箱数"
                className="h-9"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 每件重量 */}
      <FormField
        control={form.control}
        name="weight"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-black text-slate-700">
              每件重量 (kg) *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="请输入每件重量"
                className="h-9"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function InboundReasonField({ form }: InboundFormFieldsProps) {
  const { data: session } = useSession();
  const user = session?.user;

  // 根据用户权限过滤入库原因选项
  const availableReasons = useMemo(() => {
    // 如果用户没有期初库存权限，过滤掉 opening_balance
    if (!user || !can(user, 'inventory:opening_balance')) {
      return INBOUND_REASON_OPTIONS.filter(r => r.value !== 'opening_balance');
    }

    return INBOUND_REASON_OPTIONS;
  }, [user]);

  return (
    <FormField
      control={form.control}
      name="reason"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-semibold text-gray-900">
            入库原因 *
          </FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择入库原因" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {availableReasons.map(option => (
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
  );
}

export function InboundCostField({ form }: InboundFormFieldsProps) {
  return (
    <FormField
      control={form.control}
      name="unitCost"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-black text-slate-700">
            单位成本 (元/片) *
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="请输入每片成本"
              className="h-9"
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormDescription className="text-xs text-gray-500">
            请填写每片的成本。例如：每件100元，装箱数10，则单位成本为10元
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// 供应商选择字段
export function InboundSupplierField({ form }: InboundFormFieldsProps) {
  const currentReason = form.watch('reason');
  const isRequired = currentReason !== 'opening_balance';

  return (
    <FormField
      control={form.control}
      name="supplierId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-semibold text-gray-900">
            供应商
            {isRequired && (
              <span className="ml-0.5 align-middle text-red-500">*</span>
            )}
          </FormLabel>
          <FormControl>
            <SupplierSelector
              value={field.value}
              onValueChange={field.onChange}
              placeholder="请选择供应商"
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// 总价显示字段（只读）
export function InboundTotalCostField({ form }: InboundFormFieldsProps) {
  const watchedQuantity = form.watch('quantity');
  const watchedUnitCost = form.watch('unitCost');

  const totalCost = useMemo(() => {
    if (!watchedQuantity || !watchedUnitCost) return 0;
    return watchedQuantity * watchedUnitCost;
  }, [watchedQuantity, watchedUnitCost]);

  return (
    <FormField
      control={form.control}
      name="totalCost"
      render={() => (
        <FormItem>
          <FormLabel className="text-sm font-black text-slate-500">
            合规总价 (元)
          </FormLabel>
          <FormControl>
            <Input
              type="text"
              readOnly
              className="bg-muted h-9"
              value={totalCost > 0 ? `¥${totalCost.toFixed(2)}` : ''}
            />
          </FormControl>
          <FormDescription className="text-xs text-gray-500">
            自动计算：数量 × 单价
          </FormDescription>
        </FormItem>
      )}
    />
  );
}

export function InboundOptionalFields({ form }: InboundFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 批次号 - ✅ 修复：设为必填 */}
      <FormField
        control={form.control}
        name="batchNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              批次号/色号 *
            </FormLabel>
            <FormControl>
              <Input
                placeholder="请输入批次号或色号"
                className="h-9"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-xs text-gray-500">
              瓷砖行业要求：同一项目必须使用相同批次/色号
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 备注 */}
      <FormField
        control={form.control}
        name="remarks"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-600">
              备注
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="请输入备注信息（可选）"
                className="min-h-[36px] resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
