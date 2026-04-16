import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';

export interface SalesOrderDisplayProductLike {
  code?: string | null;
  name?: string | null;
  specification?: string | null;
  unit?: string | null;
  piecesPerUnit?: number | null;
  weight?: number | null;
}

export interface SalesOrderDisplayItemLike {
  quantity?: number | null;
  unitPrice?: number | null;
  subtotal?: number | null;
  displayUnit?: string | null;
  displayQuantity?: number | null;
  piecesPerUnit?: number | null;
  batchPiecesPerUnit?: number | null;
  isManualProduct?: boolean | null;
  manualProductName?: string | null;
  manualSpecification?: string | null;
  manualWeight?: number | null;
  manualUnit?: string | null;
  productCode?: string | null;
  specification?: string | null;
  weightSnapshot?: number | null;
  batchWeight?: number | null;
  product?: SalesOrderDisplayProductLike | null;
}

function normalizePieces(totalPieces: number | null | undefined): number {
  const numeric = Number(totalPieces ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.floor(numeric);
}

function normalizePositiveNumber(
  value: number | null | undefined
): number | undefined {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }

  return numeric;
}

export function getSalesOrderPiecesPerUnit(
  item: SalesOrderDisplayItemLike
): number | undefined {
  const piecesPerUnit = normalizePositiveNumber(
    item.piecesPerUnit ?? item.batchPiecesPerUnit ?? item.product?.piecesPerUnit
  );

  if (!piecesPerUnit || !Number.isInteger(piecesPerUnit)) {
    return undefined;
  }

  return piecesPerUnit;
}

export function getSalesOrderRawDisplayUnit(
  item: SalesOrderDisplayItemLike
): string | undefined {
  const rawUnit =
    item.displayUnit ??
    (item.isManualProduct ? item.manualUnit : undefined) ??
    item.product?.unit;

  if (typeof rawUnit !== 'string') {
    return undefined;
  }

  const trimmedUnit = rawUnit.trim();
  if (trimmedUnit.length === 0) {
    return undefined;
  }

  return (
    PRODUCT_UNIT_LABELS[trimmedUnit as keyof typeof PRODUCT_UNIT_LABELS] ??
    trimmedUnit
  );
}

export function getSalesOrderNormalizedDisplayUnit(
  item: SalesOrderDisplayItemLike
): string {
  const rawDisplayUnit = getSalesOrderRawDisplayUnit(item);
  const piecesPerUnit = getSalesOrderPiecesPerUnit(item);

  if (rawDisplayUnit === '件' && (!piecesPerUnit || piecesPerUnit <= 1)) {
    return '片';
  }

  return rawDisplayUnit ?? '-';
}

export function getSalesOrderItemDisplayName(
  item: SalesOrderDisplayItemLike
): string {
  const manualName =
    typeof item.manualProductName === 'string'
      ? item.manualProductName.trim()
      : '';
  const productName =
    typeof item.product?.name === 'string' ? item.product.name.trim() : '';
  const productCode =
    typeof item.productCode === 'string' ? item.productCode.trim() : '';

  if (item.isManualProduct) {
    return manualName || productCode || '临时产品';
  }

  return productName || productCode || '-';
}

export function getSalesOrderItemDisplayCode(
  item: SalesOrderDisplayItemLike
): string {
  const manualCode =
    typeof item.productCode === 'string' ? item.productCode.trim() : '';
  const productCode =
    typeof item.product?.code === 'string' ? item.product.code.trim() : '';

  if (item.isManualProduct) {
    return manualCode || '-';
  }

  return productCode || manualCode || '-';
}

export function getSalesOrderItemSpecification(
  item: SalesOrderDisplayItemLike
): string {
  const rowSpecification =
    typeof item.specification === 'string' ? item.specification.trim() : '';
  const manualSpecification =
    typeof item.manualSpecification === 'string'
      ? item.manualSpecification.trim()
      : '';
  const productSpecification =
    typeof item.product?.specification === 'string'
      ? item.product.specification.trim()
      : '';

  if (item.isManualProduct) {
    return manualSpecification || rowSpecification || '-';
  }

  return rowSpecification || productSpecification || '-';
}

export function formatSalesOrderPieceBreakdown(
  totalPieces: number | null | undefined,
  piecesPerUnit?: number | null
): string {
  const normalizedPieces = normalizePieces(totalPieces);

  if (
    typeof piecesPerUnit !== 'number' ||
    !Number.isInteger(piecesPerUnit) ||
    piecesPerUnit <= 1
  ) {
    return `${normalizedPieces}片`;
  }

  const result = calculatePieceDisplay(normalizedPieces, piecesPerUnit);

  if (result.fullUnits === 0) {
    return `${result.remainingPieces}片`;
  }

  if (result.remainingPieces === 0) {
    return `${result.fullUnits}件`;
  }

  return `${result.fullUnits}件${result.remainingPieces}片`;
}

