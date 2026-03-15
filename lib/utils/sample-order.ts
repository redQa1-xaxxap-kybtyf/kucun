const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const SAMPLE_SETTLEMENT_TYPE_VALUES = ['FREE', 'CHARGEABLE'] as const;

export type SampleSettlementType =
  (typeof SAMPLE_SETTLEMENT_TYPE_VALUES)[number];

export const DEFAULT_SAMPLE_SETTLEMENT_TYPE: SampleSettlementType = 'FREE';

export const SAMPLE_SETTLEMENT_TYPE_LABELS: Record<
  SampleSettlementType,
  string
> = {
  FREE: '免费样品',
  CHARGEABLE: '收费样品',
};

type SampleOrderLike = {
  isSampleOrder?: boolean | null;
  sampleSettlementType?: string | null;
  totalAmount?: unknown;
  roundingAdjustment?: unknown;
};

export function normalizeSampleSettlementType(
  isSampleOrder?: boolean | null,
  sampleSettlementType?: string | null
): SampleSettlementType {
  if (!isSampleOrder) {
    return DEFAULT_SAMPLE_SETTLEMENT_TYPE;
  }

  return sampleSettlementType === 'CHARGEABLE'
    ? 'CHARGEABLE'
    : DEFAULT_SAMPLE_SETTLEMENT_TYPE;
}

export function isChargeableSampleOrder(
  order: Pick<SampleOrderLike, 'isSampleOrder' | 'sampleSettlementType'>
) {
  return (
    Boolean(order.isSampleOrder) &&
    normalizeSampleSettlementType(
      order.isSampleOrder,
      order.sampleSettlementType
    ) === 'CHARGEABLE'
  );
}

export function shouldCreateReceivableForOrder(
  order: Pick<SampleOrderLike, 'isSampleOrder' | 'sampleSettlementType'>
) {
  if (!order.isSampleOrder) {
    return true;
  }

  return isChargeableSampleOrder(order);
}

export function getSalesOrderReceivableTotal(order: SampleOrderLike) {
  if (!shouldCreateReceivableForOrder(order)) {
    return 0;
  }

  const totalAmount = toFiniteNumber(order.totalAmount);
  const roundingAdjustment = toFiniteNumber(order.roundingAdjustment);

  return Number((totalAmount + roundingAdjustment).toFixed(2));
}
