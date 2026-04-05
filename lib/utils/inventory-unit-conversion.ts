import { PRODUCT_UNITS } from '@/lib/config/product';
import { roundCostPrice } from '@/lib/utils/cost-price';
import { toNumber } from '@/lib/utils/number';

export interface InventoryUnitConversionInput {
  quantity?: unknown;
  unitPrice?: unknown;
  unit?: string | null;
  piecesPerUnit?: unknown;
  displayName?: string | null;
  productCode?: string | null;
}

export interface InventoryUnitConversionOptions {
  strict?: boolean;
  fallbackLabel?: string;
}

export class InventoryUnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryUnitConversionError';
  }
}

export function normalizeInventoryUnit(
  unit?: string | null
): typeof PRODUCT_UNITS.PIECE | typeof PRODUCT_UNITS.SHEET {
  const normalizedUnit = unit?.trim().toLowerCase();

  if (
    normalizedUnit === PRODUCT_UNITS.PIECE ||
    normalizedUnit === 'pieces' ||
    normalizedUnit === 'unit' ||
    normalizedUnit === 'units' ||
    normalizedUnit === '件'
  ) {
    return PRODUCT_UNITS.PIECE;
  }

  return PRODUCT_UNITS.SHEET;
}

export function isPieceEntryUnit(unit?: string | null): boolean {
  return normalizeInventoryUnit(unit) === PRODUCT_UNITS.PIECE;
}

export function toPieceOrSheetLabel(unit?: string | null): '件' | '片' {
  return isPieceEntryUnit(unit) ? '件' : '片';
}

function getItemLabel(
  item: InventoryUnitConversionInput,
  fallbackLabel = '明细'
): string {
  const displayName = item.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const productCode = item.productCode?.trim();
  if (productCode) {
    return productCode;
  }

  return fallbackLabel;
}

function getValidatedPiecesPerUnit(
  item: InventoryUnitConversionInput,
  options: InventoryUnitConversionOptions = {}
): number | null {
  if (!isPieceEntryUnit(item.unit)) {
    return null;
  }

  const piecesPerUnit = toNumber(item.piecesPerUnit, Number.NaN);
  if (Number.isInteger(piecesPerUnit) && piecesPerUnit > 0) {
    return piecesPerUnit;
  }

  if (options.strict) {
    throw new InventoryUnitConversionError(
      `${getItemLabel(item, options.fallbackLabel)} 按件录入时必须维护“每件片数”后才能继续`
    );
  }

  return null;
}

export function convertQuantityToPieces(
  item: InventoryUnitConversionInput,
  options: InventoryUnitConversionOptions = {}
): number {
  const quantity = toNumber(item.quantity, 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  const piecesPerUnit = getValidatedPiecesPerUnit(item, options);
  if (piecesPerUnit === null) {
    return quantity;
  }

  const totalPieces = quantity * piecesPerUnit;
  if (Number.isInteger(totalPieces)) {
    return totalPieces;
  }

  throw new InventoryUnitConversionError(
    `${getItemLabel(item, options.fallbackLabel)} 换算后不是整数片数，无法自动入库`
  );
}

export function convertUnitPriceToPieceCost(
  item: InventoryUnitConversionInput,
  options: InventoryUnitConversionOptions = {}
): number {
  const unitPrice = toNumber(item.unitPrice, 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return roundCostPrice(0);
  }

  const piecesPerUnit = getValidatedPiecesPerUnit(item, options);
  if (piecesPerUnit === null) {
    return roundCostPrice(unitPrice);
  }

  return roundCostPrice(unitPrice / piecesPerUnit);
}

export function isInventoryUnitConversionError(
  error: unknown
): error is InventoryUnitConversionError {
  return error instanceof InventoryUnitConversionError;
}
