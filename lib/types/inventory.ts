/**
 * 库存管理相关类型定义 - 统一导出入口
 * 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase
 *
 * 此文件作为库存相关类型的统一导出入口，
 * 实际类型定义已按功能模块拆分到不同文件中
 */

// 核心库存类型
export { formatInventoryQuantity } from './inventory-core';
export type { Inventory } from './inventory-core';

// 库存状态相关类型
export type { AlertLevel, InventoryStatus } from './inventory-status';

export {
  ALERT_LEVEL_COLORS,
  ALERT_LEVEL_LABELS,
  INVENTORY_STATUS_LABELS,
  INVENTORY_STATUS_VARIANTS,
  INVENTORY_THRESHOLDS,
  calculateAvailableQuantity,
  getAlertLevel,
  getInventoryStatus,
} from './inventory-status';

// 库存操作相关类型
export type {
  InboundCreateInput,
  InboundRecord,
  InboundType,
  InventoryAdjustInput,
  InventoryCountInput,
  InventoryCountItem,
  OutboundCreateInput,
  OutboundRecord,
  OutboundType,
} from './inventory-operations';

export {
  INBOUND_NUMBER_FORMAT,
  INBOUND_SORT_OPTIONS,
  INBOUND_TYPE_LABELS,
  INBOUND_TYPE_VARIANTS,
  OUTBOUND_NUMBER_FORMAT,
  OUTBOUND_SORT_OPTIONS,
  OUTBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_VARIANTS,
  calculateTotalCost,
} from './inventory-operations';

// 库存查询相关类型
export type {
  InboundRecordListResponse,
  InboundRecordQueryParams,
  InventoryAlert,
  InventoryDetailResponse,
  InventoryListResponse,
  InventoryQueryParams,
  InventoryStats,
  OutboundRecordListResponse,
  OutboundRecordQueryParams,
  PaginationInfo,
} from './inventory-queries';

export {
  CRITICAL_MIN_QUANTITY,
  DEFAULT_MIN_QUANTITY,
  DEFAULT_PAGE_SIZE,
  INVENTORY_ALERT_TYPE_LABELS,
  INVENTORY_ALERT_TYPE_VARIANTS,
  INVENTORY_FIELD_LABELS,
  INVENTORY_SORT_OPTIONS,
  PAGE_SIZE_OPTIONS,
} from './inventory-queries';
