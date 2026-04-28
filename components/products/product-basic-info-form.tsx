'use client';

import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useWatch, type Control } from 'react-hook-form';

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
              placeholder="可选，留空则使用分类名称"
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

  // 实时监听当前选中的分类ID（包含编辑场景下的初始值）
  const currentCategoryId = useWatch({
    control,
    name: 'categoryId',
  });

  // 当表单已经有分类值（编辑场景 / 默认值）时，也同步一次 1 级分类名称
  React.useEffect(() => {
    if (!onCategoryChange) return;

    const value =
      currentCategoryId === '' || currentCategoryId === undefined
        ? 'uncategorized'
        : currentCategoryId;

    if (value === 'uncategorized') {
      return;
    }

    const selectedCategory = categoryOptions.find(cat => cat.id === value);
    if (!selectedCategory) {
      return;
    }

    // 向上寻找 1 级分类名称
    let rootCategory: CategoryOptionWithDepth = selectedCategory;
    let safetyCounter = 0;
    while (rootCategory.parentId && safetyCounter < 5) {
      const parent = categoryOptions.find(
        cat => cat.id === rootCategory.parentId
      );
      if (!parent) {
        break;
      }
      rootCategory = parent;
      safetyCounter += 1;
    }

    onCategoryChange(value, rootCategory.name);
  }, [currentCategoryId, categoryOptions, onCategoryChange]);

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
                  // 使用 1 级分类名称，而不是当前所选的 2/3 级分类名
                  // 这样在“产品名称”为空时，可以直接复用 1 级分类名称
                  let rootCategory: CategoryOptionWithDepth = selectedCategory;
                  let safetyCounter = 0;
                  while (rootCategory.parentId && safetyCounter < 5) {
                    const parent = categoryOptions.find(
                      cat => cat.id === rootCategory.parentId
                    );
                    if (!parent) {
                      break;
                    }
                    rootCategory = parent;
                    safetyCounter += 1;
                  }
                  onCategoryChange(value, rootCategory.name);
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
