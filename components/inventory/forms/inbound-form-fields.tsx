'use client';

import { type UseFormReturn } from 'react-hook-form';

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
import { Textarea } from '@/components/ui/textarea';
import {
  type InboundFormData,
  INBOUND_REASON_OPTIONS,
  INBOUND_UNIT_OPTIONS,
} from '@/lib/types/inbound';

interface InboundFormFieldsProps {
  form: UseFormReturn<InboundFormData>;
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
              每件片数 *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="请输入每件片数"
                className="h-9"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 重量 */}
      <FormField
        control={form.control}
        name="weight"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              重量(kg) *
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="请输入重量"
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
              {INBOUND_REASON_OPTIONS.map(option => (
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
          <FormLabel className="text-sm font-semibold text-gray-900">
            单位成本（元） *
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="请输入单位成本"
              className="h-9"
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function InboundOptionalFields({ form }: InboundFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 批次号 */}
      <FormField
        control={form.control}
        name="batchNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-600">
              批次号
            </FormLabel>
            <FormControl>
              <Input
                placeholder="请输入批次号（可选）"
                className="h-9"
                {...field}
              />
            </FormControl>
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
