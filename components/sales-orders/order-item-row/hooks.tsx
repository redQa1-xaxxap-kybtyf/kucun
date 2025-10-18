'use client';

import * as React from 'react';
import { useWatch } from 'react-hook-form';

import type { Product } from '@/lib/types/product';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';

import type { OrderFormInstance } from './types';

interface OrderItemWatchers {
  productId?: string;
  isManualProduct: boolean;
  quantity: number;
  localQuantity: number;
  transferQuantity: number;
  unitPrice: number;
  displayUnit: string;
  piecesPerUnit: number;
  displayQuantity: number;
  manualProductName?: string;
  batchNumber?: string;
  remarks?: string;
}

export function useOrderItemWatchers(
  form: OrderFormInstance,
  index: number
): OrderItemWatchers {
  const productId = useWatch({
    control: form.control,
    name: `items.${index}.productId`,
  });
  const isManualProduct = Boolean(
    useWatch({
      control: form.control,
      name: `items.${index}.isManualProduct`,
      defaultValue: false,
    })
  );
  const quantity = Number(
    useWatch({
      control: form.control,
      name: `items.${index}.quantity`,
      defaultValue: 0,
    })
  );
  const localQuantity = Number(
    useWatch({
      control: form.control,
      name: `items.${index}.localQuantity`,
      defaultValue: 0,
    })
  );
  const transferQuantity = Number(
    useWatch({
      control: form.control,
      name: `items.${index}.transferQuantity`,
      defaultValue: 0,
    })
  );
  const unitPrice = Number(
    useWatch({
      control: form.control,
      name: `items.${index}.unitPrice`,
      defaultValue: 0,
    })
  );
  const displayUnit =
    useWatch({
      control: form.control,
      name: `items.${index}.displayUnit`,
      defaultValue: '片',
    }) ?? '片';
  const piecesPerUnit = Number(
    useWatch({
      control: form.control,
      name: `items.${index}.piecesPerUnit`,
      defaultValue: 1,
    })
  );
  const displayQuantity = Number(
    useWatch({
      control: form.control,
      name: `items.${index}.displayQuantity`,
      defaultValue: 1,
    })
  );
  const manualProductName = useWatch({
    control: form.control,
    name: `items.${index}.manualProductName`,
    defaultValue: '',
  });
  const batchNumber = useWatch({
    control: form.control,
    name: `items.${index}.batchNumber`,
  });
  const remarks = useWatch({
    control: form.control,
    name: `items.${index}.remarks`,
  });

  return {
    productId,
    isManualProduct,
    quantity,
    localQuantity,
    transferQuantity,
    unitPrice,
    displayUnit,
    piecesPerUnit,
    displayQuantity,
    manualProductName,
    batchNumber,
    remarks,
  };
}

export function useResolvedProductState(
  products: Product[],
  productId: string | undefined,
  index: number,
  onProductChange?: (index: number, product: Product | null) => void
) {
  const productFromList = React.useMemo(
    () => products.find(product => product.id === productId),
    [products, productId]
  );

  const [productOverride, setProductOverride] = React.useState<Product | null>(
    null
  );

  React.useEffect(() => {
    if (!productId) {
      setProductOverride(null);
      return;
    }
    if (productFromList) {
      setProductOverride(prev =>
        prev && prev.id === productFromList.id ? prev : productFromList
      );
    }
  }, [productFromList, productId]);

  const handleProductOverride = React.useCallback(
    (product: Product | null) => {
      setProductOverride(product);
      onProductChange?.(index, product);
    },
    [index, onProductChange]
  );

  return {
    resolvedProduct: productOverride ?? productFromList ?? null,
    handleProductOverride,
  };
}

export function useAvailableBatches(
  resolvedProduct: Product | null,
  currentBatchNumber?: string
) {
  return React.useMemo(() => {
    const inventoryBatches = resolvedProduct?.inventory?.batches ?? [];
    if (
      currentBatchNumber &&
      !inventoryBatches.some(batch => batch.batchNumber === currentBatchNumber)
    ) {
      return [
        { batchNumber: currentBatchNumber, quantity: 0 },
        ...inventoryBatches,
      ];
    }
    return inventoryBatches;
  }, [currentBatchNumber, resolvedProduct?.inventory?.batches]);
}

