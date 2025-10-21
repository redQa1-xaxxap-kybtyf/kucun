// 产品入库API路由
// 提供入库记录的CRUD操作接口

import type { PrismaClient } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import {
  createInboundRecord,
  getInboundRecords,
  parseInboundQueryParams,
  syncProductSpecificationAsync,
  updateInventoryQuantity,
} from '@/lib/api/inbound-handlers';
import { withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthUser } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { getLongTransactionOptions } from '@/lib/db/transaction-options';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { withIdempotency } from '@/lib/utils/idempotency';
import { createInboundSchema } from '@/lib/validations/inbound';

// GET /api/inventory/inbound - 获取入库记录列表
const getInboundRecordsHandler = withAuth(
  async (request: NextRequest) =>
    withErrorHandling(async () => {
      // 解析查询参数
      const { searchParams } = request.nextUrl;
      const queryData = parseInboundQueryParams(searchParams);

      // 获取入库记录列表
      const response = await getInboundRecords(queryData);
      return NextResponse.json(response);
    })(request),
  { permissions: ['inventory:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getInboundRecordsHandler);

/**
 * 生成批次号
 * @param productId 产品ID
 * @param providedBatchNumber 提供的批次号
 * @returns 最终批次号
 */
async function generateBatchNumber(
  productId: string,
  providedBatchNumber?: string,
  prismaClient: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  > = prisma
): Promise<string | undefined> {
  if (providedBatchNumber) {
    return providedBatchNumber;
  }

  // 性能优化: 并行查询产品信息和现有批次数量
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // 性能优化: 使用聚合查询代替count,并添加索引提示
  // 只查询今天的记录,减少扫描范围
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [product, existingBatches] = await Promise.all([
    prismaClient.product.findUnique({
      where: { id: productId },
      select: { code: true },
    }),
    prismaClient.inboundRecord.count({
      where: {
        productId,
        batchNumber: {
          contains: `${today}-`, // 使用 contains 匹配今天的批次号
        },
        createdAt: {
          gte: todayStart, // 只查询今天创建的记录,大幅减少扫描范围
        },
      },
    }),
  ]);

  if (!product) {
    throw ApiError.notFound('产品');
  }

  const sequence = String(existingBatches + 1).padStart(3, '0');
  return `${product.code}-${today}-${sequence}`;
}

/**
 * 执行入库事务
 * 性能优化: 批次号生成移到事务内部，减少重试循环中的数据库查询
 */
async function executeInboundTransaction(
  validatedData: {
    productId: string;
    variantId?: string;
    quantity: number;
    reason: string;
    remarks?: string;
    batchNumber?: string;
    piecesPerUnit?: number;
    weight?: number;
  },
  userId: string
) {
  // ✅ 性能优化: 使用较短的事务超时(10秒)，避免长时间阻塞
  // 批次号生成移到事务内部，确保原子性且减少重试
  return await prisma.$transaction(async tx => {
    // 性能优化: 在事务内部生成批次号，避免在重试循环中重复执行
    const finalBatchNumber = await generateBatchNumber(
      validatedData.productId,
      validatedData.batchNumber,
      tx
    );

    // 创建入库记录
    const record = await createInboundRecord(
      {
        productId: validatedData.productId,
        variantId: validatedData.variantId,
        quantity: validatedData.quantity,
        reason: validatedData.reason,
        remarks: validatedData.remarks,
        batchNumber: finalBatchNumber,
        piecesPerUnit: validatedData.piecesPerUnit,
        weight: validatedData.weight,
      },
      userId,
      tx
    );

    // 更新库存数量
    await updateInventoryQuantity(
      validatedData.productId,
      finalBatchNumber || null,
      validatedData.quantity,
      {
        variantId: validatedData.variantId,
      },
      tx
    );

    return record;
  }, getLongTransactionOptions()); // 改用15秒超时,匹配幂等性等待时间 (2025-10-21优化)
}

// POST /api/inventory/inbound - 创建入库记录
const postInboundRecordHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      user: AuthUser;
    }
  ) =>
    withErrorHandling(async () => {
      // 解析请求体
      const body = await request.json();
      const validatedData = createInboundSchema.parse(body);

      const { idempotencyKey, productId } = validatedData;

      // 使用幂等性包装器执行入库操作
      const inboundRecord = await withIdempotency(
        idempotencyKey,
        'inbound',
        productId,
        context.user.id,
        validatedData,
        async () =>
          // 性能优化: 批次号生成移到事务内部，确保原子性且减少重试
          await executeInboundTransaction(validatedData, context.user.id)
      );

      // 性能优化: 缓存失效和产品规格同步移到幂等性包装器外部，且使用异步执行
      // 原因: 这些操作不影响事务原子性，失败也不应影响核心入库业务
      Promise.all([
        // 缓存失效
        import('@/lib/cache/inventory-cache').then(
          ({ invalidateInventoryCache }) =>
            invalidateInventoryCache(validatedData.productId).catch(err =>
              console.error('Cache invalidation failed:', err)
            )
        ),
        import('@/lib/cache').then(({ revalidateProducts }) =>
          revalidateProducts(validatedData.productId).catch(err =>
            console.error('Product revalidation failed:', err)
          )
        ),
        // 产品规格同步（仅当提供了规格参数时）
        (validatedData.piecesPerUnit || validatedData.weight) &&
          syncProductSpecificationAsync(
            validatedData.productId,
            validatedData.piecesPerUnit,
            validatedData.weight
          ).catch(err =>
            console.error('Product specification sync failed:', err)
          ),
      ]).catch(err => console.error('Async operation failed:', err));

      return NextResponse.json({
        success: true,
        data: inboundRecord,
      });
    })(request),
  { permissions: ['inventory:inbound'] }
);

export const POST = withRateLimit(RateLimitType.WRITE)(
  postInboundRecordHandler
);
