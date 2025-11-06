'use client';

import { Package, Plus, Trash2 } from 'lucide-react';
import React, { useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { SupplierPriceSelector } from '@/components/factory-shipments/supplier-price-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { getLatestPrice } from '@/hooks/use-price-history';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface ItemsTableProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  products: Product[];
  selectedCustomerId: string;
  customerPriceHistoryData?: PriceHistoryData;
  fields: Array<{ id: string }>;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

/**
 * 厂家发货订单产品明细表格
 * 使用表格形式展示和编辑产品明细，提高数据录入效率
 */
export const ItemsTable = React.memo<ItemsTableProps>(
  ({
    form,
    products,
    selectedCustomerId,
    customerPriceHistoryData,
    fields,
    onAddItem,
    onRemoveItem,
  }) => {
    const { toast } = useToast();

    // 计算单个明细的金额
    const calculateItemAmount = (index: number): number => {
      const quantity = form.watch(`items.${index}.quantity`) || 0;
      const unitPrice = form.watch(`items.${index}.unitPrice`) || 0;
      return quantity * unitPrice;
    };

    // 使用 useCallback 稳定回调函数
    const handleProductChange = useCallback(
      (index: number) => (product: Product | null) => {
        if (product && selectedCustomerId && product.code) {
          // 自动填充产品编码
          form.setValue(`items.${index}.productCode`, product.code);

          // 自动填充产品名称
          form.setValue(`items.${index}.displayName`, product.name || '');

          // 自动填充客户历史价格
          const customerPrice = getLatestPrice(
            customerPriceHistoryData?.data,
            product.code,
            'FACTORY'
          );
          if (customerPrice !== undefined) {
            form.setValue(`items.${index}.unitPrice`, customerPrice);
            toast({
              title: '已自动填充',
              description: `产品编码、产品名称和历史价格已自动填充`,
              duration: 2000,
            });
          } else {
            toast({
              title: '已自动填充',
              description: `产品编码和产品名称已自动填充`,
              duration: 2000,
            });
          }
        }
      },
      [form, selectedCustomerId, customerPriceHistoryData, toast]
    );

    return (
      <div className="space-y-4">
        {/* 表头 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4" />
            产品明细
          </div>
          <Button
            type="button"
            onClick={onAddItem}
            size="sm"
            variant="outline"
            className="h-8"
          >
            <Plus className="mr-1 h-3 w-3" />
            添加产品
          </Button>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px] border-r">序号</TableHead>
                <TableHead className="min-w-[200px] border-r">
                  产品编码 *
                </TableHead>
                <TableHead className="min-w-[200px] border-r">
                  产品名称 *
                </TableHead>
                <TableHead className="min-w-[180px] border-r">
                  供应商 *
                </TableHead>
                <TableHead className="min-w-[150px] border-r">规格</TableHead>
                <TableHead className="w-[100px] border-r text-right">
                  数量 *
                </TableHead>
                <TableHead className="w-[80px] border-r">单位</TableHead>
                <TableHead className="w-[120px] border-r text-right">
                  单价 *
                </TableHead>
                <TableHead className="w-[120px] border-r text-right">
                  金额
                </TableHead>
                <TableHead className="w-[120px] border-r">归属 *</TableHead>
                <TableHead className="min-w-[150px] border-r">
                  归属备注
                </TableHead>
                <TableHead className="min-w-[150px] border-r">备注</TableHead>
                <TableHead className="w-[80px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center">
                    <div className="text-muted-foreground flex flex-col items-center gap-2">
                      <Package className="h-8 w-8" />
                      <p>暂无产品明细，请点击「添加产品」开始填写</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field, index) => (
                  <TableRow key={field.id} className="hover:bg-muted/30">
                    {/* 序号 */}
                    <TableCell className="border-r text-center font-medium">
                      {index + 1}
                    </TableCell>

                    {/* 产品编码（智能选择器） */}
                    <TableCell className="border-r p-2">
                      <IntelligentProductInput
                        form={form}
                        index={index}
                        products={products}
                        onProductChange={handleProductChange(index)}
                        placeholder="搜索产品或添加临时产品"
                      />
                    </TableCell>

                    {/* 产品名称 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.displayName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="产品名称"
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 供应商 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.supplierId`}
                        render={({ field }) => (
                          <SupplierPriceSelector
                            form={form}
                            index={index}
                            value={field.value}
                            onChange={field.onChange}
                            showLabel={false}
                          />
                        )}
                      />
                    </TableCell>

                    {/* 规格 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.specification`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="规格"
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 数量 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                onChange={e =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="数量"
                                className="h-8 text-right text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 单位 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select
                                value={field.value || '片'}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="片">片</SelectItem>
                                  <SelectItem value="件">件</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 单价 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                onChange={e =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="单价"
                                className="h-8 text-right text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 金额（自动计算） */}
                    <TableCell className="border-r p-2 text-right font-medium">
                      <span className="text-xs">
                        ￥{calculateItemAmount(index).toFixed(2)}
                      </span>
                    </TableCell>

                    {/* 归属 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.ownership`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select
                                value={field.value || 'customer'}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="customer">客户</SelectItem>
                                  <SelectItem value="self">自有</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 归属备注 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.ownershipRemarks`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="归属备注"
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 备注 */}
                    <TableCell className="border-r p-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.remarks`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="备注"
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="p-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(index)}
                        disabled={fields.length === 1}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
);

ItemsTable.displayName = 'ItemsTable';
