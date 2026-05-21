import {
  COST_PRICE_MAX,
  formatCostPrice,
  hasAtMostCostPriceDecimals,
  roundCostPrice,
} from '@/lib/utils/cost-price';
import { toNumber } from '@/lib/utils/number';

export interface OpeningBalanceCurrentUnitEntryInput {
  quantity: number;
  unitCost?: number | null;
  piecesPerUnit: number;
}

export interface OpeningBalanceCurrentUnitEntryConversionResult {
  quantity: number;
  unitCost?: number;
}

export type OpeningBalanceSavedQuantityMode = 'piece' | 'unit';

export type OpeningBalanceUnitCostEntryMode = 'piece' | 'unit';

const PIECE_QUANTITY_TOLERANCE = 1e-8;

function normalizeUnitCostInput(input: string) {
  return input
    .trim()
    .replace(/\s+/gu, '')
    .replace(/[，,]/gu, '')
    .replace(/[￥¥]/gu, '')
    .replace(/／/gu, '/')
    .replace(/元/gu, '');
}

function parseUnitCostEntry(
  input: string,
  defaultMode: OpeningBalanceUnitCostEntryMode = 'piece'
): {
  value: number;
  mode: OpeningBalanceUnitCostEntryMode;
} {
  const normalized = normalizeUnitCostInput(input);

  if (!normalized) {
    throw new Error('请输入单位成本');
  }

  const unitMatch = normalized.match(
    /^(\d+(?:\.\d*)?)(?:\/件|每件|件价|件单价)$/u
  );
  if (unitMatch) {
    return {
      value: Number(unitMatch[1]),
      mode: 'unit',
    };
  }

  const explicitPieceMatch = normalized.match(
    /^(\d+(?:\.\d*)?)(?:\/片|每片|片价|片单价)$/u
  );
  if (explicitPieceMatch) {
    return {
      value: Number(explicitPieceMatch[1]),
      mode: 'piece',
    };
  }

  const plainNumericMatch = normalized.match(/^(\d+(?:\.\d*)?)$/u);
  if (plainNumericMatch) {
    return {
      value: Number(plainNumericMatch[1]),
      mode: defaultMode,
    };
  }

  throw new Error('单位成本格式不正确，支持格式：24、24片价、96元/件');
}

function normalizePiecesPerUnit(piecesPerUnit: number) {
  const normalizedPiecesPerUnit = toNumber(piecesPerUnit, Number.NaN);
  if (
    !Number.isInteger(normalizedPiecesPerUnit) ||
    normalizedPiecesPerUnit <= 0
  ) {
    throw new Error('当前记录缺少有效装箱数，不能按件口径自动换算');
  }

  return normalizedPiecesPerUnit;
}

function normalizeSavedPieceQuantity(quantity: number) {
  const normalizedQuantity = toNumber(quantity, Number.NaN);
  if (!Number.isSafeInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error('当前记录缺少有效数量，不能按件口径自动换算');
  }

  return normalizedQuantity;
}

function convertUnitQuantityToPieces(quantity: number, piecesPerUnit: number) {
  const normalizedQuantity = toNumber(quantity, Number.NaN);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error('当前记录缺少有效数量，不能按件口径自动换算');
  }

  const convertedQuantity = normalizedQuantity * piecesPerUnit;
  const roundedQuantity = Math.round(convertedQuantity);

  if (
    !Number.isSafeInteger(roundedQuantity) ||
    roundedQuantity <= 0 ||
    Math.abs(convertedQuantity - roundedQuantity) > PIECE_QUANTITY_TOLERANCE
  ) {
    throw new Error('换算后的片数必须是整数，请检查件数和装箱数后重试');
  }

  return roundedQuantity;
}

