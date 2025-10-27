import { formatCurrency } from '@/lib/utils';


const CHANGE_TOLERANCE = 0.05;
const FINANCE_EPSILON = 0.000001;

export function isMeaningfulAmount(value: number): boolean {
  return Math.abs(value) > FINANCE_EPSILON;
}

export function formatCurrencyWithSign(
  value: number,
  {
    positiveSign = '+',
    negativeSign = '-',
  }: { positiveSign?: string; negativeSign?: string } = {}
): string {
  if (!isMeaningfulAmount(value)) {
    return formatCurrency(0);
  }

  const absValue = Math.abs(value);
  const sign = value >= 0 ? positiveSign : negativeSign;
  return `${sign}${formatCurrency(absValue)}`;
}

export function formatCollectionRateChange(change: number): string {
  if (Math.abs(change) < CHANGE_TOLERANCE) {
    return '较上月持平';
  }

  const value = Math.abs(change).toFixed(1);
  return change > 0 ? `较上月提升 ${value}%` : `较上月下降 ${value}%`;
}

