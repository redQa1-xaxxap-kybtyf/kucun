import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { ensureRefundRecordForCompletedReturnOrder } from '@/lib/services/return-order-orchestrator';

export const POST = withAuth(
  async (_request: NextRequest, { params, user }) => {
    const { id } = await (params as Promise<{ id: string }>);

    try {
      const result = await prisma.$transaction(async tx =>
        ensureRefundRecordForCompletedReturnOrder(tx, {
          orderId: id,
          userId: user.id,
        })
      );

      return NextResponse.json({
        success: true,
        data: result,
        message: result.created ? '退款处理单已生成' : '退款处理单已同步',
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '生成退款处理单失败',
        },
        { status: 400 }
      );
    }
  },
  { permissions: ['returns:edit'] }
);
