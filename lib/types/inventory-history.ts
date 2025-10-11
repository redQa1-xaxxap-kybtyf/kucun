/**
 * 库存批次流水相关类型
 * 为批次追溯页面提供统一的数据结构
 */

import type { Product } from './product';
import type { User } from './user';

export type InventoryMovementKind = 'inbound' | 'outbound' | 'adjustment';

export interface InventoryMovementEntry {
  id: string;
  recordNumber: string;
  type: InventoryMovementKind;
  productId: string;
  variantId?: string;
  batchNumber?: string;
  quantityChange: number;
  balanceBefore?: number;
  balanceAfter?: number;
  beforeQuantitySnapshot?: number;
  afterQuantitySnapshot?: number;
  createdAt: string;
  remarks?: string;
  reason?: string;
  referenceNumber?: string;
  operator?: Pick<User, 'id' | 'name'>;
  product?: Pick<
    Product,
    'id' | 'name' | 'code' | 'unit' | 'specification' | 'piecesPerUnit'
  >;
  variant?: {
    id: string;
    colorCode: string | null;
    colorName?: string | null;
  };
}

export interface BatchMovementGroup {
  key: string;
  product: InventoryMovementEntry['product'];
  variant?: InventoryMovementEntry['variant'];
  currentQuantity?: number;
  openingBalance?: number;
  closingBalance?: number;
  netChange?: number;
  totalInbound: number;
  totalOutbound: number;
  totalAdjustment: number;
  movements: InventoryMovementEntry[];
}

export interface BatchHistoryResult {
  batchNumber: string;
  groups: BatchMovementGroup[];
  firstEventAt?: string;
  lastEventAt?: string;
  filteredBy?: {
    inventoryId?: string;
    productId?: string;
    variantId?: string | null;
  };
  targetInventory?: {
    id: string;
    batchNumber?: string | null;
    quantity: number;
    reservedQuantity: number;
    product?: InventoryMovementEntry['product'];
    variant?: InventoryMovementEntry['variant'];
  };
}
