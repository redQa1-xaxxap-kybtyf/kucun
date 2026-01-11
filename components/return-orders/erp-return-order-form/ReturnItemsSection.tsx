/* eslint-disable max-lines-per-function */
import { Package, Plus, Trash2 } from 'lucide-react';
import type {
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormReturn,
} from 'react-hook-form';

import { MultiOrderItemSelector } from '@/components/return-orders/multi-order-item-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { ReturnOrderFormData } from '@/lib/validations/return-order';

// ✅ 使用统一的 ReturnOrderFormData 类型,避免联合类型问题
type SupportedForm = ReturnOrderFormData;

type ProductInfo = {
  name: string;
  code: string;
  unit: string;
  specification: string | null;
  salesOrderNumber?: string;
  batchNumber?: string | null;
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
  // 显示用的可退信息：原始数量、已退数量、可退数量（不参与提交）
  returnableInfoMap?: Record<
    string,
    {
      originalQuantity: number;
      returnedQuantity: number;
      availableQuantity: number;
    }
  >;
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
  returnableInfoMap,
  calculateSubtotal,
  calculateTotal,
}: ReturnItemsSectionProps) {
  const isMultiOrder = returnMode === 'multi_order';
  const isSingleOrder = returnMode === 'single_order';

  // 退货单明细中的数量字段统一按“片”处理（系统存储单位），防止与销售单位（件/片）混淆
  const getUnitLabel = (_salesOrderItemId: string): string => '片';

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>退货明细</span>
            <span className="text-muted-foreground text-sm font-normal">
              总金额:{' '}
              <span className="font-bold text-orange-600">
                ￥{calculateTotal().toFixed(2)}
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isMultiOrder && selectedCustomerId && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-medium">
                从销售订单中选择退货产品
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
                : '暂无退货明细，请从上方选择要退货的产品'}
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="bg-muted/40 flex items-center justify-between border-b px-4 py-3">
                <span className="text-sm font-semibold">退货明细列表</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddItem}
                  disabled={isSubmitting}
                  className="h-8 px-3 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  添加明细
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[250px] pl-4">产品信息</TableHead>
                      <TableHead className="w-[140px] text-left">
                        批次号
                      </TableHead>
                      {isMultiOrder && (
                        <TableHead className="w-[150px]">来源订单</TableHead>
                      )}
                      <TableHead className="w-[100px] text-right">
                        原始数量
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        退货数量
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        破损数量
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        退货单价
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        小计
                      </TableHead>
                      <TableHead className="w-[60px] text-center">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const quantityInfo =
                        returnableInfoMap?.[field.salesOrderItemId];

                      return (
                        <TableRow key={field.id} className="hover:bg-muted/50">
                          <TableCell className="pl-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Package className="text-muted-foreground h-4 w-4" />
                                <span className="text-sm font-semibold">
                                  {/* ✅ 修复：使用 salesOrderItemId 查找产品信息 */}
                                  {productInfoMap[field.salesOrderItemId]
                                    ?.name || `产品 ${index + 1}`}
                                </span>
                              </div>
                              {productInfoMap[field.salesOrderItemId] && (
                                <div className="text-muted-foreground ml-6 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                  <span>
                                    {
                                      productInfoMap[field.salesOrderItemId]
                                        ?.code
                                    }
                                  </span>
                                  {productInfoMap[field.salesOrderItemId]
                                    ?.specification && (
                                    <span>
                                      {
                                        productInfoMap[field.salesOrderItemId]
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
                          <TableCell className="text-muted-foreground text-left text-xs">
                            {productInfoMap[field.salesOrderItemId]
                              ?.batchNumber || '-'}
                          </TableCell>
                          {isMultiOrder && (
                            <TableCell>
                              <span className="text-muted-foreground font-mono text-xs">
                                {/* ✅ 修复：使用 salesOrderItemId 查找来源订单号 */}
                                {productInfoMap[field.salesOrderItemId]
                                  ?.salesOrderNumber || '-'}
                              </span>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center justify-end gap-1">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.originalQuantity`}
                                  render={({ field: fieldControl }) => (
                                    <Input
                                      type="number"
                                      className="bg-muted/50 h-9 w-full text-right text-sm"
                                      readOnly
                                      {...fieldControl}
                                    />
                                  )}
                                />
                                <span className="text-muted-foreground text-[10px]">
                                  {getUnitLabel(field.salesOrderItemId)}
                                </span>
                              </div>
                              {quantityInfo && (
                                <div className="text-muted-foreground text-[10px]">
                                  已退 {quantityInfo.returnedQuantity}
                                  {getUnitLabel(
                                    field.salesOrderItemId
                                  )}，可退 {quantityInfo.availableQuantity}
                                  {getUnitLabel(field.salesOrderItemId)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <FormField
                                control={form.control}
                                name={`items.${index}.returnQuantity`}
                                render={({ field: fieldControl }) => (
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="h-9 w-full text-right text-sm font-medium"
                                    {...fieldControl}
                                    onChange={event => {
                                      fieldControl.onChange(
                                        parseInt(event.target.value, 10) || 0
                                      );
                                      calculateSubtotal(index);
                                    }}
                                  />
                                )}
                              />
                              <span className="text-muted-foreground text-[10px]">
                                {getUnitLabel(field.salesOrderItemId)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <FormField
                                control={form.control}
                                name={`items.${index}.damagedQuantity`}
                                render={({ field: fieldControl }) => (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    className="h-9 w-full text-right text-sm"
                                    {...fieldControl}
                                    onChange={event => {
                                      fieldControl.onChange(
                                        parseInt(event.target.value, 10) || 0
                                      );
                                      calculateSubtotal(index);
                                    }}
                                  />
                                )}
                              />
                              <span className="text-muted-foreground text-[10px]">
                                {getUnitLabel(field.salesOrderItemId)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <FormField
                              control={form.control}
                              name={`items.${index}.unitPrice`}
                              render={({ field: fieldControl }) => (
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-9 w-full text-right text-sm"
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
                          <TableCell className="text-right">
                            <span className="font-mono text-sm font-bold">
                              ￥
                              {form
                                .watch(`items.${index}.subtotal`)
                                ?.toFixed(2) || '0.00'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                              onClick={() => onRemove(index)}
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 底部汇总栏 */}
              <div className="bg-muted/10 flex items-center justify-end gap-8 border-t px-6 py-4">
                <div className="text-sm">
                  <span className="text-muted-foreground mr-2">总数量:</span>
                  <span className="font-medium">
                    {fields.reduce(
                      (sum, field) => sum + (field.returnQuantity || 0),
                      0
                    )}
                  </span>
                </div>
                <div className="flex items-baseline text-sm">
                  <span className="text-muted-foreground mr-2">
                    预计退款总额:
                  </span>
                  <span className="font-mono text-xl font-bold text-orange-600">
                    ￥{calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export type {
  ProductInfo as ReturnOrderProductInfo,
  SelectableItem as ReturnOrderSelectableItem,
};
