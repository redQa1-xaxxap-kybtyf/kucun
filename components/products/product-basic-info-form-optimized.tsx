'use client';

import { useQuery } from '@tanstack/react-query';
import type { Control } from 'react-hook-form';

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
import { categoryQueryKeys, getCategories } from '@/lib/api/categories';
import { PRODUCT_STATUS_LABELS } from '@/lib/types/product';
import type {
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';

type ProductFormControl = Control<
  ProductCreateFormData | ProductUpdateFormData
>;

interface ProductBasicInfoFormProps {
  control: ProductFormControl;
  isLoading: boolean;
  isCreateMode?: boolean;
}

/**
 * 优化版产品基础信息表单
 *
 * 优化要点:
 * 1. 移除冗余的FormDescription,只保留必要提示
 * 2. 优化placeholder文案,减少重复信息
 * 3. 必填标记更清晰
 * 4. 字段顺序优化:编码->规格->分类->名称->厚度->状态
 */
export function ProductBasicInfoFormOptimized({
  control,
  isLoading,
  isCreateMode: _isCreateMode = false,
}: ProductBasicInfoFormProps) {
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: categoryQueryKeys.options(),
      queryFn: () => getCategories({ status: 'active', limit: 100 }),
      staleTime: 5 * 60 * 1000,
    }
  );
  const categoryOptions = categoriesResponse?.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* 产品编码 */}
      <FormField
        control={control}
        name="code"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              产品编码
              <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="输入产品编码"
                disabled={isLoading}
                maxLength={50}
                {...field}
              />
            </FormControl>
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
            <FormLabel className="flex items-center gap-1">
              产品规格
              <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="如:600x600mm"
                disabled={isLoading}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 产品分类 */}
      <FormField
        control={control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              产品分类
              <span className="text-destructive">*</span>
            </FormLabel>
            <Select
              onValueChange={field.onChange}
              value={
                field.value === ''
                  ? 'uncategorized'
                  : (field.value ?? 'uncategorized')
              }
              disabled={isLoading || isCategoriesLoading}
              name={field.name}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="uncategorized">无分类</SelectItem>
                {categoryOptions.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name={field.name}
              value={
                field.value === ''
                  ? 'uncategorized'
                  : (field.value ?? 'uncategorized')
              }
            />
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
                placeholder="可选,留空则使用编码"
                disabled={isLoading}
                maxLength={100}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 厚度 */}
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
            <FormLabel>状态</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || undefined}
              disabled={isLoading}
              name={field.name}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
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
            <input type="hidden" name={field.name} value={field.value || ''} />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
