/**
 * 库存状态相关工具函数
 * 提供库存状态标签、颜色和显示格式化功能
 */

import type { Inventory } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';

import { formatInventoryQuantity } from './piece-calculation';

/**
 * 获取库存状态标签
 */
export function getStockStatusLabel(
  quantity: number,
  reservedQuantity: number = 0
): string {
  const availableQuantity = quantity - reservedQuantity;

  if (availableQuantity <= 0) return '缺货';
  if (availableQuantity <= 10) return '库存不足';
  return '库存充足';
}

/**
 * 获取库存状态颜色
 */
export function getStockStatusColor(
  quantity: number,
  reservedQuantity: number = 0
): 'destructive' | 'secondary' | 'default' {
  const availableQuantity = quantity - reservedQuantity;

  if (availableQuantity <= 0) return 'destructive';
  if (availableQuantity <= 10) return 'secondary';
  return 'default';
}

/**
 * 获取库存数量显示组件数据
 */
export function getStockDisplayData(record: Inventory) {
  const availableQuantity = record.quantity - (record.reservedQuantity || 0);

  return {
    availableQuantity,
    totalQuantity: record.quantity,
    reservedQuantity: record.reservedQuantity || 0,
    formattedQuantity: formatInventoryQuantity(
      record.quantity,
      record.unit || 'piece'
    ),
    formattedAvailable: formatInventoryQuantity(
      availableQuantity,
      record.unit || 'piece'
    ),
    unitLabel:
      PRODUCT_UNIT_LABELS[record.unit as keyof typeof PRODUCT_UNIT_LABELS] ||
      record.unit,
    statusLabel: getStockStatusLabel(record.quantity, record.reservedQuantity),
    statusColor: getStockStatusColor(record.quantity, record.reservedQuantity),
  };
}
