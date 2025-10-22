'use client';

import * as React from 'react';
import { useWatch } from 'react-hook-form';

import type { Product } from '@/lib/types/product';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';
import type { SalesOrderCreateFormData } from '@/lib/validations/sales-order';

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

function useOrderItemManualFlag(
  form: OrderFormInstance,
  index: number
): boolean {
  const rawValue = useWatch<
    SalesOrderCreateFormData,
    `items.${number}.isManualProduct`
  >({
    control: form.control,
    name: `items.${index}.isManualProduct` as const,
    defaultValue: false,
  });
  return Boolean(rawValue);
}

function useOrderItemQuantityMetrics(
  form: OrderFormInstance,
  index: number
): {
  quantity: number;
  localQuantity: number;
  transferQuantity: number;
  displayUnit: string;
  piecesPerUnit: number;
  displayQuantity: number;
} {
  const quantity = Number(
    useWatch<SalesOrderCreateFormData, `items.${number}.quantity`>({
      control: form.control,
      name: `items.${index}.quantity` as const,
      defaultValue: 0,
    })
  );
  const localQuantity = Number(
    useWatch<SalesOrderCreateFormData, `items.${number}.localQuantity`>({
      control: form.control,
      name: `items.${index}.localQuantity` as const,
      defaultValue: 0,
    })
  );
  const transferQuantity = Number(
    useWatch<SalesOrderCreateFormData, `items.${number}.transferQuantity`>({
      control: form.control,
      name: `items.${index}.transferQuantity` as const,
      defaultValue: 0,
    })
  );
  const displayUnit =
    useWatch<SalesOrderCreateFormData, `items.${number}.displayUnit`>({
      control: form.control,
      name: `items.${index}.displayUnit` as const,
      defaultValue: '片',
    }) ?? '片';
  const piecesPerUnit = Number(
    useWatch<SalesOrderCreateFormData, `items.${number}.piecesPerUnit`>({
      control: form.control,
      name: `items.${index}.piecesPerUnit` as const,
      defaultValue: 1,
    })
  );
  const displayQuantity = Number(
    useWatch<SalesOrderCreateFormData, `items.${number}.displayQuantity`>({
      control: form.control,
      name: `items.${index}.displayQuantity` as const,
      defaultValue: 1,
    })
  );

  return {
    quantity,
    localQuantity,
    transferQuantity,
    displayUnit,
    piecesPerUnit,
    displayQuantity,
  };
}

function useOrderItemPricing(form: OrderFormInstance, index: number): number {
  return Number(
    useWatch<SalesOrderCreateFormData, `items.${number}.unitPrice`>({
      control: form.control,
      name: `items.${index}.unitPrice` as const,
      defaultValue: 0,
    })
  );
}

function useOrderItemTextWatchers(
  form: OrderFormInstance,
  index: number
): {
  productId?: string;
  manualProductName?: string;
  batchNumber?: string;
  remarks?: string;
} {
  const productId = useWatch<
    SalesOrderCreateFormData,
    `items.${number}.productId`
  >({
    control: form.control,
    name: `items.${index}.productId` as const,
  });
  const manualProductName = useWatch<
    SalesOrderCreateFormData,
    `items.${number}.manualProductName`
  >({
    control: form.control,
    name: `items.${index}.manualProductName` as const,
    defaultValue: '',
  });
  const batchNumber = useWatch<
    SalesOrderCreateFormData,
    `items.${number}.batchNumber`
  >({
    control: form.control,
    name: `items.${index}.batchNumber` as const,
  });
  const remarks = useWatch<SalesOrderCreateFormData, `items.${number}.remarks`>(
    {
      control: form.control,
      name: `items.${index}.remarks` as const,
    }
  );

  return { productId, manualProductName, batchNumber, remarks };
}

function useOrderItemWatcherValues(
  form: OrderFormInstance,
  index: number
): OrderItemWatchers {
  const isManualProduct = useOrderItemManualFlag(form, index);
  const quantityMetrics = useOrderItemQuantityMetrics(form, index);
  const unitPrice = useOrderItemPricing(form, index);
  const textWatchers = useOrderItemTextWatchers(form, index);

  return {
    ...textWatchers,
    isManualProduct,
    unitPrice,
    ...quantityMetrics,
  };
}

