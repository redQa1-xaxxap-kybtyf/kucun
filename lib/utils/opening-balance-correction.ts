import {
  COST_PRICE_MAX,
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

type UnitCostEntryMode = 'piece' | 'unit';

function normalizeUnitCostInput(input: string) {
  return input
    .trim()
    .replace(/\s+/gu, '')
    .replace(/[￥¥]/gu, '')
    .replace(/／/gu, '/')
    .replace(/元/gu, '');
}

function parseUnitCostEntry(input: string): {
  value: number;
  mode: UnitCostEntryMode;
} {
  const normalized = normalizeUnitCostInput(input);

  if (!normalized) {
    throw new Error('请输入单位成本');
  }

  const unitMatch = normalized.match(
    /^(\d+(?:\.\d+)?)(?:\/件|每件|件价|件单价)$/u
  );
  if (unitMatch) {
    return {
      value: Number(unitMatch[1]),
      mode: 'unit',
    };
  }

  const pieceMatch = normalized.match(
    /^(\d+(?:\.\d+)?)(?:\/片|每片|片价|片单价)?$/u
  );
  if (pieceMatch) {
    return {
      value: Number(pieceMatch[1]),
      mode: 'piece',
    };
  }

  throw new Error('单位成本格式不正确，支持格式：24、24片价、96元/件');
}

export function convertOpeningBalanceCurrentUnitEntryToPieceValues(
  input: OpeningBalanceCurrentUnitEntryInput
): OpeningBalanceCurrentUnitEntryConversionResult {
  const piecesPerUnit = toNumber(input.piecesPerUnit, Number.NaN);
  if (!Number.isInteger(piecesPerUnit) || piecesPerUnit <= 0) {
    throw new Error('当前记录缺少有效装箱数，不能按件口径自动换算');
  }

  const quantity = toNumber(input.quantity, Number.NaN);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('当前记录缺少有效数量，不能按件口径自动换算');
  }

  const convertedQuantity = quantity * piecesPerUnit;

  const rawUnitCost = toNumber(input.unitCost, Number.NaN);
  return {
    quantity: convertedQuantity,
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
  const piecesPerUnit = toNumber(input.piecesPerUnit, Number.NaN);
  if (!Number.isInteger(piecesPerUnit) || piecesPerUnit <= 0) {
    throw new Error('当前记录缺少有效装箱数，不能按件口径自动换算');
  }

  const quantity = toNumber(input.quantity, Number.NaN);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('当前记录缺少有效数量，不能按件口径自动换算');
  }

  const rawUnitCost = toNumber(input.unitCost, Number.NaN);

  if (savedQuantityMode === 'piece') {
    return {
      quantity,
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
  piecesPerUnit: number
): number {
  const entry = parseUnitCostEntry(input);
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
