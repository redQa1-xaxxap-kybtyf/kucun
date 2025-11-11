/**
 * 销售订单费用项类型定义
 *
 * 此文件保留用于向后兼容,新代码请使用 unified-fee.ts
 */

import {
  SALES_ORDER_FEE_TYPE_LABELS,
  SALES_ORDER_FEE_TYPE_OPTIONS,
  FEE_PAID_BY_LABELS,
  FEE_PAID_BY_OPTIONS,
  getDefaultFeePaidBy as getDefaultFeePaidByUnified,
  type SalesOrderFeeType,
  type FeePaidBy,
} from './unified-fee';

// 重新导出类型
export type FeeType = SalesOrderFeeType;
export type { FeePaidBy };

// 重新导出标签和选项(使用原名称保持向后兼容)
export const FEE_TYPE_LABELS = SALES_ORDER_FEE_TYPE_LABELS;
export const FEE_TYPE_OPTIONS = SALES_ORDER_FEE_TYPE_OPTIONS;
export { FEE_PAID_BY_LABELS, FEE_PAID_BY_OPTIONS };

// 重新导出默认承担方函数
export const getDefaultFeePaidBy = (feeType?: FeeType): FeePaidBy =>
  getDefaultFeePaidByUnified(feeType);

// 销售订单费用项接口
export interface SalesOrderFeeItem {
  id?: string;
  feeType: FeeType;
  feeName: string;
  feeAmount: number;
  paidBy: FeePaidBy;
  remarks?: string;
}
