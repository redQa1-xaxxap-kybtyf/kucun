/**
 * 库存调整记录服务端数据获取函数
 * 用于 Next.js 15.4 Server Components
 */

import {
  INVENTORY_ADJUSTMENT_SELECT,
  type InventoryAdjustmentWithRelations,
} from '@/lib/api/selectors/inventory-selectors';
import { prisma } from '@/lib/db';
import { inventoryAdjustmentsQuerySchema } from '@/lib/validations/inventory-queries';

/**
 * 构建调整记录查询条件
 */
function buildAdjustmentWhereClause(queryParams: {
  search?: string;
  productId?: string;
  variantId?: string;
  batchNumber?: string;
  reason?: string;
  status?: string;
  operatorId?: string;
  startDate?: string;
  endDate?: string;
}): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  // 搜索条件
  if (queryParams.search) {
    where.OR = [
      { adjustmentNumber: { contains: queryParams.search } },
      { notes: { contains: queryParams.search } },
      { product: { name: { contains: queryParams.search } } },
      { product: { code: { contains: queryParams.search } } },
    ];
  }

  // 筛选条件
  if (queryParams.productId) {
    where.productId = queryParams.productId;
  }
  if (queryParams.variantId) {
    where.variantId = queryParams.variantId;
  }
  if (queryParams.batchNumber) {
    where.batchNumber = queryParams.batchNumber;
  }
  if (queryParams.reason) {
    where.reason = queryParams.reason;
  }
  if (queryParams.status) {
    where.status = queryParams.status;
  }
  if (queryParams.operatorId) {
    where.operatorId = queryParams.operatorId;
  }

  // 日期范围筛选
  if (queryParams.startDate || queryParams.endDate) {
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (queryParams.startDate) {
      createdAtFilter.gte = new Date(queryParams.startDate);
    }
    if (queryParams.endDate) {
      createdAtFilter.lte = new Date(queryParams.endDate);
    }
    where.createdAt = createdAtFilter;
  }

  return where;
}

/**
 * 构建调整记录排序配置
 */
function buildAdjustmentOrderBy(
  sortBy: 'createdAt' | 'adjustmentNumber' | 'quantity' | 'reason' | undefined,
  sortOrder: 'asc' | 'desc' | undefined
): Record<string, 'asc' | 'desc'> {
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  const finalSortOrder = sortOrder || 'desc';

  if (sortBy === 'createdAt') {
    orderBy.createdAt = finalSortOrder;
  } else if (sortBy === 'adjustmentNumber') {
    orderBy.adjustmentNumber = finalSortOrder;
  } else if (sortBy === 'quantity') {
    // Map 'quantity' from query to 'adjustQuantity' in database
    orderBy.adjustQuantity = finalSortOrder;
  } else if (sortBy === 'reason') {
    orderBy.reason = finalSortOrder;
  } else {
    // Default to createdAt
    orderBy.createdAt = finalSortOrder;
  }

  return orderBy;
}

/**
 * 格式化调整记录数据
 */
function formatAdjustmentData(adjustment: InventoryAdjustmentWithRelations) {
  return {
    id: adjustment.id,
    adjustmentNumber: adjustment.adjustmentNumber,
    productId: adjustment.productId,
    variantId: adjustment.variantId,
    batchNumber: adjustment.batchNumber,
    beforeQuantity: adjustment.beforeQuantity,
    adjustQuantity: adjustment.adjustQuantity,
    afterQuantity: adjustment.afterQuantity,
    reason: adjustment.reason,
    notes: adjustment.notes,
    status: adjustment.status,
    operatorId: adjustment.operatorId,
    approverId: adjustment.approverId,
    approvedAt: adjustment.approvedAt?.toISOString(),
    createdAt: adjustment.createdAt.toISOString(),
    updatedAt: adjustment.updatedAt.toISOString(),
    product: adjustment.product,
    variant: adjustment.variant,
    operator: adjustment.operator,
    approver: adjustment.approver,
  };
}

