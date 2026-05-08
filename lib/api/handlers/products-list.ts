/**
 * 产品列表 API 辅助函数
 * 将超长的 GET 方法拆分为多个小函数
 * 遵循全局约定规范：每个函数不超过 50 行
 */

import type { Prisma } from '@prisma/client';

import { getBatchCachedInventorySummary } from '@/lib/cache/inventory-cache';
import {
  PRODUCT_DEFAULT_SORT,
  PRODUCT_SORT_FIELDS,
  type ProductStatus,
  type ProductUnit,
} from '@/lib/config/product';
import { prisma } from '@/lib/db';
import { paginationConfig, productConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { parseProductImages } from '@/lib/utils/product-transforms';

const DEFAULT_INVENTORY = {
  totalQuantity: 0,
  reservedQuantity: 0,
  availableQuantity: 0,
};

type ProductBatchSpecEntry = {
  batchNumber: string;
  variantId?: string;
  colorCode?: string;
  colorName?: string;
  piecesPerUnit: number;
  quantity: number;
  weight?: number | null;
};

/**
 * 解析产品列表查询参数
 */
export function parseProductListParams(searchParams: URLSearchParams) {
  const includeInventory = searchParams.get('includeInventory')
    ? searchParams.get('includeInventory') === 'true'
    : productConfig.defaultIncludeInventory;

  const includeStatistics = searchParams.get('includeStatistics')
    ? searchParams.get('includeStatistics') === 'true'
    : productConfig.defaultIncludeStatistics;

  const requestLimit = parseInt(
    searchParams.get('limit') || paginationConfig.defaultPageSize.toString()
  );

  // 性能优化：超过20条记录时限制聚合查询
  const shouldLimitAggregation = requestLimit > 20;
  const finalIncludeStatistics = includeStatistics && !shouldLimitAggregation;

  const rawStatus = searchParams.get('status');
  const rawCategoryId = searchParams.get('categoryId');
  const filterUncategorized = rawCategoryId === 'none';

  const allowedSortFields = new Set<string>(Object.values(PRODUCT_SORT_FIELDS));
  const requestedSortBy = searchParams.get('sortBy');
  const sortBy =
    requestedSortBy && allowedSortFields.has(requestedSortBy)
      ? requestedSortBy
      : PRODUCT_DEFAULT_SORT.sortBy;

  return {
    includeInventory,
    finalIncludeStatistics,
    filterUncategorized,
    queryParams: {
      page: searchParams.get('page') || '1',
      limit:
        searchParams.get('limit') ||
        paginationConfig.defaultPageSize.toString(),
      search: searchParams.get('search') || undefined,
      sortBy,
      sortOrder:
        searchParams.get('sortOrder') || PRODUCT_DEFAULT_SORT.sortOrder,
      status: rawStatus && rawStatus !== 'all' ? rawStatus : undefined,
      categoryId: filterUncategorized ? undefined : rawCategoryId || undefined,
    },
  };
}

/**
 * 构建产品查询条件
 */
export function buildProductWhereClause(params: {
  search?: string;
  status?: string;
  categoryId?: string;
  filterUncategorized: boolean;
}): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  // 搜索条件 - 使用模糊匹配提升用户体验
  // 支持在产品编码、名称、规格的任意位置搜索
  if (params.search) {
    where.OR = [
      { code: { contains: params.search } }, // 编码模糊匹配
      { name: { contains: params.search } }, // 名称模糊匹配
      { specification: { contains: params.search } }, // 规格模糊匹配
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.filterUncategorized) {
    where.categoryId = null;
  } else if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  return where;
}

/**
 * 构建产品查询 select 字段
 */
export function buildProductSelect(includeStatistics: boolean) {
  const baseProductSelect = {
    id: true,
    code: true,
    name: true,
    specification: true,
    unit: true,
    piecesPerUnit: true,
    weight: true,
    thickness: true,
    status: true,
    categoryId: true,
    description: true,
    thumbnailUrl: true,
    images: true,
    category: {
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                name: true,
                code: true,
                parentId: true,
              },
            },
          },
        },
      },
    },
    createdAt: true,
    updatedAt: true,
  } as const;

  if (includeStatistics) {
    return {
      ...baseProductSelect,
      _count: {
        select: {
          inventory: true,
          salesOrderItems: true,
          inboundRecords: true,
        },
      },
    };
  }

  return baseProductSelect;
}

