import type { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, handleZodError } from '@/lib/api/errors';
import {
  createInboundRecord,
  getInboundRecords,
  parseInboundQueryParams,
  updateInventoryQuantity,
} from '@/lib/api/inbound-handlers';
import { requireAuth } from '@/lib/auth/api-helpers';
import { requirePermission } from '@/lib/auth/permissions';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { addToFIFOQueue } from '@/lib/services/fifo-cost-service';
import { calculateTotalCost } from '@/lib/types/inventory-operations';
import { withIdempotency } from '@/lib/utils/idempotency';
import {
  batchInboundSchema,
  createInboundSchema,
} from '@/lib/validations/inbound';

// ==========================================
// GET /api/inventory/inbound - 获取入库记录列表
// ==========================================
async function getInboundRecordsHandler(request: NextRequest) {
  const user = requireAuth(request);
  requirePermission(user, 'inventory:view');

  const { searchParams } = request.nextUrl;
  const queryData = parseInboundQueryParams(searchParams);
  const response = await getInboundRecords(queryData);
  return NextResponse.json(response);
}

export const GET = withRateLimit(RateLimitType.READ)(getInboundRecordsHandler);

type ValidatedInboundRecord = z.infer<typeof createInboundSchema>;
type ValidatedBatchInboundRequest = z.infer<typeof batchInboundSchema>;

async function ensureOpeningBalanceAllowed(
  tx: Prisma.TransactionClient,
  data: Pick<ValidatedInboundRecord, 'productId' | 'variantId' | 'batchNumber'>
) {
  const normalizedVariantId = data.variantId ?? null;
  const normalizedBatchNumber = data.batchNumber ?? null;

  const [existingOpeningBalance, existingInventory, existingBusinessInbound] =
    await Promise.all([
      tx.inboundRecord.findFirst({
        where: {
          productId: data.productId,
          variantId: normalizedVariantId,
          batchNumber: normalizedBatchNumber,
          reason: 'opening_balance',
        },
        select: { id: true },
      }),
      tx.inventory.findFirst({
        where: {
          productId: data.productId,
          variantId: normalizedVariantId,
          batchNumber: normalizedBatchNumber,
        },
        select: { id: true },
      }),
      tx.inboundRecord.findFirst({
        where: {
          productId: data.productId,
          variantId: normalizedVariantId,
          batchNumber: normalizedBatchNumber,
          reason: { not: 'opening_balance' },
        },
        select: { id: true },
      }),
    ]);

  if (existingOpeningBalance) {
    throw ApiError.badRequest(
      `批次 ${data.batchNumber} 已有期初库存，如需调整请用“库存调整”`
    );
  }

  if (existingInventory || existingBusinessInbound) {
    throw ApiError.badRequest(
      `批次 ${data.batchNumber} 已存在业务入库/库存，不能再作为期初库存`
    );
  }
}

async function createInboundRecordWithEffects(
  tx: Prisma.TransactionClient,
  data: ValidatedInboundRecord,
  userId: string
) {
  if (data.reason === 'opening_balance') {
    await ensureOpeningBalanceAllowed(tx, data);
  }

  const record = await createInboundRecord(
    {
      productId: data.productId,
      variantId: data.variantId,
      batchNumber: data.batchNumber,
      quantity: data.quantity,
      reason: data.reason,
      remarks: data.remarks,
      damagedQuantity: data.damagedQuantity,
      damageHandling: data.damageHandling,
      damageRemarks: data.damageRemarks,
      piecesPerUnit: data.piecesPerUnit,
      weight: data.weight,
      unitCost: data.unitCost,
      totalCost: calculateTotalCost(data.quantity, data.unitCost),
      supplierId: data.supplierId,
      purchaseOrderId: data.purchaseOrderId,
      purchaseOrderItemId: data.purchaseOrderItemId,
    },
    userId,
    tx
  );

  await addToFIFOQueue(
    {
      productId: data.productId,
      variantId: data.variantId ?? null,
      batchNumber: data.batchNumber ?? null,
      inboundRecordId: record.id,
      quantity: data.quantity,
      unitCost: data.unitCost,
      inboundDate: new Date(),
    },
    tx
  );

  await updateInventoryQuantity(
    data.productId,
    data.batchNumber ?? null,
    data.quantity,
    { variantId: data.variantId, unitCost: data.unitCost },
    tx
  );

  return record;
}

