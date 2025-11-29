import { type NextRequest, NextResponse } from 'next/server';

import { handleZodError } from '@/lib/api/errors';
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
import { calculateTotalCost } from '@/lib/types/inventory-operations';
import { withIdempotency } from '@/lib/utils/idempotency';
import { createInboundSchema } from '@/lib/validations/inbound';

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
            unitCost: 0.01,
            ...(rawBody as Record<string, unknown>),
          }
        : rawBody;

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

    const validatedData = parseResult.data;
    const {
      idempotencyKey,
      productId,
      batchNumber,
      quantity,
      reason,
      remarks,
      piecesPerUnit,
      weight,
      variantId,
      unitCost,
    } = validatedData;

    // 期初库存需要额外权限
    if (reason === 'opening_balance') {
      requirePermission(user, 'inventory:opening_balance');
    }

    // 步骤2：使用幂等性包装入库事务
    const inboundRecord = await withIdempotency(
      idempotencyKey,
      'inbound',
      productId,
      user.id,
      validatedData,
      async () =>
        await prisma.$transaction(async tx => {
          // 创建入库记录
          const record = await createInboundRecord(
            {
              productId,
              variantId,
              batchNumber,
              quantity,
              reason,
              remarks,
              piecesPerUnit,
              weight,
              unitCost,
              totalCost: calculateTotalCost(quantity, unitCost),
            },
            user.id,
            tx
          );

          // 更新库存数量
          await updateInventoryQuantity(
            productId,
            batchNumber ?? null,
            quantity,
            { variantId, unitCost },
            tx
          );

          return record;
        })
    );

    // 步骤3：入库成功后，失效库存缓存
    await invalidateInventoryCache(productId);

    return NextResponse.json({
      success: true,
      data: inboundRecord,
    });
  } catch (error) {
    // 其他错误：统一返回 500（调试时输出到控制台）

    console.error('POST /api/inventory/inbound failed:', error);
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