/**
 * 查询产品列表和总数
 */
export async function queryProducts(params: {
  where: Prisma.ProductWhereInput;
  select: ReturnType<typeof buildProductSelect>;
  sortBy: string;
  sortOrder: string;
  page: number;
  limit: number;
}) {
  const { where, select, sortBy, sortOrder, page, limit } = params;
  const direction: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  return Promise.all([
    prisma.product.findMany({
      where,
      select,
      orderBy: [
        { [sortBy]: direction } as Prisma.ProductOrderByWithRelationInput,
        { id: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);
}

/**
 * 获取产品库存信息
 */
export async function getProductsInventory(
  products: Array<{ id: string }>,
  includeInventory: boolean
) {
  if (!includeInventory || products.length === 0) {
    return new Map<string, typeof DEFAULT_INVENTORY>();
  }

  const productIds = products.map(product => product.id);
  return getBatchCachedInventorySummary(productIds);
}

export async function getProductsBatchSpecifications(productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, ProductBatchSpecEntry[]>();
  }

  const buildBatchSpecKey = (
    productId: string,
    batchNumber: string,
    variantId?: string | null
  ) => `${productId}|||${variantId ?? ''}|||${batchNumber}`;

  // 1. 批量获取产品批次库存（按产品+色号/变体+批次聚合，避免不同色号串规格）
  const inventoryByProductAndBatch = await prisma.inventory.groupBy({
    by: ['productId', 'variantId', 'batchNumber'],
    where: {
      productId: { in: productIds },
      batchNumber: { not: null },
    },
    _sum: {
      quantity: true,
    },
  });

  const pairs = inventoryByProductAndBatch
    .filter(
      (row): row is typeof row & { batchNumber: string } =>
        row.batchNumber !== null
    )
    .map(row => ({
      productId: row.productId,
      variantId: row.variantId ?? null,
      batchNumber: row.batchNumber,
    }));

  if (pairs.length === 0) {
    return new Map<string, ProductBatchSpecEntry[]>();
  }

  // 2. 批量获取批次规格（优先产品+变体+批次，兼容旧的产品级通用批次规格）
  const seenConditions = new Set<string>();
  const conditions = pairs.flatMap(pair => {
    const entries = [
      {
        productId: pair.productId,
        variantId: pair.variantId,
        batchNumber: pair.batchNumber,
      },
    ];

    if (pair.variantId) {
      entries.push({
        productId: pair.productId,
        variantId: null,
        batchNumber: pair.batchNumber,
      });
    }

    return entries.filter(condition => {
      const key = buildBatchSpecKey(
        condition.productId,
        condition.batchNumber,
        condition.variantId
      );
      if (seenConditions.has(key)) {
        return false;
      }
      seenConditions.add(key);
      return true;
    });
  });

  const batchSpecs = await prisma.batchSpecification.findMany({
    where: {
      OR: conditions,
    },
    select: {
      batchNumber: true,
      piecesPerUnit: true,
      weight: true,
      productId: true,
      variantId: true,
      variant: {
        select: {
          colorCode: true,
          colorName: true,
        },
      },
    },
  });

  // 3. 构建批次号到每件片数的映射
  const batchSpecMap = new Map<
    string,
    {
      piecesPerUnit: number;
      weight?: number | null;
      variantId?: string;
      colorCode?: string;
      colorName?: string;
    }
  >();
  batchSpecs.forEach(spec => {
    batchSpecMap.set(
      buildBatchSpecKey(
        spec.productId,
        spec.batchNumber,
        spec.variantId ?? null
      ),
      {
        piecesPerUnit: spec.piecesPerUnit,
        weight: spec.weight === null ? null : Number(spec.weight),
        variantId: spec.variantId ?? undefined,
        colorCode: spec.variant?.colorCode ?? undefined,
        colorName: spec.variant?.colorName ?? undefined,
      }
    );
  });

  // 4. 按产品ID分组，构建每个产品的批次规格列表
  const productBatchMap = new Map<string, Map<string, ProductBatchSpecEntry>>();

  inventoryByProductAndBatch.forEach(inv => {
    if (!inv.batchNumber) return;

    const batchSpec =
      batchSpecMap.get(
        buildBatchSpecKey(inv.productId, inv.batchNumber, inv.variantId ?? null)
      ) ??
      batchSpecMap.get(buildBatchSpecKey(inv.productId, inv.batchNumber, null));

    if (!batchSpec) {
      logger.warn('api:products-list', '批次没有批次规格记录', {
        batchNumber: inv.batchNumber,
        productId: inv.productId,
        variantId: inv.variantId ?? null,
      });
      return;
    }

    const key = `${inv.batchNumber}|||${batchSpec.variantId ?? ''}|||${batchSpec.piecesPerUnit}`;

    // 确保产品批次映射存在
    let batchMap = productBatchMap.get(inv.productId);
    if (!batchMap) {
      batchMap = new Map();
      productBatchMap.set(inv.productId, batchMap);
    }

    const existing = batchMap.get(key);
    const quantity = inv._sum.quantity ?? 0;

    if (existing) {
      existing.quantity += quantity;
    } else {
      batchMap.set(key, {
        batchNumber: inv.batchNumber,
        variantId: batchSpec.variantId,
        colorCode: batchSpec.colorCode,
        colorName: batchSpec.colorName,
        piecesPerUnit: batchSpec.piecesPerUnit,
        quantity,
        weight: batchSpec.weight,
      });
    }
  });

  // 5. 转换为最终格式
  const result = new Map<string, ProductBatchSpecEntry[]>();

  productBatchMap.forEach((batchMap, productId) => {
    result.set(productId, Array.from(batchMap.values()));
  });

  return result;
}

/**
 * 格式化产品分类路径
 */
function formatProductCategory(
  category: {
    id: string;
    name: string;
    code: string;
    parentId: string | null;
    parent: {
      id: string;
      name: string;
      code: string;
      parentId: string | null;
      parent: {
        id: string;
        name: string;
        code: string;
        parentId: string | null;
      } | null;
    } | null;
  } | null
) {
  if (!category) return null;

  const parent = category.parent;
  const grandparent = parent?.parent;
  const fullPath = [grandparent?.name, parent?.name, category.name]
    .filter(Boolean)
    .join(' / ');

  return {
    id: category.id,
    name: category.name,
    code: category.code,
    parentId: category.parentId,
    fullPath,
    parent: parent
      ? {
          id: parent.id,
          name: parent.name,
          code: parent.code,
          parentId: parent.parentId,
          parent: grandparent
            ? {
                id: grandparent.id,
                name: grandparent.name,
                code: grandparent.code,
                parentId: grandparent.parentId,
              }
            : null,
        }
      : null,
  };
}

/**
 * 格式化产品列表数据
 */
export function formatProductList(params: {
  products: Array<{
    id: string;
    code: string;
    name: string;
    specification: string | null;
    unit: string;
    piecesPerUnit: number | null;
    weight: number | null;
    thickness: number | null;
    status: string;
    categoryId: string | null;
    description: string | null;
    thumbnailUrl: string | null;
    images: string | null;
    category: {
      id: string;
      name: string;
      code: string;
      parentId: string | null;
      parent: {
        id: string;
        name: string;
        code: string;
        parentId: string | null;
        parent: {
          id: string;
          name: string;
          code: string;
          parentId: string | null;
        } | null;
      } | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      inventory: number;
      salesOrderItems: number;
      inboundRecords: number;
    };
  }>;
  inventoryMap: Map<
    string,
    typeof DEFAULT_INVENTORY & {
      batches?: Array<{
        batchNumber: string;
        quantity: number;
        reservedQuantity?: number;
        availableQuantity?: number;
        piecesPerUnit?: number;
        weight?: number | null;
      }>;
    }
  >;
  includeInventory: boolean;
  includeStatistics: boolean;
  batchSpecsMap?: Map<
    string,
    Array<{
      batchNumber: string;
      variantId?: string;
      colorCode?: string;
      colorName?: string;
      piecesPerUnit: number;
      quantity: number;
      weight?: number | null;
    }>
  >;
}) {
  const {
    products,
    inventoryMap,
    includeInventory,
    includeStatistics,
    batchSpecsMap,
  } = params;

  return products.map(product => {
    const fallbackInventory: {
      totalQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      batches: Array<{
        batchNumber: string;
        quantity: number;
        reservedQuantity?: number;
        availableQuantity?: number;
        piecesPerUnit?: number;
        weight?: number | null;
      }>;
    } = {
      ...DEFAULT_INVENTORY,
      batches: [],
    };

    const rawInventory =
      (includeInventory ? inventoryMap.get(product.id) : undefined) ??
      fallbackInventory;

    const counts =
      includeStatistics && '_count' in product ? product._count : undefined;
    const unit = product.unit as ProductUnit;
    const status = product.status as ProductStatus;
    const statistics = counts
      ? {
          inventoryRecordsCount: counts.inventory,
          salesOrderItemsCount: counts.salesOrderItems,
          inboundRecordsCount: counts.inboundRecords,
        }
      : undefined;

    const batchSpecs = batchSpecsMap?.get(product.id) ?? [];
    const batchPiecesMap = new Map(
      batchSpecs.map(spec => [
        spec.batchNumber,
        {
          piecesPerUnit: spec.piecesPerUnit,
          weight: spec.weight === null ? null : Number(spec.weight),
        },
      ])
    );

    const inventory = {
      totalQuantity: rawInventory.totalQuantity ?? 0,
      reservedQuantity: rawInventory.reservedQuantity ?? 0,
      availableQuantity: rawInventory.availableQuantity ?? 0,
      batches: (rawInventory.batches ?? []).map(batch => {
        const resolvedPieces =
          batch.piecesPerUnit && batch.piecesPerUnit > 0
            ? batch.piecesPerUnit
            : batchPiecesMap.get(batch.batchNumber)?.piecesPerUnit;
        const resolvedWeight =
          batch.weight && batch.weight > 0
            ? batch.weight
            : (batchPiecesMap.get(batch.batchNumber)?.weight ?? undefined);

        return {
          batchNumber: batch.batchNumber,
          quantity: batch.quantity,
          reservedQuantity: batch.reservedQuantity,
          availableQuantity: batch.availableQuantity,
          piecesPerUnit: resolvedPieces,
          weight: resolvedWeight,
        };
      }),
    };

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification ?? undefined,
      unit,
      piecesPerUnit: product.piecesPerUnit ?? undefined,
      weight: product.weight === null ? undefined : Number(product.weight),
      thickness:
        product.thickness === null ? undefined : Number(product.thickness),
      status,
      categoryId: product.categoryId,
      category: formatProductCategory(product.category),
      description: product.description ?? undefined,
      thumbnailUrl: product.thumbnailUrl ?? undefined,
      images: parseProductImages(product.images ?? null, product.id),
      inventory,
      statistics,
      batchSpecs: batchSpecs.length > 0 ? batchSpecs : undefined,
      createdAt:
        product.createdAt instanceof Date
          ? product.createdAt.toISOString()
          : product.createdAt,
      updatedAt:
        product.updatedAt instanceof Date
          ? product.updatedAt.toISOString()
          : product.updatedAt,
    };
  });
}

/**
 * 构建分页信息
 */
export function buildPagination(params: {
  page: number;
  limit: number;
  total: number;
}) {
  const { page, limit, total } = params;
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
  };
}
