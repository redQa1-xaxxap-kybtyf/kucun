/**
 * 厂家发货订单费用项类型定义
 *
 * 费用类型与销售订单保持一致，便于统一管理
 */

export type FactoryShipmentFeeType =
  | 'shipping'
  | 'storage'
  | 'customs'
  | 'other';

export interface FactoryShipmentFeeItem {
  id?: string;
  feeType: FactoryShipmentFeeType;
  feeName: string;
  feeAmount: number;
  remarks?: string;
}

export const FACTORY_SHIPMENT_FEE_TYPE_LABELS: Record<
  FactoryShipmentFeeType,
  string
> = {
  shipping: '运费',
  storage: '仓储费',
  customs: '报关费',
  other: '其他费用',
};

export const FACTORY_SHIPMENT_FEE_TYPE_OPTIONS = [
  { value: 'shipping' as FactoryShipmentFeeType, label: '运费' },
  { value: 'storage' as FactoryShipmentFeeType, label: '仓储费' },
  { value: 'customs' as FactoryShipmentFeeType, label: '报关费' },
  { value: 'other' as FactoryShipmentFeeType, label: '其他费用' },
];
