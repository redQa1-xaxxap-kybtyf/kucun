import { type NextRequest, NextResponse } from 'next/server';

import { withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { revalidateInventory } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { publishInventoryChange } from '@/lib/events';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { withIdempotency } from '@/lib/utils/idempotency';
import { outboundCreateSchema } from '@/lib/validations/inventory-operations';

type OutboundWhereClause = {
  OR?: Array<{
    recordNumber?: { contains: string };
    product?: { name?: { contains: string }; code?: { contains: string } };
    batchNumber?: { contains: string };
  }>;
  reason?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
};

/**
 * 构建出库记录查询条件
 */
function buildOutboundWhereClause(params: {
  search?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}): OutboundWhereClause {
  const where: OutboundWhereClause = {};

  if (params.search) {
    where.OR = [
      { recordNumber: { contains: params.search } },
      { product: { name: { contains: params.search } } },
      { product: { code: { contains: params.search } } },
      { batchNumber: { contains: params.search } },
    ];
  }

  if (params.type) {
    where.reason = params.type;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.createdAt.lte = new Date(params.endDate);
    }
  }

  return where;
}

type OutboundRecordWithProduct = {
  id: string;
  recordNumber: string;
  productId: string;
  quantity: number;
  reason: string;
  notes: string | null;
  batchNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    code: string;
    name: string;
    specification: string | null;
    piecesPerUnit: number;
    weight: number | null;
  };
};

/**
 * 格式化出库记录数据
 */
