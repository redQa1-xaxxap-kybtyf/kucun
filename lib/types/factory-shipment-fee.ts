/**
 * 厂家发货订单费用项类型定义
 *
 * 费用类型统一规范,与销售订单费用体系保持一致
 * 添加 paidBy 字段支持客户/公司费用区分
 */

import {
  FACTORY_SHIPMENT_FEE_TYPE_LABELS,
  FACTORY_SHIPMENT_FEE_TYPE_OPTIONS,
  FEE_PAID_BY_LABELS,
  FEE_PAID_BY_OPTIONS,
  getDefaultFeePaidBy as getDefaultFeePaidByUnified,
  type FactoryShipmentFeeType,
  type FeePaidBy,
} from './unified-fee';

// 重新导出类型(使用本地别名)
export type { FactoryShipmentFeeType };
export type FactoryShipmentFeePaidBy = FeePaidBy;

// 重新导出标签和选项
export { FACTORY_SHIPMENT_FEE_TYPE_LABELS, FACTORY_SHIPMENT_FEE_TYPE_OPTIONS };
export const FACTORY_SHIPMENT_FEE_PAID_BY_LABELS = FEE_PAID_BY_LABELS;
export const FACTORY_SHIPMENT_FEE_PAID_BY_OPTIONS = FEE_PAID_BY_OPTIONS;

// 重新导出默认承担方函数
export const getDefaultFactoryShipmentFeePaidBy = (
  feeType?: FactoryShipmentFeeType
): FactoryShipmentFeePaidBy => getDefaultFeePaidByUnified(feeType);

// 厂家发货费用项接口
export interface FactoryShipmentFeeItem {
  id?: string;
  feeType: FactoryShipmentFeeType;
  feeName: string;
  feeAmount: number;
  paidBy: FactoryShipmentFeePaidBy;
  remarks?: string;
}
