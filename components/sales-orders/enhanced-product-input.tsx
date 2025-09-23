'use client';

import { Package, PenTool } from 'lucide-react';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Product } from '@/lib/types/product';

import { EnhancedProductSelector } from './enhanced-product-selector';

import type { CreateSalesOrderData } from '@/lib/schemas/sales-order';

interface EnhancedProductInputProps {
  form: UseFormReturn<CreateSalesOrderData>;
  index: number;
  products: Product[];
  isTransferSale?: boolean;
  onProductChange?: (product: Product | null) => void;
}

// 常用单位选项
const UNIT_OPTIONS = [
  { value: '片', label: '片' },
  { value: '件', label: '件' },
  { value: '平方米', label: '平方米' },
  { value: '米', label: '米' },
  { value: '公斤', label: '公斤' },
  { value: '吨', label: '吨' },
];

/**
 * 增强的产品输入组件
 * 支持库存选择和手动输入两种模式
 */
export function EnhancedProductInput({
  form,
  index,
  products,
  isTransferSale = false,
  onProductChange,
}: EnhancedProductInputProps) {
  const [inputMode, setInputMode] = React.useState<'inventory' | 'manual'>(
    'inventory'
  );

  // 监听手动输入模式的变化
  const isManualProduct = form.watch(`items.${index}.isManualProduct`);

  React.useEffect(() => {
    if (isManualProduct !== undefined) {
      setInputMode(isManualProduct ? 'manual' : 'inventory');
    }
  }, [isManualProduct]);

  // 切换输入模式
  const handleModeChange = (mode: 'inventory' | 'manual') => {
    setInputMode(mode);
    const isManual = mode === 'manual';

    // 更新表单状态
    form.setValue(`items.${index}.isManualProduct`, isManual);

    if (isManual) {
      // 切换到手动输入模式，清空产品相关字段
      form.setValue(`items.${index}.productId`, '');
      onProductChange?.(null);
    } else {
      // 切换到库存选择模式，清空手动输入字段
      form.setValue(`items.${index}.manualProductName`, '');
      form.setValue(`items.${index}.manualSpecification`, '');
      form.setValue(`items.${index}.manualWeight`, undefined);
      form.setValue(`items.${index}.manualUnit`, '');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">产品信息</CardTitle>
            <CardDescription className="text-xs">
              {isTransferSale
                ? '选择库存商品或手动输入临时商品'
                : '选择库存商品'}
            </CardDescription>
          </div>
          {isTransferSale && (
            <div className="flex gap-1">
              <Button
                type="button"
                variant={inputMode === 'inventory' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('inventory')}
                className="h-7 px-2 text-xs"
              >
                <Package className="mr-1 h-3 w-3" />
                库存选择
              </Button>
              <Button
                type="button"
                variant={inputMode === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('manual')}
                className="h-7 px-2 text-xs"
              >
                <PenTool className="mr-1 h-3 w-3" />
                手动输入
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {inputMode === 'inventory' ? (
          // 库存选择模式
          <div className="space-y-3">
            <FormField
              control={form.control}
              name={`items.${index}.productId`}
              render={({ field }) => (
                <FormItem>
                  <Label className="text-xs">选择商品</Label>
                  <FormControl>
                    <EnhancedProductSelector
                      products={products}
                      value={field.value || ''}
                      onValueChange={value => {
                        field.onChange(value);
                        const product = products.find(p => p.id === value);
                        if (product) {
                          // 自动填充产品信息（不包括价格，价格需要用户手动输入）
                          form.setValue(
                            `items.${index}.specification`,
                            product.specification || ''
                          );
                          form.setValue(
                            `items.${index}.unit`,
                            product.unit || ''
                          );
                          form.setValue(
                            `items.${index}.piecesPerUnit`,
                            product.piecesPerUnit || undefined
                          );
                          onProductChange?.(product);
                        } else {
                          onProductChange?.(null);
                        }
                      }}
                      placeholder="搜索并选择商品"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {isTransferSale && (
              <div className="rounded-md bg-blue-50 p-2">
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-blue-600" />
                  <span className="text-xs text-blue-700">
                    库存选择模式：从现有商品库存中选择
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          // 手动输入模式
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`items.${index}.manualProductName`}
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-xs">
                      商品名称 <span className="text-red-500">*</span>
                    </Label>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="输入商品名称"
                        className="h-8 text-xs"
                        maxLength={100}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.manualSpecification`}
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-xs">规格</Label>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="输入规格"
                        className="h-8 text-xs"
                        maxLength={200}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`items.${index}.manualWeight`}
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-xs">重量</Label>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="输入重量"
                        className="h-8 text-xs"
                        value={field.value || ''}
                        onChange={e => {
                          const value = e.target.value;
                          field.onChange(
                            value === '' ? undefined : Number(value)
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.manualUnit`}
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-xs">单位</Label>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="选择单位" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-md bg-amber-50 p-2">
              <div className="flex items-center gap-1">
                <PenTool className="h-3 w-3 text-amber-600" />
                <span className="text-xs text-amber-700">
                  手动输入模式：输入临时商品信息，不会保存到商品库存
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
