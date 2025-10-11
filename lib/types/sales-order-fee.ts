/**
 * 销售订单费用项类型定义
 */

export type FeeType = 'processing' | 'shipping' | 'other';

export interface SalesOrderFeeItem {
  id?: string;
  feeType: FeeType;
  feeName: string;
  feeAmount: number;
  remarks?: string;
}

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  processing: '加工费',
  shipping: '运费',
  other: '其他费用',
};

export const FEE_TYPE_OPTIONS = [
  { value: 'processing' as FeeType, label: '加工费' },
  { value: 'shipping' as FeeType, label: '运费' },
  { value: 'other' as FeeType, label: '其他费用' },
];