export function getSalesOrderItemQuantityText(
  item: SalesOrderDisplayItemLike
): string {
  return formatSalesOrderPieceBreakdown(
    item.quantity,
    getSalesOrderPiecesPerUnit(item)
  );
}

export function getSalesOrderDisplayQuantityValue(
  item: SalesOrderDisplayItemLike
): number {
  const normalizedUnit = getSalesOrderNormalizedDisplayUnit(item);
  const quantityPieces = normalizePieces(item.quantity);
  const piecesPerUnit = getSalesOrderPiecesPerUnit(item);

  if (normalizedUnit === '件' && piecesPerUnit && piecesPerUnit > 1) {
    const displayQuantity = normalizePositiveNumber(item.displayQuantity);

    if (displayQuantity) {
      return displayQuantity;
    }

    return quantityPieces / piecesPerUnit;
  }

  return quantityPieces;
}

export function getSalesOrderDisplayUnitPrice(
  item: SalesOrderDisplayItemLike
): number {
  const unitPricePiece = Number(item.unitPrice ?? 0);

  if (!Number.isFinite(unitPricePiece)) {
    return 0;
  }

  const normalizedUnit = getSalesOrderNormalizedDisplayUnit(item);
  const piecesPerUnit = getSalesOrderPiecesPerUnit(item);

  if (normalizedUnit === '件' && piecesPerUnit && piecesPerUnit > 1) {
    const units = getSalesOrderDisplayQuantityValue(item);

    if (units > 0 && typeof item.subtotal === 'number' && item.subtotal > 0) {
      const perUnit = item.subtotal / units;
      if (Number.isFinite(perUnit)) {
        return perUnit;
      }
    }

    return unitPricePiece * piecesPerUnit;
  }

  return unitPricePiece;
}

export function getSalesOrderItemWeightKg(
  item: SalesOrderDisplayItemLike
): number | null {
  const quantityPieces = normalizePieces(item.quantity);

  if (!quantityPieces) {
    return null;
  }

  const normalizedUnit = getSalesOrderNormalizedDisplayUnit(item);
  const piecesPerUnit = getSalesOrderPiecesPerUnit(item);

  let weightKg: number | undefined;

  if (item.isManualProduct) {
    const manualWeight = normalizePositiveNumber(item.manualWeight);

    if (!manualWeight) {
      return null;
    }

    if (normalizedUnit === '件') {
      const displayQty = getSalesOrderDisplayQuantityValue(item);
      weightKg = displayQty > 0 ? manualWeight * displayQty : undefined;
    } else {
      weightKg = manualWeight * quantityPieces;
    }
  } else {
    const weightPerUnit = normalizePositiveNumber(
      item.weightSnapshot ?? item.batchWeight ?? item.product?.weight
    );

    if (!weightPerUnit) {
      return null;
    }

    if (normalizedUnit === '件') {
      const displayQty = getSalesOrderDisplayQuantityValue(item);
      weightKg = displayQty > 0 ? weightPerUnit * displayQty : undefined;
    } else if (piecesPerUnit && piecesPerUnit > 0) {
      weightKg = (weightPerUnit / piecesPerUnit) * quantityPieces;
    } else {
      weightKg = weightPerUnit * quantityPieces;
    }
  }

  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  return weightKg;
}

export function getSalesOrderTotalPieces(
  items: SalesOrderDisplayItemLike[] | undefined
): number {
  if (!items || items.length === 0) {
    return 0;
  }

  return items.reduce((sum, item) => sum + normalizePieces(item.quantity), 0);
}

export function getSalesOrderTotalQuantitySummary(
  items: SalesOrderDisplayItemLike[] | undefined
): string {
  const totalPieces = getSalesOrderTotalPieces(items);

  if (!items || items.length === 0) {
    return '0片';
  }

  const uniquePiecesPerUnit = Array.from(
    new Set(
      items
        .map(item => getSalesOrderPiecesPerUnit(item))
        .filter(
          (piecesPerUnit): piecesPerUnit is number =>
            typeof piecesPerUnit === 'number' && piecesPerUnit > 1
        )
    )
  );

  if (uniquePiecesPerUnit.length === 1) {
    return `${formatSalesOrderPieceBreakdown(
      totalPieces,
      uniquePiecesPerUnit[0]
    )}（共${totalPieces}片）`;
  }

  return `${totalPieces}片`;
}

export function getSalesOrderTotalWeightKg(
  items: SalesOrderDisplayItemLike[] | undefined
): number {
  if (!items || items.length === 0) {
    return 0;
  }

  return items.reduce(
    (sum, item) => sum + (getSalesOrderItemWeightKg(item) ?? 0),
    0
  );
}
