import { Package, Plus } from 'lucide-react';
import React from 'react';
import type {
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormReturn,
} from 'react-hook-form';

import { OrderItemRow } from '@/components/sales-orders/order-item-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ToastProps } from '@/components/ui/toast';
import {
  getLatestPrice,
  type CustomerProductPrice,
  type PriceType,
} from '@/hooks/use-price-history';
import type { Product } from '@/lib/types/product';
import type {
  SalesOrderType,
  TransferFulfillmentMode,
} from '@/lib/types/sales-order';
import type { SalesOrderCreateFormData } from '@/lib/validations/sales-order';

interface OrderItemsSectionProps {
  fields: FieldArrayWithId<SalesOrderCreateFormData, 'items', 'id'>[];
  remove: UseFieldArrayRemove;
  onAddItem: () => void;
  isSubmitting: boolean;
  products: Product[];
  orderType: SalesOrderType | undefined;
  transferMode?: TransferFulfillmentMode;
  unitMapping: Record<string, string>;
  form: UseFormReturn<SalesOrderCreateFormData>;
  selectedCustomerId?: string | null;
  supplierId?: string | null;
  priceHistory?: CustomerProductPrice[];
  priceType: PriceType;
  toast: (props: ToastProps) => void;
}

function populateProductSelection({
  form,
  unitMapping,
  index,
  product,
  selectedCustomerId,
  priceHistory,
  priceType,
  toast,
}: {
  form: UseFormReturn<SalesOrderCreateFormData>;
  unitMapping: Record<string, string>;
  index: number;
  product: Product;
  selectedCustomerId?: string | null;
  priceHistory?: CustomerProductPrice[];
  priceType: PriceType;
  toast: (props: ToastProps) => void;
}) {
  form.setValue(`items.${index}.specification`, product.specification || '');
  form.setValue(
    `items.${index}.unit`,
    unitMapping[product.unit?.toLowerCase() || ''] || product.unit || ''
  );
  form.setValue(`items.${index}.manualProductName`, '');
  form.setValue(`items.${index}.manualSpecification`, '');
  form.setValue(`items.${index}.manualUnit`, '');
  form.setValue(`items.${index}.productCode`, product.code || '');
  form.setValue(
    `items.${index}.piecesPerUnit`,
    product.piecesPerUnit ?? undefined
  );
  form.setValue(`items.${index}.displayUnit`, '片');
  form.setValue(`items.${index}.displayQuantity`, 1);
  form.setValue(`items.${index}.quantity`, 1);
  form.setValue(`items.${index}.remarks`, '');

  if (selectedCustomerId && priceHistory && product.code) {
    const latestPrice = getLatestPrice(priceHistory, product.code, priceType);
    if (latestPrice !== undefined) {
      form.setValue(`items.${index}.unitPrice`, latestPrice);
      toast({
        title: '已自动填充历史价格',
        // description: `产品编码 "${product.code}" 的上次价格：￥${latestPrice}`,
        duration: 2000,
      });
    }
  }
}

export function OrderItemsSection({
  fields,
  remove,
  onAddItem,
  isSubmitting,
  products,
  orderType,
  transferMode,
  unitMapping,
  form,
  selectedCustomerId,
  supplierId,
  priceHistory,
  priceType,
  toast,
}: OrderItemsSectionProps) {
  const [showHistoricalDialog, setShowHistoricalDialog] = React.useState(false);

  const handleProductChange = React.useCallback(
    (index: number, product: Product | null) => {
      if (!product) {
        return;
      }

      populateProductSelection({
        form,
        unitMapping,
        index,
        product,
        selectedCustomerId,
        priceHistory,
        priceType,
        toast,
      });
    },
    [form, priceHistory, priceType, selectedCustomerId, toast, unitMapping]
  );

  const handleHistoricalProductSelect = React.useCallback(
    (product: HistoricalTemporaryProduct) => {
      // 添加一个新的订单明细行
      onAddItem();

      // 获取新添加行的索引
      const newIndex = fields.length;

      // 使用 setTimeout 确保新行已经添加到 DOM
      setTimeout(() => {
        // 填充临时产品信息
        form.setValue(`items.${newIndex}.manualProductName`, product.name);
        form.setValue(
          `items.${newIndex}.manualSpecification`,
          product.specification || ''
        );
        form.setValue(`items.${newIndex}.manualUnit`, product.unit);
        form.setValue(`items.${newIndex}.piecesPerUnit`, product.piecesPerUnit);
        form.setValue(`items.${newIndex}.productCode`, product.code);
        form.setValue(`items.${newIndex}.displayUnit`, '片');
        form.setValue(`items.${newIndex}.displayQuantity`, 1);
        form.setValue(`items.${newIndex}.quantity`, 1);

        toast({
          title: '已添加历史临时产品',
          description: `产品: ${product.name}，请填写数量和单价`,
          duration: 3000,
        });
      }, 100);
    },
    [fields.length, form, onAddItem, toast]
  );

  return (
    <>
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
              <Package className="h-4 w-4" />
              订单明细
            </div>
            <div className="flex gap-2">
              {supplierId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoricalDialog(true)}
                  className="h-8 gap-1"
                  disabled={isSubmitting}
                >
                  <Clock className="h-3 w-3" />
                  从历史选择
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddItem}
                className="h-8 gap-1"
                disabled={isSubmitting}
              >
                <Plus className="h-3 w-3" />
                添加产品
              </Button>
            </div>
          </div>

          {fields.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] py-10 text-center text-xs text-[hsl(var(--color-text-secondary))]">
              <Package className="h-6 w-6 text-[hsl(var(--color-text-tertiary))]" />
              <div>
                <p className="text-sm text-[hsl(var(--color-text-primary))]">
                  暂无产品明细
                </p>
                <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                  点击“添加产品”按钮开始添加
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[200px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      产品编码
                    </TableHead>
                    <TableHead className="min-w-[140px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      产品名称
                    </TableHead>
                    <TableHead className="min-w-[90px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                      每件片数
                    </TableHead>
                    <TableHead className="min-w-[180px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      批次号
                    </TableHead>
                    <TableHead className="min-w-[150px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      规格
                    </TableHead>
                    <TableHead className="min-w-[80px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      单位
                    </TableHead>
                    <TableHead className="min-w-[100px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      数量
                    </TableHead>
                    <TableHead className="min-w-[100px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      销售单价
                    </TableHead>
                    {orderType === 'TRANSFER' && (
                      <>
                        <TableHead className="min-w-[100px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                          成本单价
                        </TableHead>
                        <TableHead className="min-w-[120px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                          调货信息
                        </TableHead>
                      </>
                    )}
                    <TableHead className="min-w-[100px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      金额
                    </TableHead>
                    <TableHead className="min-w-[150px] border-r border-[hsl(var(--color-border-primary))] px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      备注
                    </TableHead>
                    <TableHead className="min-w-[80px] px-3 py-2 text-center text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <OrderItemRow
                      key={field.id}
                      index={index}
                      products={products}
                      onRemove={remove}
                      onProductChange={handleProductChange}
                      orderType={orderType as 'NORMAL' | 'TRANSFER'}
                      transferMode={transferMode}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 历史临时产品选择对话框 */}
      <HistoricalTemporaryProductDialog
        open={showHistoricalDialog}
        onOpenChange={setShowHistoricalDialog}
        supplierId={supplierId || null}
        onSelect={handleHistoricalProductSelect}
      />
    </>
  );
}