function formatOutboundRecord(record: OutboundRecordWithProduct) {
  return {
    id: record.id,
    recordNumber: record.recordNumber,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    productSpecification: record.product.specification,
    piecesPerUnit: record.product.piecesPerUnit,
    batchNumber: record.batchNumber,
    quantity: record.quantity,
    type: record.reason,
    reason: record.notes || undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parsePositiveInteger(
  value: string | null,
  {
    defaultValue,
    field,
    max,
  }: { defaultValue: number; field: string; max?: number }
): number {
  if (value === null) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${field}必须为正整数`);
  }
  if (parsed <= 0) {
    throw new Error(`${field}必须大于0`);
  }
  if (typeof max === 'number' && parsed > max) {
    throw new Error(`${field}不能超过${max}`);
  }

  return parsed;
}

function normalizeStringParam(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function validateDateRange(
  startDate?: string,
  endDate?: string
): string | undefined {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate && !dateRegex.test(startDate)) {
    return '开始日期格式不正确，需使用 YYYY-MM-DD';
  }
  if (endDate && !dateRegex.test(endDate)) {
    return '结束日期格式不正确，需使用 YYYY-MM-DD';
  }
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return '日期参数无效';
    }
    if (start > end) {
      return '开始日期不能晚于结束日期';
    }
  }
  return undefined;
}

/**
 * 获取出库记录列表
 * GET /api/inventory/outbound
 */
const getOutboundRecordsHandler = withAuth(
  async (request: NextRequest) =>
    withErrorHandling(async () => {
      // 解析查询参数
      const { searchParams } = request.nextUrl;

      let page: number;
      let limit: number;
      try {
        page = parsePositiveInteger(searchParams.get('page'), {
          defaultValue: 1,
          field: '页码',
        });
        limit = parsePositiveInteger(searchParams.get('limit'), {
          defaultValue: paginationConfig.defaultPageSize,
          field: '每页数量',
          max: paginationConfig.maxPageSize,
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error ? error.message : '分页参数格式不正确',
          },
          { status: 400 }
        );
      }

      const search = normalizeStringParam(searchParams.get('search'));
      const type = normalizeStringParam(searchParams.get('type'));
      const startDate = normalizeStringParam(searchParams.get('startDate'));
      const endDate = normalizeStringParam(searchParams.get('endDate'));

      const dateError = validateDateRange(startDate, endDate);
      if (dateError) {
        return NextResponse.json(
          {
            success: false,
            error: dateError,
          },
          { status: 400 }
        );
      }

      // 构建查询条件
      const where = buildOutboundWhereClause({
        search,
        type,
        startDate,
        endDate,
      });

      // 计算分页
      const skip = (page - 1) * limit;

      // 并行查询记录和总数
      const [records, total] = await Promise.all([
        prisma.outboundRecord.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                specification: true,
                piecesPerUnit: true,
                weight: true,
              },
            },
          },
        }),
        prisma.outboundRecord.count({ where }),
      ]);

      // 查询每个批次的规格信息以获取实际的每件片数
      const batchSpecMap = new Map<string, number>();
      const batchQueries = records.reduce<
        Array<{ productId: string; batchNumber: string }>
      >((acc, record) => {
        if (!record.batchNumber) {
          return acc;
        }
        acc.push({
          productId: record.productId,
          batchNumber: record.batchNumber,
        });
        return acc;
      }, []);

      if (batchQueries.length > 0) {
        const batchSpecs = await prisma.batchSpecification.findMany({
          where: {
            OR: batchQueries.map(q => ({
              productId: q.productId,
              batchNumber: q.batchNumber,
            })),
          },
          select: {
            productId: true,
            batchNumber: true,
            piecesPerUnit: true,
          },
        });

        batchSpecs.forEach(spec => {
          const key = `${spec.productId}-${spec.batchNumber}`;
          batchSpecMap.set(key, spec.piecesPerUnit);
        });
      }

      // 格式化数据，使用批次规格的每件片数
      const formattedRecords = records.map(record => {
        const batchKey = record.batchNumber
          ? `${record.productId}-${record.batchNumber}`
          : null;
        const piecesPerUnit = batchKey
          ? batchSpecMap.get(batchKey) ?? record.product.piecesPerUnit
          : record.product.piecesPerUnit;

        return {
          ...formatOutboundRecord(record),
          piecesPerUnit,
        };
      });

      return NextResponse.json({
        data: formattedRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    })(request, {}),
  { permissions: ['inventory:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getOutboundRecordsHandler);

/**
 * 执行出库事务
 * 使用乐观锁防止并发问题
 */
async function executeOutboundTransaction(
  data: {
    productId: string;
    quantity: number;
    batchNumber?: string;
    variantId?: string;
    reason?: string;
    notes?: string;
    customerId?: string;
  },
  userId: string
) {
  const {
    productId,
    quantity,
    batchNumber,
    variantId,
    reason,
    notes,
    customerId,
  } = data;

  return await prisma.$transaction(async tx => {
    // 1. 查找可用库存
    const whereCondition: {
      productId: string;
      variantId?: string;
      batchNumber?: string;
    } = { productId };

    if (variantId) {
      whereCondition.variantId = variantId;
    }
    if (batchNumber) {
      whereCondition.batchNumber = batchNumber;
    }

    const availableInventory = await tx.inventory.findFirst({
      where: whereCondition,
      orderBy: [{ updatedAt: 'asc' }],
    });

    if (!availableInventory) {
      throw new Error('未找到匹配的库存记录');
    }

    // 记录出库前的数量（用于事件发布）
    const oldQuantity = availableInventory.quantity;

    // 检查可用库存
    const availableQuantity =
      availableInventory.quantity - availableInventory.reservedQuantity;
    if (availableQuantity < quantity) {
      throw new Error(
        `可用库存不足,当前可用库存:${availableQuantity},需要出库:${quantity}`
      );
    }

    // 2. 使用乐观锁更新库存 - 确保并发安全
    const updatedCount = await tx.inventory.updateMany({
      where: {
        id: availableInventory.id,
        quantity: { gte: quantity }, // 确保库存足够
      },
      data: {
        quantity: { decrement: quantity },
        reservedQuantity: Math.max(
          0,
          Math.min(
            availableInventory.reservedQuantity,
            availableInventory.quantity - quantity
          )
        ),
        updatedAt: new Date(),
      },
    });

    if (updatedCount.count === 0) {
      throw new Error('库存不足或已被其他操作占用,请重试');
    }

    // 3. 获取更新后的库存记录
    const updatedInventory = await tx.inventory.findUnique({
      where: { id: availableInventory.id },
      include: {
        product: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // 4. 创建出库记录
    const recordNumber = `OUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

    await tx.outboundRecord.create({
      data: {
        recordNumber,
        productId,
        inventoryId: availableInventory.id,
        quantity,
        reason: reason || 'manual_outbound',
        batchNumber: availableInventory.batchNumber,
        variantId: availableInventory.variantId,
        notes,
        customerId,
        operatorId: userId,
      },
    });

    return { inventory: updatedInventory, oldQuantity };
  });
}

/**
 * 出库操作API
 * POST /api/inventory/outbound
 */
const postOutboundRecordHandler = withAuth(
  async (request: NextRequest, { user }) =>
    withErrorHandling(async () => {
      const body = await request.json();

      // 验证请求数据
      const validatedData = outboundCreateSchema.parse(body);

      const { idempotencyKey, productId } = validatedData;

      // 使用幂等性包装器执行出库操作
      const result = await withIdempotency(
        idempotencyKey,
        'outbound',
        productId,
        user.id,
        validatedData,
        async () => await executeOutboundTransaction(validatedData, user.id)
      );

      // 使用统一的缓存失效系统（自动级联失效相关缓存）
      await revalidateInventory(productId);

      // 发布库存变更事件（新事件系统）
      if (result && result.inventory) {
        await publishInventoryChange({
          action: 'outbound',
          productId,
          productName: result.inventory.product.name,
          oldQuantity: result.oldQuantity,
          newQuantity: result.inventory.quantity,
          reason: validatedData.reason,
          operator: user.name || user.username,
          userId: user.id,
        });
      }

      return NextResponse.json({
        success: true,
        data: result?.inventory,
        message: '出库操作成功',
      });
    })(request, {}),
  { permissions: ['inventory:outbound'] }
);

export const POST = withRateLimit(RateLimitType.WRITE)(
  postOutboundRecordHandler
);
