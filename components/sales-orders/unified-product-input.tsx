'use client';

import { AlertCircle, Plus } from 'lucide-react';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import type { Product } from '@/lib/types/product';
import type { CreateSalesOrderData } from '@/lib/validations/sales-order';

import { EnhancedProductSelector } from './enhanced-product-selector';

interface UnifiedProductInputProps {
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
 * 统一产品输入组件 - 中国用户友好版本
 * 采用渐进式披露设计，减少认知负担
 */
export function UnifiedProductInput({
  form,
  index,
  products,
  isTransferSale = false,
  onProductChange,
}: UnifiedProductInputProps) {
  const [showManualFields, setShowManualFields] = React.useState(false);

  // 监听产品选择状态
  const selectedProductId = form.watch(`items.${index}.productId`);
  const manualProductName = form.watch(`items.${index}.manualProductName`);
  const isManualProduct = form.watch(`items.${index}.isManualProduct`);

  // 智能检测：如果用户开始输入商品名称，自动切换到手动模式
  React.useEffect(() => {
    if (manualProductName && manualProductName.trim() !== '') {
      if (!isManualProduct) {
        form.setValue(`items.${index}.isManualProduct`, true);
        form.setValue(`items.${index}.productId`, '');
        onProductChange?.(null);
      }
    }
  }, [manualProductName, isManualProduct, form, index, onProductChange]);

  // 处理库存商品选择
  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      // 清空手动输入字段
      form.setValue(`items.${index}.isManualProduct`, false);
      form.setValue(`items.${index}.manualProductName`, '');
      form.setValue(`items.${index}.manualSpecification`, '');
      form.setValue(`items.${index}.manualWeight`, undefined);
      form.setValue(`items.${index}.manualUnit`, '');

      // 自动填充产品信息
      form.setValue(
        `items.${index}.specification`,
        product.specification || ''
      );
      form.setValue(`items.${index}.unit`, product.unit || '');
      form.setValue(
        `items.${index}.piecesPerUnit`,
        product.piecesPerUnit || undefined
      );

      onProductChange?.(product);
      setShowManualFields(false);
    }
  };

  // 显示手动输入字段
  const handleShowManualFields = () => {
    setShowManualFields(true);
    // 清空库存商品选择
    form.setValue(`items.${index}.productId`, '');
    form.setValue(`items.${index}.isManualProduct`, true);
    onProductChange?.(null);
  };

  return (
    <div className="space-y-3">
      {/* 主要产品选择区域 */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">商品信息</Label>

        {/* 库存商品选择 */}
        <FormField
          control={form.control}
          name={`items.${index}.productId`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <EnhancedProductSelector
                  products={products}
                  value={field.value || ''}
                  onValueChange={value => {
                    field.onChange(value);
                    handleProductSelect(value);
                  }}
                  placeholder="搜索并选择商品，或在下方手动输入"
                  className="h-8 text-xs"
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        {/* 分隔线和提示 */}
        {isTransferSale && !selectedProductId && (
          <div className="flex items-center gap-2 py-1">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">或</span>
            <Separator className="flex-1" />
          </div>
        )}
      </div>

      {/* 手动输入区域 - 渐进式显示 */}
      {isTransferSale && (
        <div className="space-y-3">
          {!showManualFields && !selectedProductId ? (
            // 显示手动输入入口
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShowManualFields}
              className="h-8 w-full border-dashed text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              手动输入临时商品信息
            </Button>
          ) : showManualFields || manualProductName ? (
            // 手动输入字段
            <div className="space-y-3 rounded-md border border-dashed border-amber-200 bg-amber-50/30 p-3">
              <div className="mb-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">
                  临时商品信息
                </span>
                <Badge variant="outline" className="text-xs">
                  不会保存到商品库
                </Badge>
              </div>

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

              {/* 收起按钮 */}
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowManualFields(false);
                    // 清空手动输入字段
                    form.setValue(`items.${index}.isManualProduct`, false);
                    form.setValue(`items.${index}.manualProductName`, '');
                    form.setValue(`items.${index}.manualSpecification`, '');
                    form.setValue(`items.${index}.manualWeight`, undefined);
                    form.setValue(`items.${index}.manualUnit`, '');
                  }}
                  className="text-muted-foreground h-6 px-2 text-xs"
                >
                  收起
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
