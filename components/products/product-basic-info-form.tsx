'use client';

import { useQuery } from '@tanstack/react-query';
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
import { categoryQueryKeys, getCategories } from '@/lib/api/categories';
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
} from '@/lib/types/product';
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
          <FormLabel>产品编码</FormLabel>
          <FormControl>
            <Input
              placeholder="请输入产品编码"
              disabled={disabled}
              maxLength={50}
              {...field}
            />
          </FormControl>
          <FormDescription>产品的唯一标识码，用于系统内部识别</FormDescription>
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
              placeholder="请输入产品名称"
              disabled={disabled}
              maxLength={100}
              {...field}
            />
          </FormControl>
          <FormDescription>产品的显示名称</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ProductCategorySelect({
  control,
  disabled,
}: {
  control: ProductFormControl;
  disabled: boolean;
}) {
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: categoryQueryKeys.options(),
      queryFn: () => getCategories({ status: 'active', limit: 100 }),
      staleTime: 5 * 60 * 1000,
    }
  );
  const categoryOptions = categoriesResponse?.data ?? [];

  return (
    <FormField
      control={control}
      name="categoryId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品分类</FormLabel>
          <Select
            onValueChange={field.onChange}
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
                <SelectValue placeholder="请选择产品分类" />
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
          {/* 添加隐藏的 input 来确保表单数据包含此字段 */}
          <input
            type="hidden"
            name={field.name}
            value={
              field.value === ''
                ? 'uncategorized'
                : (field.value ?? 'uncategorized')
            }
          />
          <FormDescription>未选择时默认为“无分类”</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ProductUnitSelect({
  control,
  disabled,
  isCreateMode = false,
}: {
  control: ProductFormControl;
  disabled: boolean;
  isCreateMode?: boolean;
}) {
  return (
    <FormField
      control={control}
      name="unit"
      render={({ field }) => (
        <FormItem>
          <FormLabel>计量单位</FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value || undefined}
            disabled={disabled || isCreateMode}
            name={field.name}
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
          {/* 添加隐藏的 input 来确保表单数据包含此字段 */}
          <input type="hidden" name={field.name} value={field.value || ''} />
          <FormDescription>
            {isCreateMode
              ? '系统默认以"件"为单位。入库时可选择按"件"或"片"入库，系统会自动换算。'
              : '产品的销售计量单位'}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
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
          <FormLabel>产品规格</FormLabel>
          <FormControl>
            <Input placeholder="如：600x600mm" disabled={disabled} {...field} />
          </FormControl>
          <FormDescription>产品的规格描述</FormDescription>
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

export function ProductBasicInfoForm({
  control,
  isLoading,
  isCreateMode = false,
}: ProductBasicInfoFormProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ProductCodeInput control={control} disabled={isLoading} />
      <ProductNameInput control={control} disabled={isLoading} />
      <ProductCategorySelect control={control} disabled={isLoading} />
      <ProductUnitSelect
        control={control}
        disabled={isLoading}
        isCreateMode={isCreateMode}
      />
      <ProductSpecificationInput control={control} disabled={isLoading} />
      <ProductStatusSelect control={control} disabled={isLoading} />
    </div>
  );
}