/**
 * 获取库存调整记录列表
 */
export async function getAdjustmentsServer(searchParams: URLSearchParams) {
  // 解析和验证查询参数
  const rawParams = {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    search: searchParams.get('search'),
    productId: searchParams.get('productId'),
    variantId: searchParams.get('variantId'),
    batchNumber: searchParams.get('batchNumber'),
    reason: searchParams.get('reason'),
    status: searchParams.get('status'),
    operatorId: searchParams.get('operatorId'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    sortBy: searchParams.get('sortBy'),
    sortOrder: searchParams.get('sortOrder'),
  };

  const validationResult = inventoryAdjustmentsQuerySchema.safeParse(rawParams);

  if (!validationResult.success) {
    throw new Error('查询参数格式不正确');
  }

  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    ...filters
  } = validationResult.data;

  const offset = (page - 1) * limit;

  // 构建查询条件和排序
  const where = buildAdjustmentWhereClause(filters);
  const orderBy = buildAdjustmentOrderBy(
    sortBy as 'createdAt' | 'adjustmentNumber' | 'quantity' | 'reason',
    sortOrder
  );

  // 查询数据
  const [adjustments, total] = await Promise.all([
    prisma.inventoryAdjustment.findMany({
      where,
      select: INVENTORY_ADJUSTMENT_SELECT,
      skip: offset,
      take: limit,
      orderBy,
    }),
    prisma.inventoryAdjustment.count({ where }),
  ]);

  // 格式化数据
  const formattedAdjustments = adjustments.map(adj =>
    formatAdjustmentData(adj as InventoryAdjustmentWithRelations)
  );

  return {
    adjustments: formattedAdjustments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 根据调整单号获取详情
 */
export async function getAdjustmentByNumber(adjustmentNumber: string) {
  if (!adjustmentNumber) {
    return null;
  }

  const adjustment = await prisma.inventoryAdjustment.findUnique({
    where: { adjustmentNumber },
    select: INVENTORY_ADJUSTMENT_SELECT,
  });

  if (!adjustment) {
    return null;
  }

  const inventoryRecord = await prisma.inventory.findFirst({
    where: {
      productId: adjustment.productId,
      variantId: adjustment.variantId ?? null,
      batchNumber: adjustment.batchNumber ?? null,
    },
    select: {
      quantity: true,
    },
  });

  return {
    id: adjustment.id,
    adjustmentNumber: adjustment.adjustmentNumber,
    productId: adjustment.productId,
    variantId: adjustment.variantId ?? undefined,
    batchNumber: adjustment.batchNumber ?? undefined,
    beforeQuantity: adjustment.beforeQuantity,
    adjustQuantity: adjustment.adjustQuantity,
    afterQuantity: adjustment.afterQuantity,
    reason: adjustment.reason,
    notes: adjustment.notes ?? undefined,
    status: adjustment.status,
    operatorId: adjustment.operatorId,
    approverId: adjustment.approverId ?? undefined,
    approvedAt: adjustment.approvedAt?.toISOString(),
    createdAt: adjustment.createdAt.toISOString(),
    updatedAt: adjustment.updatedAt.toISOString(),
    product: adjustment.product
      ? {
          id: adjustment.product.id,
          code: adjustment.product.code,
          name: adjustment.product.name,
          specification: adjustment.product.specification ?? undefined,
          unit: adjustment.product.unit,
        }
      : undefined,
    variant: adjustment.variant
      ? {
          id: adjustment.variant.id,
          colorCode: adjustment.variant.colorCode,
          colorName: adjustment.variant.colorName,
        }
      : undefined,
    operator: adjustment.operator
      ? {
          id: adjustment.operator.id,
          name: adjustment.operator.name ?? '—',
        }
      : undefined,
    approver: adjustment.approver
      ? {
          id: adjustment.approver.id,
          name: adjustment.approver.name ?? '—',
        }
      : undefined,
    inventoryBalance: inventoryRecord?.quantity ?? undefined,
  };
}
