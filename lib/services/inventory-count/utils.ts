import type { Prisma } from '@prisma/client';

import {
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  type CountStatus,
  type InventoryCount,
  type InventoryCountDetail,
  type InventoryCountItem,
  type InventoryCountListItem,
} from '@/lib/types/inventory-count';
import { toNumberOrNull } from '@/lib/utils/number';

export const INVENTORY_COUNT_RELATIONS = {
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  operator: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  approver: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} satisfies Prisma.InventoryCountInclude;

export const INVENTORY_COUNT_WITH_ITEMS_RELATIONS = {
  ...INVENTORY_COUNT_RELATIONS,
  items: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          specification: true,
          unit: true,
          piecesPerUnit: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorCode: true,
          colorName: true,
          sku: true,
        },
      },
      counter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} as const;

export type InventoryCountEntity = Prisma.InventoryCountGetPayload<{
  include: typeof INVENTORY_COUNT_RELATIONS;
}>;

export type InventoryCountWithItemsEntity = Prisma.InventoryCountGetPayload<{
  include: typeof INVENTORY_COUNT_WITH_ITEMS_RELATIONS;
}>;

export function toInventoryCount(count: InventoryCountEntity): InventoryCount {
  return {
    id: count.id,
    countNumber: count.countNumber,
    countName: count.countName,
    countType: count.countType as InventoryCount['countType'],
    status: count.status as CountStatus,
    location: count.location || undefined,
    categoryId: count.categoryId || undefined,
    planDate: count.planDate.toISOString(),
    startDate: count.startDate?.toISOString(),
    endDate: count.endDate?.toISOString(),
    totalItems: count.totalItems,
    completedItems: count.completedItems,
    differenceItems: count.differenceItems,
    totalDifference: count.totalDifference,
    remarks: count.remarks || undefined,
    attachments: count.attachments || undefined,
    creatorId: count.creatorId,
    operatorId: count.operatorId || undefined,
    approverId: count.approverId || undefined,
    approvedAt: count.approvedAt?.toISOString(),
    createdAt: count.createdAt.toISOString(),
    updatedAt: count.updatedAt.toISOString(),
    creator: count.creator || undefined,
    operator: count.operator || undefined,
    approver: count.approver || undefined,
    category: count.category || undefined,
  };
}

export function toInventoryCountWithItems(
  count: InventoryCountWithItemsEntity
): InventoryCountDetail {
  return {
    ...toInventoryCount(count),
    items: count.items.map(toInventoryCountItem),
  };
}

export function toInventoryCountItem(
  item: InventoryCountWithItemsEntity['items'][number]
): InventoryCountItem {
  return {
    id: item.id,
    countId: item.countId,
    productId: item.productId,
    variantId: item.variantId || undefined,
    batchNumber: item.batchNumber || undefined,
    systemQuantity: item.systemQuantity,
    actualQuantity: item.actualQuantity || undefined,
    difference: item.difference,
    status: item.status as InventoryCountItem['status'],
    unitCost: toNumberOrNull(item.unitCost) ?? undefined,
    totalCost: toNumberOrNull(item.totalCost) ?? undefined,
    location: item.location || undefined,
    remarks: item.remarks || undefined,
    countedBy: item.countedBy || undefined,
    countedAt: item.countedAt?.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    product: item.product
      ? {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
          unit: item.product.unit as 'piece' | 'sheet',
          piecesPerUnit: item.product.piecesPerUnit as number,
          specification: item.product.specification ?? undefined,
        }
      : undefined,
    variant: item.variant
      ? {
          id: item.variant.id,
          colorCode: item.variant.colorCode,
          colorName: item.variant.colorName || undefined,
          sku: item.variant.sku,
        }
      : undefined,
    counter: item.counter || undefined,
  };
}

export function toInventoryCountListItem(
  count: InventoryCountEntity
): InventoryCountListItem {
  const totalItems = count.totalItems;
  const completedItems = count.completedItems;

  return {
    id: count.id,
    countNumber: count.countNumber,
    countName: count.countName,
    countType: count.countType as InventoryCount['countType'],
    countTypeName:
      COUNT_TYPE_LABELS[count.countType as InventoryCount['countType']],
    status: count.status as CountStatus,
    statusName: COUNT_STATUS_LABELS[count.status as CountStatus],
    planDate: count.planDate.toISOString().split('T')[0],
    location: count.location || undefined,
    categoryName: count.category?.name,
    totalItems,
    completedItems,
    differenceItems: count.differenceItems,
    progress:
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    creatorName: count.creator?.name || '',
    createdAt: count.createdAt.toISOString(),
  };
}
