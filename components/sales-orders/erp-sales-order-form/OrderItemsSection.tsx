import { Package, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import React from 'react';
import type {
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormReturn,
} from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Toast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-media-query';
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
import type { HistoricalTemporaryProduct } from '@/lib/types/temporary-product';
import { toPieceOrSheetLabel } from '@/lib/utils/inventory-unit-conversion';
import type { SalesOrderCreateFormData } from '@/lib/validations/sales-order';

const HistoricalTemporaryProductDialog = dynamic(
  () =>
    import(
      '@/components/sales-orders/historical-temporary-product-dialog'
    ).then(mod => mod.HistoricalTemporaryProductDialog),
  { ssr: false, loading: () => null }
);

const OrderItemRow = dynamic(
  () =>
    import('@/components/sales-orders/order-item-row').then(
      mod => mod.OrderItemRow
    ),
  {
    ssr: false,
    loading: () => (
      <TableRow>
        <TableCell colSpan={20} className="px-3 py-2">
          <div className="text-muted-foreground text-center text-xs">
            加载明细中...
          </div>
        </TableCell>
      </TableRow>
    ),
  }
);

const OrderItemMobileCard = dynamic(
  () =>
    import('@/components/sales-orders/order-item-row/OrderItemMobileCard').then(
      mod => mod.OrderItemMobileCard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-[hsl(var(--color-border-primary))] px-3 py-4 text-center text-xs text-[hsl(var(--color-text-secondary))]">
        加载明细中...
      </div>
    ),
  }
);