export function convertOpeningBalanceCurrentUnitEntryToPieceValues(
  input: OpeningBalanceCurrentUnitEntryInput
): OpeningBalanceCurrentUnitEntryConversionResult {
  const piecesPerUnit = normalizePiecesPerUnit(input.piecesPerUnit);
  const rawUnitCost = toNumber(input.unitCost, Number.NaN);

  return {
    quantity: convertUnitQuantityToPieces(input.quantity, piecesPerUnit),
    ...(Number.isFinite(rawUnitCost)
      ? {
          unitCost: roundCostPrice(rawUnitCost / piecesPerUnit),
        }
      : {}),
  };
}

export function buildOpeningBalanceSavedValuePreview(
  input: OpeningBalanceCurrentUnitEntryInput,
  savedQuantityMode: OpeningBalanceSavedQuantityMode
): OpeningBalanceCurrentUnitEntryConversionResult {
  const rawUnitCost = toNumber(input.unitCost, Number.NaN);

  if (savedQuantityMode === 'piece') {
    return {
      quantity: normalizeSavedPieceQuantity(input.quantity),
      ...(Number.isFinite(rawUnitCost)
        ? {
            unitCost: roundCostPrice(rawUnitCost),
          }
        : {}),
    };
  }

  return convertOpeningBalanceCurrentUnitEntryToPieceValues(input);
}

export function parseOpeningBalanceUnitCostInput(
  input: string,
  piecesPerUnit: number,
  defaultMode: OpeningBalanceUnitCostEntryMode = 'piece'
): number {
  const entry = parseUnitCostEntry(input, defaultMode);
  const numeric = entry.value;

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('单位成本必须是大于等于 0 的数字');
  }

  if (entry.mode === 'piece') {
    if (numeric > COST_PRICE_MAX) {
      throw new Error(`单位成本不能超过 ${COST_PRICE_MAX}`);
    }

    if (!hasAtMostCostPriceDecimals(numeric)) {
      throw new Error('单位成本最多保留 3 位小数');
    }

    return roundCostPrice(numeric);
  }

  const normalizedPiecesPerUnit = toNumber(piecesPerUnit, Number.NaN);
  if (
    !Number.isInteger(normalizedPiecesPerUnit) ||
    normalizedPiecesPerUnit <= 0
  ) {
    throw new Error('按件录入的单位成本需要先维护每件片数后才能换算');
  }

  const converted = roundCostPrice(numeric / normalizedPiecesPerUnit);
  if (converted > COST_PRICE_MAX) {
    throw new Error(`单位成本不能超过 ${COST_PRICE_MAX}`);
  }

  return converted;
}

export function formatOpeningBalanceUnitCostForEntryMode(
  unitCost: number | null | undefined,
  piecesPerUnit: number,
  mode: OpeningBalanceUnitCostEntryMode
): string {
  const numeric = toNumber(unitCost, Number.NaN);

  if (!Number.isFinite(numeric)) {
    return '';
  }

  if (mode === 'piece') {
    return formatCostPrice(roundCostPrice(numeric), { withSymbol: false });
  }

  const normalizedPiecesPerUnit = toNumber(piecesPerUnit, Number.NaN);
  if (
    !Number.isInteger(normalizedPiecesPerUnit) ||
    normalizedPiecesPerUnit <= 0
  ) {
    throw new Error('按件录入的单位成本需要先维护每件片数后才能换算');
  }

  return formatCostPrice(roundCostPrice(numeric * normalizedPiecesPerUnit), {
    withSymbol: false,
  });
}

export function convertOpeningBalanceUnitCostInputMode(
  input: string,
  piecesPerUnit: number,
  fromMode: OpeningBalanceUnitCostEntryMode,
  toMode: OpeningBalanceUnitCostEntryMode
): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return '';
  }

  const pieceUnitCost = parseOpeningBalanceUnitCostInput(
    trimmed,
    piecesPerUnit,
    fromMode
  );

  return formatOpeningBalanceUnitCostForEntryMode(
    pieceUnitCost,
    piecesPerUnit,
    toMode
  );
}
