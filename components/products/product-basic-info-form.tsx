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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
} from '@/lib/types/product';
import type {
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';

interface ProductBasicInfoFormProps {
  control: Control<ProductCreateFormData | ProductUpdateFormData>;
  isLoading: boolean;
}

export function ProductBasicInfoForm({
  control,
  isLoading,
}: ProductBasicInfoFormProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* 产品编码 */}
      <FormField
        control={control}
        name="code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>产品编码</FormLabel>
            <FormControl>
              <Input
                placeholder="请输入产品编码"
                disabled={isLoading}
                {...field}
              />
            </FormControl>
            <FormDescription>
              产品的唯一标识码，用于系统内部识别
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 产品名称 */}
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>产品名称</FormLabel>
            <FormControl>
              <Input
                placeholder="请输入产品名称"
                disabled={isLoading}
                {...field}
              />
            </FormControl>
            <FormDescription>产品的显示名称</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 产品规格 */}
      <FormField
        control={control}
        name="specification"
        render={({ field }) => (
          <FormItem>
            <FormLabel>产品规格</FormLabel>
            <FormControl>
              <Input
                placeholder="如：600x600mm"
                disabled={isLoading}
                {...field}
              />
            </FormControl>
            <FormDescription>产品的规格描述</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 计量单位 */}
      <FormField
        control={control}
        name="unit"
        render={({ field }) => (
          <FormItem>
            <FormLabel>计量单位</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value || ''}
              disabled={isLoading}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="选择计量单位" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(PRODUCT_UNIT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>产品的销售计量单位</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 产品状态 */}
      <FormField
        control={control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>产品状态</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value || ''}
              disabled={isLoading}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>停用的产品将不能创建新的销售订单</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
