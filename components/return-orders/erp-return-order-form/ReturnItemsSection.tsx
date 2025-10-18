/* eslint-disable max-lines-per-function */
import { Package, Plus, Trash2 } from 'lucide-react';
import React from 'react';
import type {
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormReturn,
} from 'react-hook-form';

import { MultiOrderItemSelector } from '@/components/return-orders/multi-order-item-selector';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReturnOrderItem } from '@/lib/types/return-order';
import type {
  CreateReturnOrderFormData,
  UpdateReturnOrderFormData,
} from '@/lib/validations/return-order';

type SupportedForm = CreateReturnOrderFormData | UpdateReturnOrderFormData;

type ProductInfo = {
  name: string;
  code: string;
  unit: string;
  specification: string | null;
  salesOrderNumber?: string;
};

type SelectableItem = Pick<
  ReturnOrderItem,
  | 'salesOrderItemId'
  | 'productId'
  | 'colorCode'
  | 'productionDate'
  | 'returnQuantity'
  | 'damagedQuantity'
  | 'originalQuantity'
  | 'unitPrice'
  | 'subtotal'
  | 'reason'
  | 'condition'
> & {
  productInfo: ProductInfo;
  salesOrderNumber: string;
};

interface ReturnItemsSectionProps {
  form: UseFormReturn<SupportedForm>;
  fields: FieldArrayWithId<SupportedForm, 'items', 'id'>[];
  onRemove: UseFieldArrayRemove;
  onAddItem: () => void;
  onSelectSalesOrderItem: (item: SelectableItem) => void;
  isSubmitting: boolean;
  isLoadingItems: boolean;
  selectedCustomerId?: string;
  returnMode: 'single_order' | 'multi_order';
  productInfoMap: Record<string, ProductInfo>;
  calculateSubtotal: (index: number) => void;
  calculateTotal: () => number;
}

export function ReturnItemsSection({
  form,
  fields,
  onRemove,
  onAddItem,
  onSelectSalesOrderItem,
  isSubmitting,
  isLoadingItems,
  selectedCustomerId,
  returnMode,
  productInfoMap,
  calculateSubtotal,
  calculateTotal,
}: ReturnItemsSectionProps) {
  const isMultiOrder = returnMode === 'multi_order';
  const isSingleOrder = returnMode === 'single_order';

  return (
    <>
      <div className="bg-muted/5 border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs">退货明细</div>
          <div className="text-muted-foreground text-xs">
            总金额: ¥{calculateTotal().toFixed(2)}
          </div>
        </div>
      </div>
      <div className="px-3 py-3">
        {isMultiOrder && selectedCustomerId && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium">
              从销售订单中选择退货商品
            </div>
            <MultiOrderItemSelector
              customerId={selectedCustomerId}
              onItemSelect={onSelectSalesOrderItem}
              selectedItems={fields.map(field => field.salesOrderItemId)}
            />
          </div>
        )}

        {isSingleOrder && isLoadingItems && (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="text-muted-foreground text-xs">
              加载销售订单明细中...
            </span>
          </div>
        )}

        {fields.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-xs">
            {isSingleOrder
              ? '暂无退货明细，请先选择销售订单'
              : '暂无退货明细，请从上方选择要退货的商品'}
          </div>
        ) : (
          <div className="rounded border">
            <div className="bg-muted/20 flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">退货明细列表</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddItem}
                disabled={isSubmitting}
                className="h-6 px-2 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                添加明细
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="h-8 px-2">产品</TableHead>
                    {isMultiOrder && (
                      <TableHead className="h-8 px-2">来源订单</TableHead>
                    )}
                    <TableHead className="h-8 px-2">原始数量</TableHead>
                    <TableHead className="h-8 px-2">退货数量</TableHead>
                    <TableHead className="h-8 px-2">破损数量</TableHead>
                    <TableHead className="h-8 px-2">单价</TableHead>
                    <TableHead className="h-8 px-2">小计</TableHead>
                    <TableHead className="h-8 px-2 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="text-xs">
                      <TableCell className="h-8 px-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <Package className="text-muted-foreground h-3 w-3" />
                            <span className="font-medium">
                              {productInfoMap[field.productId]?.name ||
                                `产品 ${index + 1}`}
                            </span>
                          </div>
                          {productInfoMap[field.productId] && (
                            <div className="text-muted-foreground flex gap-2 text-xs">
                              <span>
                                {productInfoMap[field.productId]?.code}
                              </span>
                              {productInfoMap[field.productId]
                                ?.specification && (
                                <span>
                                  {
                                    productInfoMap[field.productId]
                                      ?.specification
                                  }
                                </span>
                              )}
                              {field.colorCode && (
                                <span>颜色: {field.colorCode}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {isMultiOrder && (
                        <TableCell className="h-8 px-2">
                          <span className="text-muted-foreground font-mono text-xs">
                            {productInfoMap[field.productId]
                              ?.salesOrderNumber || '-'}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="h-8 px-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.originalQuantity`}
                          render={({ field: fieldControl }) => (
                            <Input
                              type="number"
                              className="h-6 w-20 text-xs"
                              readOnly
                              {...fieldControl}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="h-8 px-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.returnQuantity`}
                          render={({ field: fieldControl }) => (
                            <Input
                              type="number"
                              min="1"
                              className="h-6 w-16 text-xs"
                              {...fieldControl}
                              onChange={event => {
                                fieldControl.onChange(
                                  Number(event.target.value)
                                );
                                calculateSubtotal(index);
                              }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="h-8 px-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.damagedQuantity`}
                          render={({ field: fieldControl }) => (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              className="h-6 w-16 text-xs"
                              {...fieldControl}
                              onChange={event => {
                                fieldControl.onChange(
                                  Number(event.target.value) || 0
                                );
                              }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="h-8 px-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field: fieldControl }) => (
                            <Input
                              type="number"
                              step="0.01"
                              className="h-6 w-20 text-xs"
                              {...fieldControl}
                              onChange={event => {
                                fieldControl.onChange(
                                  Number(event.target.value)
                                );
                                calculateSubtotal(index);
                              }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="h-8 px-2">
                        <span className="font-mono text-xs">
                          ¥
                          {form.watch(`items.${index}.subtotal`)?.toFixed(2) ||
                            '0.00'}
                        </span>
                      </TableCell>
                      <TableCell className="h-8 px-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onRemove(index)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export type {
  SelectableItem as ReturnOrderSelectableItem,
  ProductInfo as ReturnOrderProductInfo,
};
