'use client';

import React from 'react';

import { TableRow } from '@/components/ui/table';
import type { Product } from '@/lib/types/product';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';

import {
  ActionsCell,
  AmountCell,
  BatchSelectorCell,
  ManualInfoCells,
  PiecesPerUnitCell,
  ProductCodeCell,
  ProductNameCell,
  RemarksCell,
  TransferInfoCell,
  UnitAndQuantityCells,
  UnitCostCell,
  UnitPriceCell,
} from './cells';
import {
  useOrderItemController,
  type OrderItemControllerData,
} from './hooks';

interface OrderItemRowProps {
  index: number;
  isHighlighted?: boolean;
  products: Product[];
  onRemove: (index: number) => void;
  onDuplicate?: (index: number) => void;
  onProductChange?: (index: number, product: Product | null) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
  showInlineInventoryStatus?: boolean;
}

interface OrderItemRowViewProps {
  isHighlighted: boolean;
  products: Product[];
  onRemove: (index: number) => void;
  onDuplicate?: (index: number) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
  showInlineInventoryStatus: boolean;
}

type OrderItemRowViewModel = OrderItemControllerData & OrderItemRowViewProps;

const OrderItemRowComponent = ({
  index,
  isHighlighted = false,
  products,
  onRemove,
  onDuplicate,
  onProductChange,
  orderType,
  transferMode,
  showInlineInventoryStatus = true,
}: OrderItemRowProps) => {
  const controller = useOrderItemController({
    index,
    products,
    onProductChange,
    orderType,
    transferMode,
  });

  return (
    <OrderItemRowView
      {...controller}
      isHighlighted={Boolean(isHighlighted)}
      products={products}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      orderType={orderType}
      transferMode={transferMode}
      showInlineInventoryStatus={showInlineInventoryStatus}
    />
  );
};

export const OrderItemRow = React.memo(OrderItemRowComponent);
OrderItemRow.displayName = 'OrderItemRow';

function OrderItemRowView({
  form,
  index,
  isHighlighted,
  products,
  onRemove,
  onDuplicate,
  orderType,
  transferMode,
  isManualProduct,
  resolvedProduct,
  availableBatches,
  localQuantityDisplay,
  transferQuantityDisplay,
  itemAmount,
  formatQuantity,
  watchedProductId,
  onProductOverride,
  showInlineInventoryStatus,
}: OrderItemRowViewModel) {
  return (
    <TableRow
      id={`sales-order-item-row-${index}`}
      data-sales-order-row-index={index}
      className={cn(
        'h-10 border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] transition-colors hover:bg-[hsl(var(--color-bg-tertiary))]',
        isHighlighted &&
          'bg-amber-100/80 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)]'
      )}
    >
      <ProductCodeCell
        form={form}
        index={index}
        products={products}
        onProductChange={onProductOverride}
        orderType={orderType}
        isManualProduct={isManualProduct}
      />
      <ProductNameCell
        form={form}
        index={index}
        products={products}
        productId={watchedProductId}
        isManualProduct={isManualProduct}
        orderType={orderType}
      />
      <PiecesPerUnitCell
        form={form}
        index={index}
        isManualProduct={isManualProduct}
        resolvedProduct={resolvedProduct}
      />
      <BatchSelectorCell
        form={form}
        index={index}
        availableBatches={availableBatches}
        resolvedProduct={resolvedProduct}
        isManualProduct={isManualProduct}
        disabled={!resolvedProduct}
      />
      <ManualInfoCells
        form={form}
        index={index}
        isManualProduct={isManualProduct}
      />
      <UnitAndQuantityCells
        form={form}
        index={index}
        resolvedProduct={resolvedProduct}
        isManualProduct={isManualProduct}
        showInventoryStatus={showInlineInventoryStatus}
      />
      <UnitPriceCell form={form} index={index} />
      {orderType === 'TRANSFER' && (
        <>
          <UnitCostCell form={form} index={index} />
          <TransferInfoCell
            form={form}
            index={index}
            transferMode={transferMode}
            localQuantityDisplay={localQuantityDisplay}
            transferQuantityDisplay={transferQuantityDisplay}
            formatQuantity={formatQuantity}
          />
        </>
      )}
      <AmountCell amount={itemAmount} />
      <RemarksCell form={form} index={index} />
      <ActionsCell
        onRemove={() => onRemove(index)}
        onDuplicate={onDuplicate ? () => onDuplicate(index) : undefined}
      />
    </TableRow>
  );
}