interface OrderItemsSectionProps {
  fields: FieldArrayWithId<SalesOrderCreateFormData, 'items', 'id'>[];
  remove: UseFieldArrayRemove;
  onAddItem: () => void;
  isSubmitting: boolean;
  highlightedRowIndexes?: ReadonlySet<number>;
  products: Product[];
  onSelectedProduct?: (product: Product | null) => void;
  orderType: SalesOrderType | undefined;
  transferMode?: TransferFulfillmentMode;
  unitMapping: Record<string, string>;
  form: UseFormReturn<SalesOrderCreateFormData>;
  selectedCustomerId?: string | null;
  supplierId?: string | null;
  priceHistory?: CustomerProductPrice[];
  priceType: PriceType;
  // 与 useToast().toast 保持一致的参数类型（支持 title / description 等）
  toast: (props: Toast) => void;
  showInlineInventoryStatus?: boolean;
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
  toast: (props: Toast) => void;
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
  form.setValue(
    `items.${index}.displayUnit`,
    toPieceOrSheetLabel(product.unit)
  );
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
  highlightedRowIndexes,
  products,
  onSelectedProduct,
  orderType,
  transferMode,
  unitMapping,
  form,
  selectedCustomerId,
  supplierId,
  priceHistory,
  priceType,
  toast,
  showInlineInventoryStatus = true,
}: OrderItemsSectionProps) {
  const isMobile = useIsMobile();
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
      onSelectedProduct?.(product);
    },
    [
      form,
      onSelectedProduct,
      priceHistory,
      priceType,
      selectedCustomerId,
      toast,
      unitMapping,
    ]
  );

  const handleHistoricalProductSelect = React.useCallback(
    (product: HistoricalTemporaryProduct) => {
      onAddItem();

      const newIndex = fields.length;

      setTimeout(() => {
        form.setValue(`items.${newIndex}.productId`, undefined, {
          shouldDirty: true,
          shouldValidate: false,
        });
        form.setValue(`items.${newIndex}.isManualProduct`, true, {
          shouldDirty: true,
          shouldValidate: false,
        });

        form.setValue(`items.${newIndex}.manualProductName`, product.name);
        form.setValue(
          `items.${newIndex}.manualSpecification`,
          product.specification || ''
        );
        form.setValue(`items.${newIndex}.manualUnit`, product.unit);
        form.setValue(`items.${newIndex}.piecesPerUnit`, product.piecesPerUnit);
        form.setValue(`items.${newIndex}.productCode`, product.code);
        form.setValue(
          `items.${newIndex}.manualWeight`,
          product.weight ?? undefined
        );

        form.setValue(
          `items.${newIndex}.specification`,
          product.specification || ''
        );
        form.setValue(`items.${newIndex}.unit`, product.unit);

        form.setValue(
          `items.${newIndex}.displayUnit`,
          toPieceOrSheetLabel(product.unit)
        );
        form.setValue(`items.${newIndex}.displayQuantity`, 1);
        form.setValue(`items.${newIndex}.quantity`, 1);
        form.setValue(`items.${newIndex}.localQuantity`, 0);
        form.setValue(`items.${newIndex}.transferQuantity`, 1);
        form.setValue(
          `items.${newIndex}.unitPrice`,
          product.latestSalePrice ?? 0
        );
        form.setValue(
          `items.${newIndex}.unitCost`,
          product.latestCostPrice ?? undefined
        );
        form.setValue(
          `items.${newIndex}.subtotal`,
          product.latestSalePrice ?? 0
        );
        form.setValue(`items.${newIndex}.remarks`, '');

        const filledPrices = [
          product.latestCostPrice !== null &&
          product.latestCostPrice !== undefined
            ? '成本'
            : null,
          product.latestSalePrice !== null &&
          product.latestSalePrice !== undefined
            ? '参考售价'
            : null,
        ].filter(Boolean);

        toast({
          title: '已添加外采产品',
          description: filledPrices.length
            ? `${product.name} 已带出${filledPrices.join('、')}，请确认数量`
            : `${product.name} 已带出基础信息，请填写数量和价格`,
          duration: 3000,
        });
      }, 100);
    },
    [fields.length, form, onAddItem, toast]
  );

  return (
    <>
      <Card className="overflow-hidden rounded-lg border-[hsl(var(--color-border-primary))] shadow-sm">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
              <Package className="h-4 w-4" />
              订单明细
            </div>
            <div className="flex flex-wrap items-stretch gap-2">
              {supplierId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoricalDialog(true)}
                  className="h-9 w-full gap-1 sm:w-auto"
                  disabled={isSubmitting}
                >
                  <Package className="h-3 w-3" />
                  外采产品
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddItem}
                className="h-9 w-full gap-1 sm:w-auto"
                disabled={
                  isSubmitting || (orderType === 'TRANSFER' && !supplierId)
                }
                title={
                  orderType === 'TRANSFER' && !supplierId
                    ? '请先选择供应商'
                    : undefined
                }
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
            <>
              {isMobile ? (
                <div
                  className="space-y-3"
                  data-testid="sales-order-mobile-item-list"
                >
                  {fields.map((field, index) => (
                    <OrderItemMobileCard
                      key={field.id}
                      index={index}
                      isHighlighted={highlightedRowIndexes?.has(index) ?? false}
                      products={products}
                      onRemove={remove}
                      onProductChange={handleProductChange}
                      orderType={orderType as 'NORMAL' | 'TRANSFER'}
                      transferMode={transferMode}
                      showInlineInventoryStatus={showInlineInventoryStatus}
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
                  <Table
                    className={
                      orderType === 'TRANSFER'
                        ? 'min-w-[1480px]'
                        : 'min-w-[1220px]'
                    }
                  >
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="min-w-[180px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          产品编码
                        </TableHead>
                        <TableHead className="min-w-[140px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          产品名称
                        </TableHead>
                        <TableHead className="min-w-[80px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          装箱数
                        </TableHead>
                        <TableHead className="min-w-[160px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          批次号
                        </TableHead>
                        <TableHead className="min-w-[140px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          规格
                        </TableHead>
                        <TableHead className="min-w-[70px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          单位
                        </TableHead>
                        <TableHead className="min-w-[90px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          数量
                        </TableHead>
                        <TableHead className="min-w-[90px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          销售单价
                        </TableHead>
                        {orderType === 'TRANSFER' && (
                          <>
                            <TableHead className="min-w-[100px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                              成本单价
                            </TableHead>
                            <TableHead className="min-w-[120px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                              调货信息
                            </TableHead>
                          </>
                        )}
                        <TableHead className="min-w-[100px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          金额
                        </TableHead>
                        <TableHead className="min-w-[120px] border-r border-[hsl(var(--color-border-primary))] px-3 text-[hsl(var(--color-text-secondary))]">
                          备注
                        </TableHead>
                        <TableHead className="min-w-[70px] px-3 text-center text-[hsl(var(--color-text-secondary))]">
                          操作
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <OrderItemRow
                          key={field.id}
                          index={index}
                          isHighlighted={
                            highlightedRowIndexes?.has(index) ?? false
                          }
                          products={products}
                          onRemove={remove}
                          onProductChange={handleProductChange}
                          orderType={orderType as 'NORMAL' | 'TRANSFER'}
                          transferMode={transferMode}
                          showInlineInventoryStatus={showInlineInventoryStatus}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 外采产品选择对话框 */}
      {showHistoricalDialog && (
        <HistoricalTemporaryProductDialog
          open={showHistoricalDialog}
          onOpenChange={setShowHistoricalDialog}
          supplierId={supplierId || null}
          onSelect={handleHistoricalProductSelect}
        />
      )}
    </>
  );
}
