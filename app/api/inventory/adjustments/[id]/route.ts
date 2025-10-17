import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * 获取单个库存调整记录详情
 * GET /api/inventory/adjustments/[id]
 */
const getInventoryAdjustmentDetail = async (
  request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '调整记录ID不能为空' },
        { status: 400 }
      );
    }

    // 查询调整记录详情
    const adjustment = await prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
            piecesPerUnit: true,
            category: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        variant: {
          select: {
            id: true,
            colorCode: true,
            colorName: true,
            colorValue: true,
            sku: true,
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
    });

    if (!adjustment) {
      return NextResponse.json(
        { success: false, error: '调整记录不存在' },
        { status: 404 }
      );
    }

    // 格式化数据
    const formattedAdjustment = {
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

    return NextResponse.json({
      success: true,
      data: formattedAdjustment,
    });
  } catch (error) {
    logger.error('inventory-adjustments', '获取库存调整记录详情失败', error, {
      id: params.id,
    });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : '获取库存调整记录详情失败',
      },
      { status: 500 }
    );
  }
};

export const GET = withRateLimit(RateLimitType.READ)(
  getInventoryAdjustmentDetail
);
