// 产品入库API路由
// 提供入库记录的CRUD操作接口

import { type NextRequest, NextResponse } from 'next/server';

import {
  createInboundRecord,
  getInboundRecords,
  parseInboundQueryParams,
  updateInventoryQuantity,
  validateUserSession,
} from '@/lib/api/inbound-handlers';
import { prisma } from '@/lib/db';
import { withIdempotency } from '@/lib/utils/idempotency';
import { createInboundSchema } from '@/lib/validations/inbound';

// GET /api/inventory/inbound - 获取入库记录列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    await validateUserSession();

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryData = parseInboundQueryParams(searchParams);

    // 获取入库记录列表
    const response = await getInboundRecords(queryData);
    return NextResponse.json(response);
  } catch (error) {
    console.error('获取入库记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取入库记录失败' },
      { status: 500 }
    );
  }
}

// POST /api/inventory/inbound - 创建入库记录
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await validateUserSession();

    // 解析请求体
    const body = await request.json();
    const validatedData = createInboundSchema.parse(body);

    const { idempotencyKey, productId } = validatedData;

    // 使用幂等性包装器执行入库操作
    const inboundRecord = await withIdempotency(
      idempotencyKey,
      'inbound',
      productId,
      session.user.id,
      validatedData,
      async () => {
        // 处理批次号：如果没有提供批次号，自动生成
        let finalBatchNumber = validatedData.batchNumber;
        if (!finalBatchNumber) {
          // 获取产品信息用于生成批次号
          const product = await prisma.product.findUnique({
            where: { id: validatedData.productId },
            select: { code: true },
          });

          if (product) {
            // 生成批次号格式：产品编码-日期-序号
            const today = new Date()
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, '');
            const existingBatches = await prisma.inboundRecord.count({
              where: {
                productId: validatedData.productId,
                batchNumber: {
                  startsWith: `${product.code}-${today}-`,
                },
              },
            });

            const sequence = String(existingBatches + 1).padStart(3, '0');
            finalBatchNumber = `${product.code}-${today}-${sequence}`;
          }
        }

        // 使用事务确保数据一致性
        return await prisma.$transaction(async tx => {
          // 创建入库记录
          const record = await createInboundRecord(
            {
              ...validatedData,
              batchNumber: finalBatchNumber,
            },
            session.user.id,
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
        });
      }
    );

    // 修复：添加缓存失效调用
    const { invalidateInventoryCache } = await import(
      '@/lib/cache/inventory-cache'
    );
    await invalidateInventoryCache(validatedData.productId);

    // WebSocket 推送更新
    const { publishWs } = await import('@/lib/ws/ws-server');
    publishWs('inventory', {
      type: 'inbound',
      productId: validatedData.productId,
      quantity: validatedData.quantity,
      recordNumber: inboundRecord.recordNumber,
    });

    return NextResponse.json({
      success: true,
      data: inboundRecord,
    });
  } catch (error) {
    console.error('创建入库记录失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '创建入库记录失败' },
      { status: 500 }
    );
  }
}
