import type { Inventory } from '@/lib/types/inventory';

import { formatInventoryGroupSummary } from './inventory-group-display';

export interface InventoryProductGroup {
  productCode: string;
  productName: string;
  specification?: string;
  thumbnailUrl?: string;
  items: Inventory[];
  totalPieces: number;
  totalQuantityDisplay: string;
  totalAvailablePieces: number;
  totalAvailableDisplay: string;
}

export function groupInventoriesByProductCode(
  inventories: Inventory[]
): InventoryProductGroup[] {
  const groups = new Map<string, InventoryProductGroup>();

  inventories.forEach(inventory => {
    const code = inventory.product?.code || '未知';
    const existingGroup = groups.get(code);

    if (!existingGroup) {
      groups.set(code, {
        productCode: code,
        productName: inventory.product?.name || '-',
        specification: inventory.product?.specification ?? undefined,
        thumbnailUrl: inventory.product?.thumbnailUrl,
        items: [inventory],
        totalPieces: 0,
        totalQuantityDisplay: '0片',
        totalAvailablePieces: 0,
        totalAvailableDisplay: '0片',
      });
      return;
    }

    existingGroup.items.push(inventory);
    existingGroup.productName =
      existingGroup.productName === '-' && inventory.product?.name
        ? inventory.product.name
        : existingGroup.productName;
    existingGroup.specification =
      existingGroup.specification ?? inventory.product?.specification ?? undefined;
    existingGroup.thumbnailUrl =
      existingGroup.thumbnailUrl ?? inventory.product?.thumbnailUrl;
  });

  groups.forEach(group => {
    group.totalPieces = group.items.reduce((sum, item) => sum + item.quantity, 0);
    group.totalQuantityDisplay = formatInventoryGroupSummary(
      group.items,
      'quantity'
    );
    group.totalAvailablePieces = group.items.reduce((sum, item) => {
      const available = Math.max(item.quantity - (item.reservedQuantity ?? 0), 0);
      return sum + available;
    }, 0);
    group.totalAvailableDisplay = formatInventoryGroupSummary(
      group.items,
      'available'
    );
  });

  return Array.from(groups.values());
}
