import { roundToDecimals } from '@/lib/utils/precision';

export const COST_PRICE_PRECISION = 3;
export const COST_PRICE_STEP = '0.001';
export const COST_PRICE_SCALE = 10 ** COST_PRICE_PRECISION;
export const COST_PRICE_MAX = 999999.999;
export const COST_PRICE_MAX_LABEL = '999,999.999';

export function roundCostPrice(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return roundToDecimals(numeric, COST_PRICE_PRECISION);
}

export function hasAtMostCostPriceDecimals(value: number): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }

  return (
    Math.abs(value * COST_PRICE_SCALE - Math.round(value * COST_PRICE_SCALE)) <
    1e-8
  );
}

export function formatCostPrice(
  value: unknown,
  options: {
    withSymbol?: boolean;
    fallback?: string;
  } = {}
): string {
  const { withSymbol = true } = options;
  const fallback =
    options.fallback ?? (withSymbol ? '￥0.000' : '0.000');
  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const formatted = roundCostPrice(numeric).toLocaleString('zh-CN', {
    minimumFractionDigits: COST_PRICE_PRECISION,
    maximumFractionDigits: COST_PRICE_PRECISION,
  });

  return withSymbol ? `￥${formatted}` : formatted;
}