export function useOrderItemWatchers(
  form: OrderFormInstance,
  index: number
): OrderItemWatchers {
  return useOrderItemWatcherValues(form, index);
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
    const batchSpecMap = new Map(
      (resolvedProduct?.batchSpecs ?? []).map(spec => [spec.batchNumber, spec])
    );
    const normalized = inventoryBatches.map(batch => ({
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      piecesPerUnit:
        typeof batch.piecesPerUnit === 'number' && batch.piecesPerUnit > 0
          ? batch.piecesPerUnit
          : batchSpecMap.get(batch.batchNumber)?.piecesPerUnit,
      weight:
        typeof (batch as { weight?: number }).weight === 'number' &&
        (batch as { weight?: number }).weight! > 0
          ? (batch as { weight?: number }).weight
          : batchSpecMap.get(batch.batchNumber)?.weight,
    }));

    if (
      currentBatchNumber &&
      !normalized.some(batch => batch.batchNumber === currentBatchNumber)
    ) {
      const spec = batchSpecMap.get(currentBatchNumber);
      return [
        {
          batchNumber: currentBatchNumber,
          quantity: 0,
          piecesPerUnit:
            typeof resolvedProduct?.piecesPerUnit === 'number' &&
            resolvedProduct.piecesPerUnit > 0
              ? resolvedProduct.piecesPerUnit
              : spec?.piecesPerUnit,
          weight:
            spec?.weight ??
            (typeof resolvedProduct?.weight === 'number' &&
            resolvedProduct.weight > 0
              ? resolvedProduct.weight
              : undefined),
        },
        ...normalized,
      ];
    }
    return normalized;
  }, [
    currentBatchNumber,
    resolvedProduct?.inventory?.batches,
    resolvedProduct?.piecesPerUnit,
    resolvedProduct?.batchSpecs,
    resolvedProduct?.weight,
  ]);
}

export function useBatchPiecesPerUnitSync(
  form: OrderFormInstance,
  index: number,
  resolvedProduct: Product | null,
  batchNumber: string | undefined,
  isManualProduct: boolean
) {
  React.useEffect(() => {
    if (isManualProduct) {
      return;
    }

    if (!resolvedProduct) {
      return;
    }

    const inventoryBatches = resolvedProduct.inventory?.batches ?? [];
    const matchedBatch = batchNumber
      ? inventoryBatches.find(batch => batch.batchNumber === batchNumber)
      : undefined;

    let nextPieces: number | undefined;
    if (
      matchedBatch &&
      typeof matchedBatch.piecesPerUnit === 'number' &&
      matchedBatch.piecesPerUnit > 0
    ) {
      nextPieces = matchedBatch.piecesPerUnit;
    } else if (
      typeof resolvedProduct.piecesPerUnit === 'number' &&
      resolvedProduct.piecesPerUnit > 0
    ) {
      nextPieces = resolvedProduct.piecesPerUnit;
    } else {
      nextPieces = undefined;
    }

    const currentValue = form.getValues(
      `items.${index}.piecesPerUnit` as const
    );
    const normalizedCurrent =
      typeof currentValue === 'number'
        ? currentValue
        : currentValue === null || currentValue === undefined
          ? undefined
          : Number(currentValue);

    if (normalizedCurrent !== nextPieces) {
      form.setValue(`items.${index}.piecesPerUnit` as const, nextPieces, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [
    form,
    index,
    resolvedProduct,
    batchNumber,
    isManualProduct,
    resolvedProduct?.inventory?.batches,
    resolvedProduct?.piecesPerUnit,
  ]);
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
      form.setValue(`items.${index}.quantity` as const, normalizedQuantity, {
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
          form.setValue(`items.${index}.localQuantity` as const, boundedLocal, {
            shouldDirty: true,
            shouldValidate: false,
          });
          return;
        }
        const expectedTransfer = Math.max(quantity - boundedLocal, 0);
        if (Math.abs(expectedTransfer - transferQuantity) > 0.01) {
          form.setValue(
            `items.${index}.transferQuantity` as const,
            expectedTransfer,
            {
              shouldDirty: true,
              shouldValidate: false,
            }
          );
        }
      } else {
        if (Math.abs(localQuantity) > 0.01) {
          form.setValue(`items.${index}.localQuantity` as const, 0, {
            shouldDirty: true,
            shouldValidate: false,
          });
          return;
        }
        if (Math.abs(transferQuantity - quantity) > 0.01) {
          form.setValue(`items.${index}.transferQuantity` as const, quantity, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }
      }
    } else {
      if (Math.abs(localQuantity - quantity) > 0.01) {
        form.setValue(`items.${index}.localQuantity` as const, quantity, {
          shouldDirty: true,
          shouldValidate: false,
        });
        return;
      }
      if (Math.abs(transferQuantity) > 0.01) {
        form.setValue(`items.${index}.transferQuantity` as const, 0, {
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
          form.setValue(`items.${index}.remarks` as const, remarksText, {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      } catch (_error) {
        if (remarks) {
          form.setValue(`items.${index}.remarks` as const, '', {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      }
    } else if (remarks) {
      form.setValue(`items.${index}.remarks` as const, '', {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [form, index, quantity, piecesPerUnit, remarks]);
}