export function useDisplayQuantitySync(
  form: OrderFormInstance,
  index: number,
  displayUnit: string,
  displayQuantity: number,
  piecesPerUnit: number,
  quantity: number
) {
  React.useEffect(() => {
    const piecesPerUnitSafe = Number(piecesPerUnit) || 0;
    const displayQtySafe = Number(displayQuantity) || 0;
    const quantityFromDisplay =
      displayUnit === '件' && piecesPerUnitSafe > 0
        ? displayQtySafe * piecesPerUnitSafe
        : displayQtySafe;
    const normalizedQuantity = Number.isFinite(quantityFromDisplay)
      ? Math.max(quantityFromDisplay, 0)
      : 0;

    if (Math.abs(quantity - normalizedQuantity) > 1e-6) {
      form.setValue(`items.${index}.quantity`, normalizedQuantity, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [displayUnit, displayQuantity, piecesPerUnit, quantity, form, index]);
}

export function useTransferQuantitySync(
  form: OrderFormInstance,
  index: number,
  orderType: 'NORMAL' | 'TRANSFER',
  transferMode: TransferFulfillmentMode | undefined,
  quantity: number,
  localQuantity: number,
  transferQuantity: number
) {
  React.useEffect(() => {
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    if (orderType === 'TRANSFER') {
      if (transferMode === 'MIXED') {
        const boundedLocal = clamp(localQuantity, 0, quantity);
        if (Math.abs(boundedLocal - localQuantity) > 0.01) {
          form.setValue(`items.${index}.localQuantity`, boundedLocal, {
            shouldDirty: true,
            shouldValidate: false,
          });
          return;
        }
        const expectedTransfer = Math.max(quantity - boundedLocal, 0);
        if (Math.abs(expectedTransfer - transferQuantity) > 0.01) {
          form.setValue(`items.${index}.transferQuantity`, expectedTransfer, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }
      } else {
        if (Math.abs(localQuantity) > 0.01) {
          form.setValue(`items.${index}.localQuantity`, 0, {
            shouldDirty: true,
            shouldValidate: false,
          });
          return;
        }
        if (Math.abs(transferQuantity - quantity) > 0.01) {
          form.setValue(`items.${index}.transferQuantity`, quantity, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }
      }
    } else {
      if (Math.abs(localQuantity - quantity) > 0.01) {
        form.setValue(`items.${index}.localQuantity`, quantity, {
          shouldDirty: true,
          shouldValidate: false,
        });
        return;
      }
      if (Math.abs(transferQuantity) > 0.01) {
        form.setValue(`items.${index}.transferQuantity`, 0, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
  }, [
    form,
    index,
    orderType,
    transferMode,
    quantity,
    localQuantity,
    transferQuantity,
  ]);
}

export function useAutoRemarks(
  form: OrderFormInstance,
  index: number,
  quantity: number,
  piecesPerUnit: number,
  remarks?: string
) {
  React.useEffect(() => {
    if (quantity > 0 && piecesPerUnit > 0) {
      try {
        const result = calculatePieceDisplay(
          Math.floor(quantity),
          piecesPerUnit
        );
        let remarksText = '';
        if (result.fullUnits === 0) {
          remarksText = `${result.remainingPieces}片`;
        } else if (result.remainingPieces === 0) {
          remarksText = `${result.fullUnits}件`;
        } else {
          remarksText = `${result.fullUnits}件${result.remainingPieces}片`;
        }

        if (remarksText !== remarks) {
          form.setValue(`items.${index}.remarks`, remarksText, {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      } catch (_error) {
        if (remarks) {
          form.setValue(`items.${index}.remarks`, '', {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      }
    } else if (remarks) {
      form.setValue(`items.${index}.remarks`, '', {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [form, index, quantity, piecesPerUnit, remarks]);
}
