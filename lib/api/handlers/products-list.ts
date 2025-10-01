/**
 * 产品列表 API 辅助函数
 * 将超长的 GET 方法拆分为多个小函数
 * 遵循全局约定规范：每个函数不超过 50 行
 */

import type { Prisma } from '@prisma/client';

import { getBatchCachedInventorySummary } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { paginationConfig, productConfig } from '@/lib/env';

const DEFAULT_INVENTORY = {
  totalQuantity: 0,
  reservedQuantity: 0,
  availableQuantity: 0,
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
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      status: rawStatus && rawStatus !== 'all' ? rawStatus : undefined,
      unit: searchParams.get('unit') || undefined,
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
  unit?: string;
  categoryId?: string;
  filterUncategorized: boolean;
}): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  // 搜索条件 - 优化为使用索引的查询
  if (params.search) {
    where.OR = [
      { code: { startsWith: params.search } }, // 可以使用索引的前缀匹配
      { name: { contains: params.search } }, // name字段有索引
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.unit) {
    where.unit = params.unit;
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
    category: {
      select: {
        id: true,
        name: true,
        code: true,
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

  return Promise.all([
    prisma.product.findMany({
      where,
      select,
      orderBy: { [sortBy]: sortOrder },
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
    piecesPerUnit: number;
    weight: number | null;
    thickness: number | null;
    status: string;
    categoryId: string | null;
    category: {
      id: string;
      name: string;
      code: string;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      inventory: number;
      salesOrderItems: number;
      inboundRecords: number;
    };
  }>;
  inventoryMap: Map<string, typeof DEFAULT_INVENTORY>;
  includeInventory: boolean;
  includeStatistics: boolean;
}) {
  const { products, inventoryMap, includeInventory, includeStatistics } =
    params;

  return products.map(product => {
    const inventory = includeInventory
      ? (inventoryMap.get(product.id) ?? { ...DEFAULT_INVENTORY })
      : { ...DEFAULT_INVENTORY };

    const counts =
      includeStatistics && '_count' in product ? product._count : undefined;

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification,
      unit: product.unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight,
      thickness: product.thickness,
      status: product.status,
      categoryId: product.categoryId,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            code: product.category.code,
          }
        : null,
      inventory,
      statistics: counts
        ? {
            inventory: counts.inventory,
            salesOrderItems: counts.salesOrderItems,
            inboundRecords: counts.inboundRecords,
          }
        : undefined,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
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

