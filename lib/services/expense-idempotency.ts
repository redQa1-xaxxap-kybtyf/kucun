import crypto from 'crypto';

export interface ExpenseIdempotencyInput {
  sourceType: string; // e.g. 'sales_order' | 'factory_shipment' | 'purchase_order'
  sourceId: string;
  feeType: string; // e.g. 'freight' | 'processing' | 'packaging' | 'loading_unloading' | 'other'
  feeName: string; // human readable
  feeAmount: number; // >= 0
  expenseDate: Date; // date bucket by yyyy-mm-dd
}

/**
 * 生成费用幂等键
 * 规则：sourceType + sourceId + feeType + normalized(feeName) + feeAmount + date(yyyy-MM-dd)
 * 使用 sha256 得到定长 idempotencyKey
 */
export function generateExpenseIdempotencyKey(
  input: ExpenseIdempotencyInput
): string {
  const normName = input.feeName.trim().toLowerCase();
  const yyyy = input.expenseDate.getFullYear();
  const mm = String(input.expenseDate.getMonth() + 1).padStart(2, '0');
  const dd = String(input.expenseDate.getDate()).padStart(2, '0');
  const dateBucket = `${yyyy}-${mm}-${dd}`;
  const raw = `${input.sourceType}|${input.sourceId}|${input.feeType}|${normName}|${input.feeAmount.toFixed(2)}|${dateBucket}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
