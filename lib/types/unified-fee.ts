/**
 * 统一费用类型定义
 *
 * 用于销售订单和厂家发货订单的费用管理
 * 提供灵活的费用类型选择和统一的费用承担方逻辑
 */

// ================================================================================
// 费用类型定义
// ================================================================================

/**
 * 销售订单费用类型(简化版)
 */
export type SalesOrderFeeType = 'processing' | 'shipping' | 'other';

/**
 * 厂家发货费用类型(完整版,包含仓储、报关等)
 */
export type FactoryShipmentFeeType =
  | 'freight'
  | 'processing'
  | 'packaging'
  | 'loading_unloading'
  | 'storage'
  | 'customs'
  | 'other';

/**
 * 统一费用类型(联合类型)
 */
export type UnifiedFeeType = SalesOrderFeeType | FactoryShipmentFeeType;

// ================================================================================
// 费用承担方定义
// ================================================================================

/**
 * 费用承担方
 * - customer: 客户承担 (计入销售收入,不影响成本)
 * - company: 公司承担 (计入销售成本,影响利润)
 */
export type FeePaidBy = 'customer' | 'company';

// ================================================================================
// 费用类型标签和选项
// ================================================================================

/**
 * 销售订单费用类型标签
 */
export const SALES_ORDER_FEE_TYPE_LABELS: Record<SalesOrderFeeType, string> = {
  processing: '加工费',
  shipping: '运费',
  other: '其他费用',
};

/**
 * 销售订单费用类型选项
 */
export const SALES_ORDER_FEE_TYPE_OPTIONS = [
  { value: 'processing' as SalesOrderFeeType, label: '加工费' },
  { value: 'shipping' as SalesOrderFeeType, label: '运费' },
  { value: 'other' as SalesOrderFeeType, label: '其他费用' },
];

/**
 * 厂家发货费用类型标签
 */
export const FACTORY_SHIPMENT_FEE_TYPE_LABELS: Record<
  FactoryShipmentFeeType,
  string
> = {
  freight: '运费',
  processing: '加工费',
  packaging: '包装费',
  loading_unloading: '装卸费',
  storage: '仓储费',
  customs: '报关费',
  other: '其他费用',
};

/**
 * 厂家发货费用类型选项
 */
export const FACTORY_SHIPMENT_FEE_TYPE_OPTIONS = [
  { value: 'freight' as FactoryShipmentFeeType, label: '运费' },
  { value: 'processing' as FactoryShipmentFeeType, label: '加工费' },
  { value: 'packaging' as FactoryShipmentFeeType, label: '包装费' },
  { value: 'loading_unloading' as FactoryShipmentFeeType, label: '装卸费' },
  { value: 'storage' as FactoryShipmentFeeType, label: '仓储费' },
  { value: 'customs' as FactoryShipmentFeeType, label: '报关费' },
  { value: 'other' as FactoryShipmentFeeType, label: '其他费用' },
];

/**
 * 费用承担方标签
 */
export const FEE_PAID_BY_LABELS: Record<FeePaidBy, string> = {
  customer: '客户承担',
  company: '公司承担',
};

/**
 * 费用承担方选项
 */
export const FEE_PAID_BY_OPTIONS = [
  { value: 'customer' as FeePaidBy, label: '客户承担' },
  { value: 'company' as FeePaidBy, label: '公司承担' },
];

// ================================================================================
// 默认承担方逻辑
// ================================================================================

/**
 * 根据费用类型获取默认承担方
 *
 * 业务规则:
 * - 加工费(processing): 默认公司承担 (内部成本)
 * - 其他所有费用: 默认客户承担 (外部费用)
 *
 * @param feeType - 费用类型
 * @returns 默认承担方
 */
export function getDefaultFeePaidBy(feeType?: UnifiedFeeType): FeePaidBy {
  if (feeType === 'processing') {
    return 'company';
  }
  return 'customer';
}

// ================================================================================
// 类型判断工具
// ================================================================================

/**
 * 判断是否为销售订单费用类型
 */
export function isSalesOrderFeeType(
  feeType: string
): feeType is SalesOrderFeeType {
  return ['processing', 'shipping', 'other'].includes(feeType);
}

/**
 * 判断是否为厂家发货费用类型
 */
export function isFactoryShipmentFeeType(
  feeType: string
): feeType is FactoryShipmentFeeType {
  return [
    'freight',
    'processing',
    'packaging',
    'loading_unloading',
    'storage',
    'customs',
    'other',
  ].includes(feeType);
}
