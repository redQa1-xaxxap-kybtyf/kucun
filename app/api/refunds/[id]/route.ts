import { type NextRequest, NextResponse } from 'next/server';

import { errorResponse, requireAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { processRefundSchema } from '@/lib/validations/refund';

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
    console.error('获取退款详情失败:', error);
    return errorResponse('获取退款详情失败', 500);
  }
}

// PATCH /api/refunds/[id] - 处理退款
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request);

    const { id } = await context.params;
    const body = await request.json();

    // 验证输入数据
    const validatedData = processRefundSchema.parse(body);

    // 获取退款记录
    const refund = await prisma.refundRecord.findUnique({
      where: { id },
    });

    if (!refund) {
      return errorResponse('退款记录不存在', 404);
    }

    // 检查状态
    if (refund.status !== 'pending') {
      return errorResponse('只能处理待处理状态的退款', 400);
    }

    // 验证处理金额
    if (validatedData.processedAmount > refund.remainingAmount) {
      return errorResponse('处理金额不能超过待处理金额', 400);
    }

    // 计算新的已处理金额和剩余金额
    const newProcessedAmount =
      refund.processedAmount + validatedData.processedAmount;
    const newRemainingAmount = refund.refundAmount - newProcessedAmount;

    // 更新退款记录
    const updatedRefund = await prisma.refundRecord.update({
      where: { id },
      data: {
        processedAmount: newProcessedAmount,
        remainingAmount: newRemainingAmount,
        processedDate: new Date(validatedData.processedDate),
        status: validatedData.status,
        remarks: validatedData.remarks || refund.remarks,
        updatedAt: new Date(),
      },
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

    return NextResponse.json({ success: true, data: updatedRefund });
  } catch (error) {
    console.error('处理退款失败:', error);
    if (error instanceof Error && 'issues' in error) {
      return errorResponse('数据验证失败', 400);
    }
    return errorResponse('处理退款失败', 500);
  }
}