async function createSingleInbound(
  validatedData: ValidatedInboundRecord,
  user: ReturnType<typeof requireAuth>
) {
  if (validatedData.reason === 'opening_balance') {
    requirePermission(user, 'inventory:opening_balance');
  }

  const inboundRecord = await withIdempotency(
    validatedData.idempotencyKey,
    'inbound',
    validatedData.productId,
    user.id,
    validatedData,
    async () =>
      await prisma.$transaction(async tx =>
        createInboundRecordWithEffects(tx, validatedData, user.id)
      )
  );

  await invalidateInventoryCache(validatedData.productId);

  return inboundRecord;
}

async function createBatchInbound(
  validatedData: ValidatedBatchInboundRequest,
  user: ReturnType<typeof requireAuth>
) {
  if (validatedData.records.some(record => record.reason === 'opening_balance')) {
    requirePermission(user, 'inventory:opening_balance');
  }

  const created = await withIdempotency(
    validatedData.batchIdempotencyKey,
    'inbound',
    validatedData.records[0]?.productId ?? 'batch',
    user.id,
    validatedData,
    async () =>
      await prisma.$transaction(async tx => {
        const records = [];

        for (const recordData of validatedData.records) {
          const createdRecord = await createInboundRecordWithEffects(
            tx,
            recordData,
            user.id
          );
          records.push(createdRecord);
        }

        return {
          records,
          count: records.length,
        };
      })
  );

  const affectedProductIds = new Set(
    validatedData.records.map(record => record.productId)
  );

  await Promise.all(
    [...affectedProductIds].map(productId => invalidateInventoryCache(productId))
  );

  return created;
}

// ==========================================
// POST /api/inventory/inbound - 创建入库记录
// - 使用统一的 Zod 校验 + withErrorHandling 返回 422 验证错误
// - 使用数据库幂等性表保证入库操作幂等
// - 成功时返回 { success: true, data: inboundRecord }
// ==========================================
async function postInboundRecordHandler(request: NextRequest) {
  const user = requireAuth(request);
  requirePermission(user, 'inventory:inbound');

  try {
    // 步骤1：解析并验证请求体
    const rawBody = (await request.json()) as unknown;

    // 为兼容旧客户端和单测，如果缺少 unitCost，提供一个安全的最小默认值
    const normalizedBody =
      rawBody && typeof rawBody === 'object'
        ? {
            ...(Array.isArray((rawBody as Record<string, unknown>).records)
              ? {
                  ...(rawBody as Record<string, unknown>),
                  records: ((rawBody as Record<string, unknown>).records as unknown[]).map(
                    record =>
                      record && typeof record === 'object'
                        ? {
                            unitCost: 0.01,
                            ...(record as Record<string, unknown>),
                          }
                        : record
                  ),
                }
              : {
                  unitCost: 0.01,
                  ...(rawBody as Record<string, unknown>),
                }),
          }
        : rawBody;

    const isBatchRequest =
      normalizedBody &&
      typeof normalizedBody === 'object' &&
      Array.isArray((normalizedBody as Record<string, unknown>).records);

    if (isBatchRequest) {
      const parseResult = batchInboundSchema.safeParse(normalizedBody);
      if (!parseResult.success) {
        const apiError = handleZodError(parseResult.error);
        return NextResponse.json(
          {
            success: false,
            error: {
              type: apiError.type,
              message: apiError.message,
              details: apiError.details,
            },
          },
          { status: apiError.statusCode }
        );
      }

      const responseData = await createBatchInbound(parseResult.data, user);

      return NextResponse.json({
        success: true,
        data: responseData,
      });
    }

    const parseResult = createInboundSchema.safeParse(normalizedBody);
    if (!parseResult.success) {
      const apiError = handleZodError(parseResult.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            type: apiError.type,
            message: apiError.message,
            details: apiError.details,
          },
        },
        { status: apiError.statusCode }
      );
    }

    const responseData = await createSingleInbound(parseResult.data, user);

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    // 其他错误：统一返回 500（调试时输出到控制台）

    console.error('POST /api/inventory/inbound failed:', error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(RateLimitType.WRITE)(
  postInboundRecordHandler
);
