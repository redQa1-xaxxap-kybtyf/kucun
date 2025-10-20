'use client';

import { useQuery } from '@tanstack/react-query';
import React from 'react';
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
import type { ProductFormValues } from '@/hooks/use-product-form';
import { categoryQueryKeys, getCategories } from '@/lib/api/categories';
import type { Category } from '@/lib/types/category';
import { PRODUCT_STATUS_LABELS } from '@/lib/types/product';

type ProductFormControl = Control<ProductFormValues>;

interface ProductBasicInfoFormProps {
  control: ProductFormControl;
  isLoading: boolean;
  isCreateMode?: boolean;
  onCategoryChange?: (categoryId: string, categoryName: string) => void;
}

function ProductCodeInput({
  control,
  disabled,
}: {
  control: ProductFormControl;
  disabled: boolean;
}) {
  return (
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
              disabled={disabled}
              maxLength={50}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ProductNameInput({
  control,
  disabled,
}: {
  control: ProductFormControl;
  disabled: boolean;
}) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品名称</FormLabel>
          <FormControl>
            <Input
              placeholder="可选,留空则使用编码"
              disabled={disabled}
              maxLength={100}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ProductCategorySelect({
  control,
  disabled,
  onCategoryChange,
}: {
  control: ProductFormControl;
  disabled: boolean;
  onCategoryChange?: (categoryId: string, categoryName: string) => void;
}) {
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: categoryQueryKeys.options(),
      queryFn: () => getCategories({ status: 'active', limit: 100 }),
      staleTime: 30 * 1000, // 30秒 - 确保创建分类后能较快看到更新
      gcTime: 5 * 60 * 1000, // 5分钟垃圾回收时间
    }
  );

  const categoryOptions = React.useMemo(
    () => buildCategoryOptions(categoriesResponse?.data ?? []),
    [categoriesResponse?.data]
  );

  return (
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
            onValueChange={value => {
              field.onChange(value);
              if (onCategoryChange && value !== 'uncategorized') {
                const selectedCategory = categoryOptions.find(
                  cat => cat.id === value
                );
                if (selectedCategory) {
                  onCategoryChange(value, selectedCategory.name);
                }
              }
            }}
            value={
              field.value === ''
                ? 'uncategorized'
                : (field.value ?? 'uncategorized')
            }
            disabled={disabled || isCategoriesLoading}
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
                  <CategoryOptionLabel category={category} />
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
  );
}

interface CategoryOptionWithDepth extends Category {
  depth: number;
}

function buildCategoryOptions(
  categories: Category[]
): CategoryOptionWithDepth[] {
  if (categories.length === 0) {
    return [];
  }

  const byParent = new Map<string | null, Category[]>();
  categories.forEach(category => {
    const parentKey = category.parentId ?? null;
    const bucket = byParent.get(parentKey) ?? [];
    bucket.push(category);
    byParent.set(parentKey, bucket);
  });

  const result: CategoryOptionWithDepth[] = [];
  const visit = (nodes: Category[], depth: number) => {
    nodes.forEach(node => {
      result.push({ ...node, depth });
      const children = byParent.get(node.id);
      if (children && children.length > 0) {
        visit(children, Math.min(depth + 1, 3));
      }
    });
  };

  visit(byParent.get(null) ?? [], 0);

  return result;
}

function CategoryOptionLabel({
  category,
}: {
  category: CategoryOptionWithDepth;
}) {
  const indent = Math.max(0, category.depth) * 16;
  const icon = category.depth === 0 ? '📁' : '📂';

  return (
    <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
      <span className="mr-2 text-gray-400">{icon}</span>
      <span className={category.depth === 0 ? 'font-medium' : ''}>
        {category.name}
      </span>
      {category.parent && (
        <span className="ml-2 text-xs text-gray-500">
          · {category.parent.name}
        </span>
      )}
    </div>
  );
}

function ProductSpecificationInput({
  control,
  disabled,
}: {
  control: ProductFormControl;
  disabled: boolean;
}) {
  return (
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
            <Input placeholder="如:600x600mm" disabled={disabled} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ProductStatusSelect({
  control,
  disabled,
}: {
  control: ProductFormControl;
  disabled: boolean;
}) {
  return (
    <FormField
      control={control}
      name="status"
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品状态</FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value || undefined}
            disabled={disabled}
            name={field.name}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="请选择产品状态" />
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
          {/* 添加隐藏的 input 来确保表单数据包含此字段 */}
          <input type="hidden" name={field.name} value={field.value || ''} />
          <FormDescription>停用的产品将不能创建新的销售订单</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ProductThicknessInput({
  control,
  disabled,
}: {
  control: ProductFormControl;
  disabled: boolean;
}) {
  return (
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
              disabled={disabled}
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
  );
}

export function ProductBasicInfoForm({
  control,
  isLoading,
  isCreateMode: _isCreateMode = false,
  onCategoryChange,
}: ProductBasicInfoFormProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ProductCodeInput control={control} disabled={isLoading} />
      <ProductSpecificationInput control={control} disabled={isLoading} />
      <ProductCategorySelect
        control={control}
        disabled={isLoading}
        onCategoryChange={onCategoryChange}
      />
      <ProductNameInput control={control} disabled={isLoading} />
      <ProductThicknessInput control={control} disabled={isLoading} />
      <ProductStatusSelect control={control} disabled={isLoading} />
    </div>
  );
}
