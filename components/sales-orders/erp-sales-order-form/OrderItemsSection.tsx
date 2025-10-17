import { Plus } from 'lucide-react';
import React from 'react';
import type {
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormReturn,
} from 'react-hook-form';

import { OrderItemRow } from '@/components/sales-orders/order-item-row';
import { Button } from '@/components/ui/button';
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
        // description: `产品编码 "${product.code}" 的上次价格：¥${latestPrice}`,
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
  priceHistory,
  priceType,
  toast,
}: OrderItemsSectionProps) {
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

  return (
    <div className="bg-card rounded border">
      <div className="bg-muted/30 flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-medium">订单明细</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddItem}
          className="h-6 px-2 text-xs"
          disabled={isSubmitting}
        >
          <Plus className="mr-1 h-3 w-3" />
          添加商品
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center">
          <p className="text-sm">暂无商品明细</p>
          <p className="text-xs">点击“添加商品”按钮开始添加</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="h-8 text-xs">产品编码</TableHead>
                <TableHead className="h-8 text-xs">产品名称</TableHead>
                <TableHead className="h-8 text-xs">每件片数</TableHead>
                <TableHead className="h-8 text-xs">批次号</TableHead>
                <TableHead className="h-8 text-xs">规格</TableHead>
                <TableHead className="h-8 text-xs">单位</TableHead>
                <TableHead className="h-8 text-xs">数量</TableHead>
                <TableHead className="h-8 text-xs">单价</TableHead>
                {orderType === 'TRANSFER' && (
                  <TableHead className="h-8 text-xs">成本单价</TableHead>
                )}
                <TableHead className="h-8 text-xs">金额</TableHead>
                <TableHead className="h-8 text-xs">备注</TableHead>
                <TableHead className="h-8 text-xs">操作</TableHead>
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
                  unitMapping={unitMapping}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
