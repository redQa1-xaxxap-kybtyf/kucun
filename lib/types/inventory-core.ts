/**
 * 库存核心类型定义
 * 包含基础库存模型和相关接口
 */

import { PRODUCT_UNIT_LABELS, type Product } from './product';

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
  batchPiecesPerUnit?: number; // 批次级每件片数
  weight?: number; // 产品重量(kg) - 优先使用批次级重量，回退到产品默认重量

  // 关联数据（可选，根据查询需要包含）
  product?: Product;
  variant?: import('./product').ProductVariant;
}

function normalizeUnitLabel(unit?: string): string | undefined {
  if (typeof unit !== 'string') return undefined;
  const trimmed = unit.trim();
  if (!trimmed) return undefined;
  return PRODUCT_UNIT_LABELS[trimmed] ?? trimmed;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function formatPiecesToDisplay(
  pieces: number,
  unitLabel: string,
  piecesPerUnit: number
): string {
  if (!Number.isFinite(pieces)) {
    return unitLabel === '片' ? '0片' : `0${unitLabel}`;
  }

  if (pieces <= 0) {
    if (unitLabel !== '片' && Number.isFinite(piecesPerUnit) && piecesPerUnit) {
      return `0${unitLabel}`;
    }
    return '0片';
  }

  const hasValidPiecesPerUnit =
    Number.isInteger(piecesPerUnit) && piecesPerUnit > 0;

  // 系统内部统一以“片”为最小单位；当无法可靠换算时，回退显示“片”
  if (unitLabel === '片' || !hasValidPiecesPerUnit) {
    return `${formatNumber(pieces)}片`;
  }

  // 非整数片数无法做“X单位+Y片”分解，回退成带小数的单位数
  if (!Number.isInteger(pieces)) {
    const units = pieces / piecesPerUnit;
    return `${formatNumber(units)}${unitLabel}`;
  }

  const fullUnits = Math.floor(pieces / piecesPerUnit);
  const remainingPieces = pieces % piecesPerUnit;

  if (remainingPieces === 0) {
    return `${fullUnits}${unitLabel}`;
  }
  if (fullUnits === 0) {
    return `${remainingPieces}片`;
  }
  return `${fullUnits}${unitLabel}+${remainingPieces}片`;
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
  const unitLabel =
    normalizeUnitLabel(unit) ??
    normalizeUnitLabel(inventory.product?.unit) ??
    '片';
  const piecesPerUnit =
    inventory.batchPiecesPerUnit ?? inventory.product?.piecesPerUnit ?? 0;
  const displayAvailable = formatPiecesToDisplay(
    available,
    unitLabel,
    piecesPerUnit
  );

  if (inventory.reservedQuantity > 0) {
    const displayTotal = formatPiecesToDisplay(
      inventory.quantity,
      unitLabel,
      piecesPerUnit
    );
    const displayReserved = formatPiecesToDisplay(
      inventory.reservedQuantity,
      unitLabel,
      piecesPerUnit
    );
    return `${displayAvailable} (总${displayTotal}, 预留${displayReserved})`;
  } else {
    return displayAvailable;
  }
};
