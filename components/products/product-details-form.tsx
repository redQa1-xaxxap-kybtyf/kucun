'use client';

import type { Control } from 'react-hook-form';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';

interface ProductDetailsFormProps {
  control: Control<ProductCreateFormData | ProductUpdateFormData>;
  isLoading: boolean;
}

export function ProductDetailsForm({
  control,
  isLoading,
}: ProductDetailsFormProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* 产品厚度 */}
      <FormField
        control={control}
        name="thickness"
        render={({ field }) => (
          <FormItem>
            <FormLabel>厚度 (mm)</FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                disabled={isLoading}
                {...field}
                onChange={e => {
                  const value = e.target.value;
                  field.onChange(value === '' ? undefined : Number(value));
                }}
              />
            </FormControl>
            <FormDescription>产品厚度，单位：毫米</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 产品描述 - 跨两列 */}
      <div className="md:col-span-2">
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>产品描述</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入产品描述（可选）"
                  className="min-h-[100px]"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                详细的产品描述信息，包括特性、用途等
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
