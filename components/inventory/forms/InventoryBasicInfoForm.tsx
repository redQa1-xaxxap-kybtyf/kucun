/**
 * 库存操作基础信息表单组件
 * 包含产品选择、操作类型、数量等基础字段
 */

import { Package } from 'lucide-react';
import type { Control, FieldValues, Path } from 'react-hook-form';

import { ProductSelector } from '@/components/products/product-selector';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

import { type OperationMode } from '../hooks/useInventoryOperationForm';

interface InventoryBasicInfoFormProps<T extends FieldValues> {
  control: Control<T>;
  mode: OperationMode;
  typeOptions: Array<{ value: string; label: string }>;
  isLoading: boolean;
}

export function InventoryBasicInfoForm<T extends FieldValues>({
  control,
  mode,
  typeOptions,
  isLoading,
}: InventoryBasicInfoFormProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Package className="mr-2 h-5 w-5" />
          基础信息
        </CardTitle>
        <CardDescription>选择产品和操作类型</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 操作类型 */}
          {mode !== 'adjust' && (
            <FormField
              control={control}
              name={'type' as Path<T>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>操作类型</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择操作类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typeOptions.map(option => (
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
          )}

          {/* 产品选择 */}
          <FormField
            control={control}
            name={'productId' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>产品</FormLabel>
                <FormControl>
                  <ProductSelector
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isLoading}
                    placeholder="选择产品"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 数量 */}
          <FormField
            control={control}
            name={'quantity' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>数量</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="输入数量"
                    disabled={isLoading}
                    {...field}
                    onChange={e => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 单位 */}
          <FormField
            control={control}
            name={'unit' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>单位</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：件、箱、个"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 单价 */}
          <FormField
            control={control}
            name={'unitPrice' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>单价</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="输入单价"
                    disabled={isLoading}
                    {...field}
                    onChange={e => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
