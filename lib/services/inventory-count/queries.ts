import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  type InventoryCount,
  type InventoryCountListItem,
  type InventoryCountQueryParams,
} from '@/lib/types/inventory-count';

import {
  INVENTORY_COUNT_RELATIONS,
  INVENTORY_COUNT_WITH_ITEMS_RELATIONS,
  toInventoryCountListItem,
  toInventoryCountWithItems,
} from './utils';

export async function getInventoryCounts(
  query: InventoryCountQueryParams = {}
): Promise<{
  counts: InventoryCountListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  const {
    page = 1,
    pageSize = 20,
    status,
    countType,
    location,
    categoryId,
    startDate,
    endDate,
    sortBy = 'planDate',
    sortOrder = 'desc',
  } = query;

  const where: Prisma.InventoryCountWhereInput = buildSearchFilter({
    status,
    countType,
    location,
    categoryId,
    startDate,
    endDate,
  });

  const skip = (page - 1) * pageSize;

  const [total, countsData] = await Promise.all([
    prisma.inventoryCount.count({ where }),
    prisma.inventoryCount.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: INVENTORY_COUNT_RELATIONS,
    }),
  ]);

  return {
    counts: countsData.map(toInventoryCountListItem),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getInventoryCountById(
  id: string
): Promise<InventoryCount | null> {
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    include: INVENTORY_COUNT_WITH_ITEMS_RELATIONS,
  });

  if (!count) {
    return null;
  }

  return toInventoryCountWithItems(count);
}

export function buildSearchFilter(params: {
  status?: string;
  countType?: string;
  location?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.InventoryCountWhereInput {
  const where: Prisma.InventoryCountWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.countType) {
    where.countType = params.countType;
  }

  if (params.location) {
    where.location = {
      contains: params.location,
    };
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (params.startDate || params.endDate) {
    where.planDate = {};
    if (params.startDate) {
      where.planDate.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.planDate.lte = new Date(params.endDate);
    }
  }

  return where;
}
