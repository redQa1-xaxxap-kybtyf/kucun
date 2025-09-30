// 退货订单状态更新API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withIdempotency } from '@/lib/utils/idempotency';
import { updateReturnStatusSchema } from '@/lib/validations/return-order';

/**
 * PATCH /api/return-orders/[id]/status - 更新退货订单状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = updateReturnStatusSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          details: validationResult.error.errors,
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
      session.user.id,
      { status, remarks, refundAmount, processedAt },
      async () => {
        return await updateReturnOrderStatus(
          id,
          status,
          existingReturnOrder.status,
          existingReturnOrder.processType,
          { remarks, refundAmount, processedAt },
          session.user.id
        );
      }
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
  } catch (error) {
    console.error('更新退货订单状态失败:', error);
    return NextResponse.json(
      { success: false, error: '更新退货订单状态失败' },
      { status: 500 }
    );
  }
}
