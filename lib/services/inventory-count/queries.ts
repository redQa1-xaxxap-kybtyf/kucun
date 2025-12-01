/* eslint-disable func-call-spacing */
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  type InventoryCountDetail,
  type InventoryCountListItem,
  type InventoryCountQueryParams,
} from '@/lib/types/inventory-count';

import {
  INVENTORY_COUNT_RELATIONS,
  INVENTORY_COUNT_WITH_ITEMS_RELATIONS,
  toInventoryCountListItem,
  toInventoryCountWithItems,
  type InventoryCountWithItemsEntity,
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

function buildBatchSpecKey(productId: string, batchNumber: string) {
  return `${productId}::${batchNumber}`;
}

async function attachBatchPiecesPerUnit(
  count: InventoryCountWithItemsEntity
): Promise<InventoryCountWithItemsEntity> {
  // 收集所有有批次号的产品组合
  const pairs = count.items
    .filter(item => item.batchNumber && item.productId)
    .map(item => ({
      productId: item.productId,
      batchNumber: item.batchNumber as string,
    }));

  if (!pairs.length) {
    return count;
  }

  // 去重避免生成过长的 OR 条件
  const uniqueKeySet = new Set<string>();
  const uniquePairs: typeof pairs = [];
  for (const pair of pairs) {
    const key = buildBatchSpecKey(pair.productId, pair.batchNumber);
    if (!uniqueKeySet.has(key)) {
      uniqueKeySet.add(key);
      uniquePairs.push(pair);
    }
  }

  if (!uniquePairs.length) {
    return count;
  }

  const batchSpecs = await prisma.batchSpecification.findMany({
    where: {
      OR: uniquePairs.map(p => ({
        productId: p.productId,
        batchNumber: p.batchNumber,
      })),
    },
    select: {
      id: true,
      productId: true,
      batchNumber: true,
      piecesPerUnit: true,
    },
  });

  if (!batchSpecs.length) {
    return count;
  }

  const specMap = new Map<string, (typeof batchSpecs)[number]>();
  batchSpecs.forEach(spec => {
    specMap.set(buildBatchSpecKey(spec.productId, spec.batchNumber), spec);
  });

  return {
    ...count,
    items: count.items.map(item => {
      if (!item.batchNumber || !item.product) {
        return item;
      }

      const key = buildBatchSpecKey(item.productId, item.batchNumber);
      const spec = specMap.get(key);
      if (!spec) {
        return item;
      }

      return {
        ...item,
        product: {
          ...item.product,
          // ✅ 每件片数优先采用批次规格参数，回退到产品默认值
          piecesPerUnit: spec.piecesPerUnit ?? item.product.piecesPerUnit,
        },
      };
    }),
  };
}

export async function getInventoryCountById(
  id: string
): Promise<InventoryCountDetail | null> {
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    include: INVENTORY_COUNT_WITH_ITEMS_RELATIONS,
  });

  if (!count) {
    return null;
  }

  const enhanced = await attachBatchPiecesPerUnit(count);
  return toInventoryCountWithItems(enhanced);
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
