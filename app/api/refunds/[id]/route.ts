import { type NextRequest, NextResponse } from 'next/server';

import { errorResponse, requireAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/refunds/[id] - 获取退款详情
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request);

    const { id } = await context.params;

    const refund = await prisma.refundRecord.findUnique({
      where: { id },
      include: {
        returnOrder: {
          select: {
            id: true,
            returnNumber: true,
            type: true,
            status: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!refund) {
      return errorResponse('退款记录不存在', 404);
    }

    return NextResponse.json({ success: true, data: refund });
  } catch (error) {
    logger.error('refunds', '获取退款详情失败', error);
    return errorResponse('获取退款详情失败', 500);
  }
}

// 注意：退款在创建时直接完成，不需要额外的处理端点
