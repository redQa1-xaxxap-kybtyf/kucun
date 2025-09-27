/**
 * 产品表单字段组件
 * 提供可复用的产品表单字段，遵循唯一真理源原则
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { categoryQueryKeys, getCategories } from '@/lib/api/categories';
import {
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
} from '@/lib/types/product';

interface ProductFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  disabled?: boolean;
}

/**
 * 产品编码字段
 */
export function ProductCodeField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品编码 *</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="请输入产品编码"
              disabled={disabled}
              maxLength={50}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 产品名称字段
 */
export function ProductNameField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品名称 *</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="请输入产品名称"
              disabled={disabled}
              maxLength={100}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 产品规格字段
 */
export function ProductSpecificationField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品规格</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder="请输入产品规格描述"
              disabled={disabled}
              maxLength={200}
              rows={3}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 产品单位字段
 */
export function ProductUnitField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>计量单位 *</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="请选择计量单位" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {PRODUCT_UNIT_OPTIONS.map(option => (
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

/**
 * 每件片数字段
 */
export function ProductPiecesPerUnitField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>每件片数 *</FormLabel>
          <FormControl>
            <NumberInput
              {...field}
              placeholder="请输入每件片数"
              disabled={disabled}
              min={1}
              max={10000}
              step={1}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 产品重量字段
 */
export function ProductWeightField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>重量 (kg)</FormLabel>
          <FormControl>
            <NumberInput
              {...field}
              placeholder="请输入产品重量"
              disabled={disabled}
              min={0}
              max={10000}
              step={0.01}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 产品厚度字段
 */
export function ProductThicknessField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>厚度 (mm)</FormLabel>
          <FormControl>
            <NumberInput
              {...field}
              placeholder="请输入产品厚度"
              disabled={disabled}
              min={0}
              max={100}
              step={0.1}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 产品状态字段
 */
export function ProductStatusField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品状态</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="请选择产品状态" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {PRODUCT_STATUS_OPTIONS.map(option => (
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

/**
 * 产品分类字段
 */
export function ProductCategoryField<T extends FieldValues>({
  control,
  name,
  disabled,
}: ProductFormFieldProps<T>) {
  const { data: categories, isLoading } = useQuery({
    queryKey: categoryQueryKeys.options(),
    queryFn: () => getCategories({ status: 'active', limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <FormField
      control={control}
      name={name}
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
            disabled={disabled || isLoading}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="请选择产品分类" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="uncategorized">无分类</SelectItem>
              {categories?.data?.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
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
