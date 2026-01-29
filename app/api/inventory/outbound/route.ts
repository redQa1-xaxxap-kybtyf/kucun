import { randomUUID } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { withErrorHandling } from '@/lib/api/middleware';
import {
  buildOffsetPaginationMeta,
  parseOffsetPagination,
} from '@/lib/api/pagination';
import { withAuth } from '@/lib/auth/api-helpers';
import { revalidateInventory } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { publishInventoryChange } from '@/lib/events';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import {
  consumeFIFOQueueByBatch,
  ensureFIFOQueueMatchesInventory,
} from '@/lib/services/fifo-cost-service';
import type { OutboundType } from '@/lib/types/inventory';
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
      where.createdAt.gte = new Date(`${params.startDate}T00:00:00.000`);
    }
    if (params.endDate) {
      where.createdAt.lte = new Date(`${params.endDate}T23:59:59.999`);
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
        ({ page, limit } = parseOffsetPagination(searchParams, {
          defaultPage: 1,
          defaultLimit: paginationConfig.defaultPageSize,
          maxLimit: paginationConfig.maxPageSize,
          strict: true,
          pageFieldLabel: '页码',
          limitFieldLabel: '每页数量',
        }));
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
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
          take: batchQueries.length,
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
          ? (batchSpecMap.get(batchKey) ?? record.product.piecesPerUnit)
          : record.product.piecesPerUnit;

        return {
          ...formatOutboundRecord(record),
          piecesPerUnit,
        };
      });

      return NextResponse.json({
        data: formattedRecords,
        pagination: buildOffsetPaginationMeta({
          page,
          limit,
          total,
          hasMore: skip + formattedRecords.length < total,
        }),
      });
    })(request, {}),
  { permissions: ['inventory:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getOutboundRecordsHandler);

/**
 * 执行出库事务
 * 使用乐观锁防止并发问题
 */
export async function executeOutboundTransaction(
  data: {
    type: OutboundType;
    productId: string;
    quantity: number;
    batchNumber?: string;
    variantId?: string;
    reason?: string;
    notes?: string;
    remarks?: string;
    customerId?: string;
  },
  userId: string
) {
  const {
    type,
    productId,
    quantity,
    batchNumber,
    variantId,
    reason,
    notes,
    remarks,
    customerId,
  } = data;

  const normalizedBatchNumber =
    typeof batchNumber === 'string' ? batchNumber.trim() : '';
  const normalizedVariantId =
    typeof variantId === 'string' ? variantId.trim() : '';
  const normalizedCustomerId =
    typeof customerId === 'string' ? customerId.trim() : '';

  return await prisma.$transaction(async tx => {
    // ✅ 修复：批次号必填校验
    if (normalizedBatchNumber.length === 0) {
      throw new Error('批次号/色号为必填项');
    }

    // ✅ 修复：如果有客户ID，校验同一客户的批次一致性
    if (normalizedCustomerId.length > 0) {
      const existingOutbounds = await tx.outboundRecord.findMany({
        where: {
          customerId: normalizedCustomerId,
          productId,
        },
        select: {
          batchNumber: true,
        },
        distinct: ['batchNumber'],
        take: 1000,
      });

      if (existingOutbounds.length > 0) {
        const existingBatches = existingOutbounds
          .map(r => r.batchNumber)
          .filter(Boolean);
        if (
          existingBatches.length > 0 &&
          !existingBatches.includes(normalizedBatchNumber)
        ) {
          throw new Error(
            `同一客户的同一产品必须使用相同批次。已有批次：${existingBatches.join(', ')}`
          );
        }
      }
    }

    // 1. 查找可用库存（必须指定批次）
    const whereCondition: {
      productId: string;
      variantId?: string;
      batchNumber: string; // ✅ 修复：批次号必填
    } = {
      productId,
      batchNumber: normalizedBatchNumber, // ✅ 修复：必须指定批次
    };

    if (normalizedVariantId.length > 0) {
      whereCondition.variantId = normalizedVariantId;
    }

    const availableInventory = await tx.inventory.findFirst({
      where: whereCondition,
      orderBy: [{ updatedAt: 'asc' }],
    });

    if (!availableInventory) {
      throw new Error(`未找到批次 ${normalizedBatchNumber} 的库存记录`);
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
    // ✅ 修复：出库时同时扣减 quantity 和 reservedQuantity
    const updatedCount = await tx.inventory.updateMany({
      where: {
        id: availableInventory.id,
        quantity: { gte: quantity }, // 确保库存足够
      },
      data: {
        quantity: { decrement: quantity },
        // ✅ 修复：同时扣减预留量，最多扣减到 0
        reservedQuantity: {
          decrement: Math.min(availableInventory.reservedQuantity, quantity),
        },
        updatedAt: new Date(),
      },
    });

    if (updatedCount.count === 0) {
      throw new Error('库存不足或已被其他操作占用,请重试');
    }

    // 2.1 使用 FIFO 队列计算成本（若发现 FIFO 缺失则在事务内补齐，避免账实不一致）
    const outboundQty = quantity;
    const unitCostHint =
      availableInventory.unitCost !== null &&
      availableInventory.unitCost !== undefined
        ? Number(availableInventory.unitCost)
        : null;

    await ensureFIFOQueueMatchesInventory(
      {
        inventoryId: availableInventory.id,
        productId,
        variantId: availableInventory.variantId,
        batchNumber: availableInventory.batchNumber,
        expectedInventoryQty: oldQuantity,
        unitCostHint,
        userId,
        source: 'inventory-outbound',
      },
      tx
    );

    const fifoCost = await consumeFIFOQueueByBatch(
      productId,
      availableInventory.variantId,
      availableInventory.batchNumber,
      outboundQty,
      tx
    );

    // FIFO 服务已在内部做四舍五入
    const unitCost = fifoCost.averageUnitCost;
    const totalCost = fifoCost.totalCost;

    // 3. 获取更新后的库存记录
    const updatedInventory = await tx.inventory.findUnique({
      where: { id: availableInventory.id },
      include: {
        product: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // 4. 创建出库记录（包含成本信息）
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const recordNumber = `OUT-${dateStr}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const notesParts = [reason, notes, remarks]
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .filter(value => value.length > 0);
    const mergedNotes = notesParts.length > 0 ? notesParts.join(' | ') : null;

    await tx.outboundRecord.create({
      data: {
        recordNumber,
        productId,
        inventoryId: availableInventory.id,
        quantity,
        unitCost, // FIFO 或库存单位成本
        totalCost, // FIFO 或库存总成本
        reason: type,
        batchNumber: availableInventory.batchNumber,
        variantId: availableInventory.variantId,
        notes: mergedNotes,
        customerId:
          normalizedCustomerId.length > 0 ? normalizedCustomerId : null,
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
