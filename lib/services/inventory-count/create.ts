import { prisma } from '@/lib/db';
import type {
  CreateInventoryCountRequest,
  InventoryCount,
} from '@/lib/types/inventory-count';

import { buildInventoryItems } from './items';
import { generateCountNumber } from './number';
import { INVENTORY_COUNT_RELATIONS, toInventoryCount } from './utils';

export async function createInventoryCount(
  data: CreateInventoryCountRequest,
  userId: string
): Promise<InventoryCount> {
  const count = await prisma.$transaction(async tx => {
    const countNumber = await generateCountNumber(tx);
    const itemsData = await buildInventoryItems(tx, data.items);

    const createdCount = await tx.inventoryCount.create({
      data: {
        countNumber,
        countName: data.countName,
        countType: data.countType,
        status: 'draft',
        planDate: new Date(data.planDate),
        location: data.location || null,
        categoryId: data.categoryId || null,
        remarks: data.remarks || null,
        attachments: data.attachments || null,
        totalItems: itemsData.length,
        completedItems: 0,
        differenceItems: 0,
        totalDifference: 0,
        creatorId: userId,
        operatorId: null,
        approverId: null,
        approvedAt: null,
        startDate: null,
        endDate: null,
      },
      include: INVENTORY_COUNT_RELATIONS,
    });

    if (itemsData.length) {
      await tx.inventoryCountItem.createMany({
        data: itemsData.map(item => ({
          ...item,
          countId: createdCount.id,
        })),
      });
    }

    return createdCount;
  });

  return toInventoryCount(count);
}
