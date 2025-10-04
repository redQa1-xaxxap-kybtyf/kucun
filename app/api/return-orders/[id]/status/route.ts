// 退货订单状态更新API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { withIdempotency } from '@/lib/utils/idempotency';
import { updateReturnStatusSchema } from '@/lib/validations/return-order';

/**
 * PATCH /api/return-orders/[id]/status - 更新退货订单状态
 */
export const PATCH = withAuth(
  async (request: NextRequest, { user, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    const userId = user.id;

    // 解析请求体
    const body = await request.json();
    const validationResult = updateReturnStatusSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { idempotencyKey, status, remarks, refundAmount, processedAt } =
      validationResult.data;

    // 检查退货订单是否存在
    const existingReturnOrder = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        items: true,
        salesOrder: true,
      },
    });

    if (!existingReturnOrder) {
      return NextResponse.json(
        { success: false, error: '退货订单不存在' },
        { status: 404 }
      );
    }

    // 使用幂等性包装器
    const { updateReturnOrderStatus } = await import(
      '@/lib/api/handlers/return-order-status'
    );

    const result = await withIdempotency(
      idempotencyKey,
      'return_order_status_change',
      id,
      userId,
      { status, remarks, refundAmount, processedAt },
      async () => await updateReturnOrderStatus(
          id,
          status,
          existingReturnOrder.status,
          existingReturnOrder.processType,
          { remarks, refundAmount, processedAt },
          userId
        )
    );

    // 获取更新后的完整订单信息
    const updatedReturnOrder = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
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
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedReturnOrder,
        refundCreated: result.refundCreated,
      },
      message: '退货订单状态更新成功',
    });
  },
  { permissions: ['returns:edit'] }
);
