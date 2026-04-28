'use client';

import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import type { Product } from '@/lib/types/product';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';
import {
  getInventoryBatchAvailableQuantity,
  getInventoryBatchReservedQuantity,
} from '@/lib/utils/product-inventory';
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

export interface OrderItemControllerData {
  form: OrderFormInstance;
  index: number;
  isManualProduct: boolean;
  resolvedProduct: Product | null;
  availableBatches: Array<{
    batchNumber: string;
    quantity: number;
    reservedQuantity?: number;
    piecesPerUnit?: number;
    weight?: number | null;
  }>;
  localQuantityDisplay: number;
  transferQuantityDisplay: number;
  itemAmount: number;
  formatQuantity: (value: number) => string;
  watchedProductId?: string;
  onProductOverride: (product: Product | null) => void;
  watchers: OrderItemWatchers;
}

export interface UseOrderItemControllerParams {
  index: number;
  products: Product[];
  onProductChange?: (index: number, product: Product | null) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  transferMode?: TransferFulfillmentMode;
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
    const normalized = inventoryBatches
      .map(batch => {
        const batchWeight = (batch as { weight?: number }).weight;
        const normalizedWeight =
          typeof batchWeight === 'number' && batchWeight > 0
            ? batchWeight
            : batchSpecMap.get(batch.batchNumber)?.weight;

        return {
          batchNumber: batch.batchNumber,
          quantity: getInventoryBatchAvailableQuantity(batch),
          reservedQuantity: getInventoryBatchReservedQuantity(batch),
          piecesPerUnit:
            typeof batch.piecesPerUnit === 'number' && batch.piecesPerUnit > 0
              ? batch.piecesPerUnit
              : batchSpecMap.get(batch.batchNumber)?.piecesPerUnit,
          weight: normalizedWeight,
        };
      })
      .filter(
        batch => batch.quantity > 0 || batch.batchNumber === currentBatchNumber
      );

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
    const nextRemarks = getNextAutoRemarksValue(
      quantity,
      piecesPerUnit,
      remarks
    );
    const currentRemarks = remarks?.trim() ?? '';

    if (nextRemarks === null || nextRemarks === currentRemarks) {
      return;
    }

    try {
      form.setValue(`items.${index}.remarks` as const, nextRemarks, {
        shouldDirty: false,
        shouldValidate: false,
      });
    } catch (_error) {
      // ignore
    }
  }, [form, index, quantity, piecesPerUnit, remarks]);
}

export function useOrderItemController({
  index,
  products,
  onProductChange,
  orderType,
  transferMode,
}: UseOrderItemControllerParams): OrderItemControllerData {
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

  useBatchPiecesPerUnitSync(
    form,
    index,
    resolvedProduct,
    watchers.batchNumber,
    isManualProduct
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
    isManualProduct,
    resolvedProduct,
    availableBatches,
    localQuantityDisplay,
    transferQuantityDisplay,
    itemAmount,
    formatQuantity,
    watchedProductId: watchers.productId,
    onProductOverride: handleProductOverride,
    watchers,
  };
}

export function buildAutoRemarksText(
  quantity: number,
  piecesPerUnit: number
): string {
  if (quantity <= 0 || piecesPerUnit <= 1) {
    return '';
  }

  const result = calculatePieceDisplay(Math.floor(quantity), piecesPerUnit);

  if (result.fullUnits === 0) {
    return `${result.remainingPieces}片`;
  }

  if (result.remainingPieces === 0) {
    return `${result.fullUnits}件`;
  }

  return `${result.fullUnits}件${result.remainingPieces}片`;
}

export function isAutoRemarksText(value?: string): boolean {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return false;
  }

  return /^(\d+片|\d+件|\d+件\d+片)$/.test(normalized);
}

export function getNextAutoRemarksValue(
  quantity: number,
  piecesPerUnit: number,
  currentRemarks?: string
): string | null {
  const normalizedCurrentRemarks = currentRemarks?.trim() ?? '';
  const allowAutoUpdate =
    normalizedCurrentRemarks.length === 0 ||
    isAutoRemarksText(normalizedCurrentRemarks);

  if (!allowAutoUpdate) {
    return null;
  }

  return buildAutoRemarksText(quantity, piecesPerUnit);
}
