'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { TableRow } from '@/components/ui/table';
import type { Product } from '@/lib/types/product';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';
import type { SalesOrderCreateFormData } from '@/lib/validations/sales-order';

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
  useAvailableBatches,
  useAutoRemarks,
  useDisplayQuantitySync,
  useOrderItemWatchers,
  useResolvedProductState,
  useTransferQuantitySync,
} from './hooks';
import type { OrderFormInstance } from './types';

interface OrderItemRowProps {
  index: number;
  products: Product[];
  onRemove: (index: number) => void;
  onProductChange?: (index: number, product: Product | null) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
}

interface OrderItemRowViewProps {
  form: OrderFormInstance;
  index: number;
  products: Product[];
  onRemove: (index: number) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
  isManualProduct: boolean;
  resolvedProduct: Product | null;
  availableBatches: Array<{ batchNumber: string; quantity: number }>;
  localQuantityDisplay: number;
  transferQuantityDisplay: number;
  itemAmount: number;
  formatQuantity: (value: number) => string;
  watchedProductId?: string;
  watchedManualProductName?: string;
  onProductOverride: (product: Product | null) => void;
}

const OrderItemRowComponent = ({
  index,
  products,
  onRemove,
  onProductChange,
  orderType,
  transferMode,
}: OrderItemRowProps) => {
  const controller = useOrderItemRowController({
    index,
    products,
    onRemove,
    onProductChange,
    orderType,
    transferMode,
  });

  return <OrderItemRowView {...controller} />;
};

export const OrderItemRow = React.memo(OrderItemRowComponent);
OrderItemRow.displayName = 'OrderItemRow';

function OrderItemRowView({
  form,
  index,
  products,
  onRemove,
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
  watchedManualProductName,
  onProductOverride,
}: OrderItemRowViewProps) {
  return (
    <TableRow className="h-10">
      <ProductCodeCell
        form={form}
        index={index}
        products={products}
        onProductChange={onProductOverride}
      />
      <ProductNameCell
        products={products}
        productId={watchedProductId}
        manualProductName={watchedManualProductName}
      />
      <PiecesPerUnitCell
        form={form}
        index={index}
        isManualProduct={isManualProduct}
      />
      <BatchSelectorCell
        form={form}
        index={index}
        availableBatches={availableBatches}
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
      <ActionsCell onRemove={() => onRemove(index)} />
    </TableRow>
  );
}

interface UseOrderItemRowControllerParams extends OrderItemRowProps {}

function useOrderItemRowController({
  index,
  products,
  onRemove,
  onProductChange,
  orderType,
  transferMode,
}: UseOrderItemRowControllerParams): OrderItemRowViewProps {
  const form = useFormContext<SalesOrderCreateFormData>();

  const watchers = useOrderItemWatchers(form, index);
  const { isManualProduct } = watchers;

  const { resolvedProduct, handleProductOverride } = useResolvedProductState(
    products,
    watchers.productId,
    index,
    onProductChange
  );

  const availableBatches = useAvailableBatches(
    resolvedProduct,
    watchers.batchNumber
  );

  useDisplayQuantitySync(
    form,
    index,
    watchers.displayUnit,
    watchers.displayQuantity,
    watchers.piecesPerUnit,
    watchers.quantity
  );

  useTransferQuantitySync(
    form,
    index,
    orderType,
    transferMode,
    watchers.quantity,
    watchers.localQuantity,
    watchers.transferQuantity
  );

  useAutoRemarks(
    form,
    index,
    watchers.quantity,
    watchers.piecesPerUnit,
    watchers.remarks
  );

  const piecePrice =
    watchers.displayUnit === '件' &&
    watchers.unitPrice &&
    watchers.piecesPerUnit > 0
      ? watchers.unitPrice / watchers.piecesPerUnit
      : watchers.unitPrice || 0;

  const itemAmount = (watchers.quantity || 0) * piecePrice;
  const localQuantityDisplay = Math.max(watchers.localQuantity || 0, 0);
  const transferQuantityDisplay = Math.max(watchers.transferQuantity || 0, 0);

  const formatQuantity = React.useCallback((value: number) => {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, []);

  return {
    form,
    index,
    products,
    onRemove,
    orderType,
    transferMode,
    isManualProduct,
    resolvedProduct,
    availableBatches,
    localQuantityDisplay,
    transferQuantityDisplay,
    itemAmount,
    formatQuantity,
    watchedProductId: watchers.productId,
    watchedManualProductName: watchers.manualProductName,
    onProductOverride: handleProductOverride,
  };
}
