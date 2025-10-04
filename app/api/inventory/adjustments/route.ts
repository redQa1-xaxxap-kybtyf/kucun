import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { errorResponse, verifyApiAuth } from '@/lib/api-helpers';
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
type AdjustmentQueryParams = {
  sortBy?: 'createdAt' | 'adjustmentNumber' | 'quantity' | 'reason';
};

function buildAdjustmentOrderBy(
  sortBy: AdjustmentQueryParams['sortBy'],
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
  }

  return orderBy;
}

/**
 * 格式化调整记录数据
 */
type AdjustmentWithRelations = {
  id: string;
  adjustmentNumber: string;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  beforeQuantity: number;
  adjustQuantity: number;
  afterQuantity: number;
  reason: string;
  notes: string | null;
  status: string;
  operatorId: string;
  approverId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    code: string;
    name: string;
  };
  variant: {
    id: string;
    sku: string;
    colorCode: string;
    colorName: string | null;
  } | null;
  operator: {
    id: string;
    name: string;
  };
  approver: {
    id: string;
    name: string;
  } | null;
};

function formatAdjustmentData(adjustment: AdjustmentWithRelations) {
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
 * GET /api/inventory/adjustments
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // 验证用户权限 - 使用中间件透传的用户信息
  const auth = verifyApiAuth(request);
  if (!auth.success) {
    throw ApiError.unauthorized();
  }

  // 解析并验证查询参数
  const { searchParams } = new URL(request.url);
  const queryParams = {
    page: searchParams.get('page')
      ? parseInt(searchParams.get('page')!, 10)
      : undefined,
    limit: searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined,
    search: searchParams.get('search') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    productId: searchParams.get('productId') || undefined,
    variantId: searchParams.get('variantId') || undefined,
    batchNumber: searchParams.get('batchNumber') || undefined,
    reason: searchParams.get('reason') || undefined,
    status: searchParams.get('status') || undefined,
    operatorId: searchParams.get('operatorId') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  };

  // 使用 Zod schema 验证
  const validationResult =
    inventoryAdjustmentsQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: '查询参数验证失败',
        details: validationResult.error.issues,
      },
      { status: 400 }
    );
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
  const orderBy = buildAdjustmentOrderBy(sortBy, sortOrder);

  // 查询数据
  const [adjustments, total] = await Promise.all([
    prisma.inventoryAdjustment.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
          },
        },
        variant: {
          select: {
            id: true,
            sku: true,
            colorCode: true,
            colorName: true,
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
      },
      orderBy,
      skip: offset,
      take: limit,
    }),
    prisma.inventoryAdjustment.count({ where }),
  ]);

  // 格式化数据
  const formattedAdjustments = adjustments.map(formatAdjustmentData);
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    success: true,
    data: {
      adjustments: formattedAdjustments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  });
});
