/**
 * 支付状态计算工具函数
 *
 * 遵循规范：
 * 1. 函数不超过50行
 * 2. 使用 TypeScript 类型安全
 * 3. 纯函数，无副作用
 */

/**
 * 支付状态类型
 */
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

/**
 * 计算支付状态
 *
 * @param paidAmount - 已支付金额
 * @param totalAmount - 订单总金额
 * @param orderDate - 订单日期
 * @param dueDays - 到期天数（默认30天）
 * @returns 支付状态
 */
export function calculatePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  orderDate: Date,
  dueDays: number = 30
): PaymentStatus {
  // 已全额支付
  if (paidAmount >= totalAmount) {
    return 'paid';
  }

  // 计算订单天数
  const daysSinceOrder = Math.floor(
    (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 逾期判断
  if (daysSinceOrder > dueDays) {
    return 'overdue';
  }

  // 部分支付
  if (paidAmount > 0) {
    return 'partial';
  }

  // 未支付
  return 'unpaid';
}

/**
 * 计算逾期天数
 *
 * @param orderDate - 订单日期
 * @param dueDays - 到期天数（默认30天）
 * @returns 逾期天数（未逾期返回0）
 */
export function calculateOverdueDays(
  orderDate: Date,
  dueDays: number = 30
): number {
  const daysSinceOrder = Math.floor(
    (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, daysSinceOrder - dueDays);
}

/**
 * 计算到期日期
 *
 * @param orderDate - 订单日期
 * @param dueDays - 到期天数（默认30天）
 * @returns 到期日期（ISO 8601格式）
 */
export function calculateDueDate(
  orderDate: Date,
  dueDays: number = 30
): string {
  const dueDate = new Date(orderDate.getTime() + dueDays * 24 * 60 * 60 * 1000);
  return dueDate.toISOString().split('T')[0];
}
