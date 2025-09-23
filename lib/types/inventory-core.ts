/**
 * 库存核心类型定义
 * 包含基础库存模型和相关接口
 */

import type { Product } from './product';

// 基础库存类型（对应数据库模型）
export interface Inventory {
  id: string;
  productId: string;
  variantId?: string; // 产品变体ID
  batchNumber?: string; // 生产批次号
  quantity: number;
  reservedQuantity: number; // 预留数量
  unitCost?: number; // 单位成本
  location?: string; // 存储位置
  updatedAt: string;

  // 关联数据（可选，根据查询需要包含）
  product?: Product;
  variant?: import('./product').ProductVariant;
}

/**
 * 格式化库存数量显示
 * @param inventory 库存对象
 * @param unit 单位
 * @returns 格式化后的数量字符串
 */
export const formatInventoryQuantity = (
  inventory: Inventory,
  unit?: string
): string => {
  const available = Math.max(
    0,
    inventory.quantity - inventory.reservedQuantity
  );
  const unitStr = unit || '件';

  if (inventory.reservedQuantity > 0) {
    return `${available}${unitStr} (总${inventory.quantity}${unitStr}, 预留${inventory.reservedQuantity}${unitStr})`;
  } else {
    return `${available}${unitStr}`;
  }
};
