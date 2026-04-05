/**
 * 库存记录筛选配置常量
 * 包含入库、出库、盘点、调整等模块的筛选器配置
 */

/**
 * 筛选配置接口简版 (用于 SearchFilterCard 适配)
 */
export interface FilterOption {
  value: string;
  label: string;
}

// 入库原因标签映射
export const INBOUND_REASON_OPTIONS: FilterOption[] = [
  { value: 'purchase', label: '采购入库' },
  { value: 'return', label: '退货入库' },
  { value: 'transfer', label: '调拨入库' },
  { value: 'surplus', label: '盘盈入库' },
  { value: 'other', label: '其他' },
  { value: 'sales_cancel', label: '销售订单取消入库' },
  { value: 'return_inbound', label: '退货订单入库' },
];

export const INBOUND_DAMAGE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'damaged', label: '只看有破损' },
];

// 出库原因标签映射
export const OUTBOUND_REASON_OPTIONS: FilterOption[] = [
  { value: 'normal_outbound', label: '正常出库' },
  { value: 'manual_outbound', label: '手动出库' },
  { value: 'sales_outbound', label: '销售出库' },
  { value: 'adjust_outbound', label: '调整出库' },
  { value: 'transfer', label: '调拨出库' },
  { value: 'damage', label: '报损出库' },
  { value: 'other', label: '其他出库' },
];

// 调整原因标签映射
export const ADJUSTMENT_REASON_OPTIONS: FilterOption[] = [
  { value: 'inventory_gain', label: '盘盈' },
  { value: 'inventory_loss', label: '盘亏' },
  { value: 'damage_loss', label: '报损' },
  { value: 'surplus_gain', label: '报溢' },
  { value: 'transfer', label: '调拨' },
  { value: 'other', label: '其他' },
];

// 盘点类型标签映射
export const COUNT_TYPE_OPTIONS: FilterOption[] = [
  { value: 'full', label: '全盘' },
  { value: 'partial', label: '抽盘' },
  { value: 'cycle', label: '循环盘点' },
];
