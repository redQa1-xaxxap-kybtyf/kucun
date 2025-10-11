'use client';

import type { Control } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import type {
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';

interface ProductDetailsFormProps {
  control: Control<ProductCreateFormData | ProductUpdateFormData>;
  isLoading: boolean;
}

/**
 * 优化版产品详细参数表单
 *
 * 优化要点:
 * 1. 移除冗余的FormDescription
 * 2. 精简placeholder文案
 */
export function ProductDetailsFormOptimized({
  control,
  isLoading,
}: ProductDetailsFormProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>产品描述</FormLabel>
            <FormControl>
              <Textarea
                placeholder="输入产品描述(可选)"
                className="min-h-[100px]"
                disabled={isLoading}
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
