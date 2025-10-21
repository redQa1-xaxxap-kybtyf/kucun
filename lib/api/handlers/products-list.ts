/**
 * 产品列表 API 辅助函数
 * 将超长的 GET 方法拆分为多个小函数
 * 遵循全局约定规范：每个函数不超过 50 行
 */

import type { Prisma } from '@prisma/client';

import { getBatchCachedInventorySummary } from '@/lib/cache/inventory-cache';
import type { ProductStatus, ProductUnit } from '@/lib/config/product';
import { prisma } from '@/lib/db';
import { paginationConfig, productConfig } from '@/lib/env';
import { parseProductImages } from '@/lib/utils/product-transforms';

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
 * 批量获取产品的批次规格数据
 * 用于产品选择器性能优化，避免 N+1 查询问题
 */
export async function getProductsBatchSpecifications(productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<
      string,
      Array<{ batchNumber: string; piecesPerUnit: number; quantity: number }>
    >();
  }

  // 1. 批量获取所有产品的库存记录（包含批次号）
  const inventoryRecords = await prisma.inventory.findMany({
    where: {
      productId: { in: productIds },
      batchNumber: { not: null },
    },
    select: {
      productId: true,
      batchNumber: true,
      quantity: true,
      product: {
        select: {
          piecesPerUnit: true,
        },
      },
    },
  });

  // 2. 批量获取所有批次规格
  const batchNumbers = [
    ...new Set(
      inventoryRecords
        .map(inv => inv.batchNumber)
        .filter((bn): bn is string => bn !== null)
    ),
  ];

  // ✅ 防御性编程：只查询有效产品的批次规格，过滤孤儿记录
  const batchSpecs = await prisma.batchSpecification.findMany({
    where: {
      batchNumber: { in: batchNumbers },
      productId: { in: productIds }, // 确保批次规格对应的产品在查询范围内
    },
    select: {
      batchNumber: true,
      piecesPerUnit: true,
      productId: true, // 用于验证
    },
  });

  // ✅ 防御性过滤：移除任何可能的孤儿记录
  const validBatchSpecs = batchSpecs.filter(spec => {
    if (!spec.productId || !productIds.includes(spec.productId)) {
      console.warn(
        `⚠️  警告: 批次规格 ${spec.batchNumber} 的产品不在查询范围内 (productId: ${spec.productId})`
      );
      return false;
    }
    return true;
  });

  // 3. 构建批次号到每件片数的映射
  const batchSpecMap = new Map<string, number>();
  validBatchSpecs.forEach(spec => {
    batchSpecMap.set(spec.batchNumber, spec.piecesPerUnit);
  });

  // 4. 按产品ID分组，构建每个产品的批次规格列表
  const productBatchMap = new Map<
    string,
    Map<
      string,
      { batchNumber: string; piecesPerUnit: number; quantity: number }
    >
  >();

  inventoryRecords.forEach(inv => {
    if (!inv.batchNumber) return;

    // 获取该批次的每件片数（优先使用批次规格，否则使用产品默认值）
    const piecesPerUnit =
      batchSpecMap.get(inv.batchNumber) ?? inv.product.piecesPerUnit ?? 1;

    // 使用特殊分隔符避免与批次号中的 - 冲突
    const key = `${inv.batchNumber}|||${piecesPerUnit}`;

    if (!productBatchMap.has(inv.productId)) {
      productBatchMap.set(inv.productId, new Map());
    }

    const batchMap = productBatchMap.get(inv.productId)!;
    const existing = batchMap.get(key);

    if (existing) {
      existing.quantity += inv.quantity;
    } else {
      batchMap.set(key, {
        batchNumber: inv.batchNumber,
        piecesPerUnit,
        quantity: inv.quantity,
      });
    }
  });

  // 5. 转换为最终格式
  const result = new Map<
    string,
    Array<{ batchNumber: string; piecesPerUnit: number; quantity: number }>
  >();

  productBatchMap.forEach((batchMap, productId) => {
    result.set(productId, Array.from(batchMap.values()));
  });

  return result;
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
    description: string | null;
    thumbnailUrl: string | null;
    images: string | null;
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
  batchSpecsMap?: Map<
    string,
    Array<{ batchNumber: string; piecesPerUnit: number; quantity: number }>
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
    const inventory = includeInventory
      ? (inventoryMap.get(product.id) ?? { ...DEFAULT_INVENTORY })
      : { ...DEFAULT_INVENTORY };

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

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification ?? undefined,
      unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight ?? undefined,
      thickness: product.thickness ?? undefined,
      status,
      categoryId: product.categoryId,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            code: product.category.code,
          }
        : null,
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
