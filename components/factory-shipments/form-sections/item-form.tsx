'use client';

import { Minus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getLatestPrice } from '@/hooks/use-price-history';
import type { CreateFactoryShipmentOrderData } from '@/lib/schemas/factory-shipment';
import type { Product } from '@/lib/types/product';

import type { PriceHistoryData } from '@/lib/types/price-history';

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
 */
export function ItemForm({
  form,
  index,
  products,
  canRemove,
  onRemove,
  selectedCustomerId,
  customerPriceHistoryData,
}: ItemFormProps) {
  const { toast } = useToast();

  return (
    <Card className="border-dashed">
      <CardContent className="pt-4">
        <div className="mb-4 flex items-start justify-between">
          <h4 className="text-sm font-medium">商品 {index + 1}</h4>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              title="删除商品"
            >
              <Minus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* 第一行：商品和供应商 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 商品选择 */}
            <div>
              <IntelligentProductInput
                form={form}
                index={index}
                products={products}
                onProductChange={product => {
                  if (product && selectedCustomerId) {
                    // 自动填充客户历史价格（厂家发货价格）
                    const customerPrice = getLatestPrice(
                      customerPriceHistoryData?.data,
                      product.id,
                      'FACTORY'
                    );
                    if (customerPrice !== undefined) {
                      form.setValue(`items.${index}.unitPrice`, customerPrice);
                      toast({
                        title: '已自动填充客户历史价格',
                        description: `产品 "${product.name}" 的上次厂家发货价格：¥${customerPrice.toFixed(2)}`,
                        duration: 2000,
                      });
                    }
                  }
                }}
              />
            </div>

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
          </div>

          {/* 第二行：数量、单价、单位 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* 数量 */}
            <FormField
              control={form.control}
              name={`items.${index}.quantity`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    数量 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="请输入数量"
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
                  <FormLabel>
                    单价（¥） <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="请输入单价"
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
                  <FormLabel>
                    单位 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="如：件、箱、吨" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 第三行：规格、重量 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 规格 */}
            <FormField
              control={form.control}
              name={`items.${index}.specification`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>规格</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入规格" {...field} />
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
                  <FormLabel>重量（kg）</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="请输入重量"
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

          {/* 第四行：备注 */}
          <FormField
            control={form.control}
            name={`items.${index}.remarks`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>备注</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="请输入备注信息"
                    className="resize-none"
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
