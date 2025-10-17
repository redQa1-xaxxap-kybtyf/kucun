// 产品入库API路由
// 提供入库记录的CRUD操作接口

import { type NextRequest, NextResponse } from 'next/server';

import {
  createInboundRecord,
  getInboundRecords,
  parseInboundQueryParams,
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
  providedBatchNumber?: string
): Promise<string | undefined> {
  if (providedBatchNumber) {
    return providedBatchNumber;
  }

  // 获取产品信息用于生成批次号
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { code: true },
  });

  if (!product) {
    return undefined;
  }

  // 生成批次号格式：产品编码-日期-序号
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const existingBatches = await prisma.inboundRecord.count({
    where: {
      productId,
      batchNumber: {
        startsWith: `${product.code}-${today}-`,
      },
    },
  });

  const sequence = String(existingBatches + 1).padStart(3, '0');
  return `${product.code}-${today}-${sequence}`;
}

/**
 * 执行入库事务
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
  userId: string,
  finalBatchNumber: string | undefined
) {
  // ✅ P2优化: 使用事务超时配置,防止长时间阻塞
  return await prisma.$transaction(async tx => {
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
  }, getLongTransactionOptions());
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
        async () => {
          // 处理批次号：如果没有提供批次号，自动生成
          const finalBatchNumber = await generateBatchNumber(
            validatedData.productId,
            validatedData.batchNumber
          );

          // 使用事务确保数据一致性
          return await executeInboundTransaction(
            validatedData,
            context.user.id,
            finalBatchNumber
          );
        }
      );

      // 修复：添加缓存失效调用
      const [{ invalidateInventoryCache }, { revalidateProducts }] =
        await Promise.all([
          import('@/lib/cache/inventory-cache'),
          import('@/lib/cache'),
        ]);
      await invalidateInventoryCache(validatedData.productId);
      await revalidateProducts(validatedData.productId);

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
