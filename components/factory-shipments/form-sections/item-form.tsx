'use client';

import { Minus } from 'lucide-react';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { SupplierPriceSelector } from '@/components/factory-shipments/supplier-price-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getLatestPrice } from '@/hooks/use-price-history';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface ItemFormProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  index: number;
  products: Product[];
  canRemove: boolean;
  onRemove: () => void;
  selectedCustomerId: string;
  customerPriceHistoryData?: PriceHistoryData;
}

/**
 * 厂家发货订单商品明细表单
 * 单个商品的表单项
 * 使用 React.memo 优化性能，避免不必要的重新渲染
 */
export const ItemForm = React.memo<ItemFormProps>(
  ({
    form,
    index,
    products,
    canRemove,
    onRemove,
    selectedCustomerId,
    customerPriceHistoryData,
  }) => {
    const { toast } = useToast();

    return (
      <Card className="border-2 border-dashed border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/30 shadow-sm transition-all duration-200 hover:border-[hsl(var(--color-primary))]/40 hover:shadow-md">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))]/10 text-[hsl(var(--color-primary))]">
                <span className="text-sm font-bold">{index + 1}</span>
              </div>
              <h4 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                商品 {index + 1}
              </h4>
            </div>
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                title="删除商品"
                className="h-8 w-8 rounded-lg text-[hsl(var(--color-error))] transition-all duration-200 hover:bg-[hsl(var(--color-error))]/10 hover:text-[hsl(var(--color-error))]"
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="space-y-5">
            {/* 第一行：商品搜索（全宽） */}
            <div className="w-full">
              <IntelligentProductInput
                form={form}
                index={index}
                products={products}
                onProductChange={product => {
                  if (product && selectedCustomerId && product.code) {
                    // 自动填充客户历史价格（基于产品编码匹配）
                    const customerPrice = getLatestPrice(
                      customerPriceHistoryData?.data,
                      product.code,
                      'FACTORY'
                    );
                    if (customerPrice !== undefined) {
                      form.setValue(`items.${index}.unitPrice`, customerPrice);
                      toast({
                        title: '已自动填充客户历史价格',
                        description: `产品编码 "${product.code}" 的上次厂家发货价格：¥${customerPrice.toFixed(2)}`,
                        duration: 2000,
                      });
                    }
                  }
                }}
              />
            </div>

            {/* 归属信息 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name={`items.${index}.ownership`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      货物归属{' '}
                      <span className="text-[hsl(var(--color-error))]">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20">
                          <SelectValue placeholder="请选择归属" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer">
                          客户货（需收款）
                        </SelectItem>
                        <SelectItem value="self">自用补货（入库）</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.ownershipRemarks`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      归属备注
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如自用用途、客户要求"
                        className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 第二行：供应商、规格、重量 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* 供应商选择（带价格自动填充） */}
              <FormField
                control={form.control}
                name={`items.${index}.supplierId`}
                render={({ field }) => (
                  <SupplierPriceSelector
                    form={form}
                    index={index}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              {/* 规格 */}
              <FormField
                control={form.control}
                name={`items.${index}.specification`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      规格
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入规格"
                        className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 重量 */}
              <FormField
                control={form.control}
                name={`items.${index}.weight`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      重量（kg）
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="请输入重量"
                        className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e =>
                          field.onChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 第三行：数量、单价、单位 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* 数量 */}
              <FormField
                control={form.control}
                name={`items.${index}.quantity`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      数量{' '}
                      <span className="text-[hsl(var(--color-error))]">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="请输入数量"
                        className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                        {...field}
                        onChange={e =>
                          field.onChange(
                            e.target.value ? parseFloat(e.target.value) : 0
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 单价 */}
              <FormField
                control={form.control}
                name={`items.${index}.unitPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      单价（¥）{' '}
                      <span className="text-[hsl(var(--color-error))]">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="请输入单价"
                        className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                        {...field}
                        onChange={e =>
                          field.onChange(
                            e.target.value ? parseFloat(e.target.value) : 0
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 单位 */}
              <FormField
                control={form.control}
                name={`items.${index}.unit`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      单位{' '}
                      <span className="text-[hsl(var(--color-error))]">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如：件、箱、吨"
                        className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 第四行：备注 */}
            <FormField
              control={form.control}
              name={`items.${index}.remarks`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    备注
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入备注信息"
                      className="resize-none transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                      rows={2}
                      {...field}
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
);
