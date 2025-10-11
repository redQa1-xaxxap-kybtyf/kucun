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
    <div className="grid grid-cols-1 gap-6">
      {/* 产品描述 */}
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>产品描述</FormLabel>
            <FormControl>
              <Textarea
                placeholder="输入产品描述"
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
