export function roundPaymentOutAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computePaymentOutRounding(
  paymentAmount: number,
  actualPaymentAmount: number
): number {
  return roundPaymentOutAmount(paymentAmount - actualPaymentAmount);
}

export function normalizePaymentOutAmounts(input: {
  paymentAmount: number;
  actualPaymentAmount?: number | null;
  roundingAmount?: number | null;
}) {
  const paymentAmount = roundPaymentOutAmount(input.paymentAmount);
  const actualPaymentAmount = roundPaymentOutAmount(
    input.actualPaymentAmount ?? paymentAmount
  );
  const roundingAmount =
    input.roundingAmount === undefined || input.roundingAmount === null
      ? computePaymentOutRounding(paymentAmount, actualPaymentAmount)
      : roundPaymentOutAmount(input.roundingAmount);

  return {
    paymentAmount,
    actualPaymentAmount,
    roundingAmount,
  };
}
