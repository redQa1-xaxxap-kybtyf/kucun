import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { updateRefundRecordSchema } from '@/lib/validations/refund';

// GET /api/finance/refunds/[id] - 获取单个退款记录详情
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: {  id: string  } }
) => {
  try {
const refund = await prisma.refundRecord.findUnique({
      where: { id: params.id },
      include: {
        salesOrder: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!refund) {
      return NextResponse.json({ error: '退款记录不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: refund,
    });
  } catch (error) {
    console.error('获取退款记录失败:', error);
    return NextResponse.json({ error: '获取退款记录失败' }, { status: 500 });
  }
}

// PUT /api/finance/refunds/[id] - 更新退款记录
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const body = await request.json();
    const validatedData = updateRefundRecordSchema.parse(body);

    // 修复：在更新时重新计算金额字段，并转换日期类型
    const updateData: {
      refundMethod?: string;
      refundAmount?: number;
      processedAmount?: number;
      refundDate?: Date;
      processedDate?: Date;
      status?: string;
      remarks?: string;
      receiptNumber?: string;
      bankInfo?: string;
      updatedAt: Date;
      remainingAmount?: number;
    } = {
      ...validatedData,
      refundDate: validatedData.refundDate ? new Date(validatedData.refundDate) : undefined,
      processedDate: validatedData.processedDate ? new Date(validatedData.processedDate) : undefined,
      updatedAt: new Date(),
    };

    // 如果更新了processedAmount，需要重新计算remainingAmount
    if (validatedData.processedAmount !== undefined) {
      // 获取当前退款记录以获取refundAmount
      const currentRefund = await prisma.refundRecord.findUnique({
        where: { id: params.id },
        select: { refundAmount: true },
      });

      if (currentRefund) {
        updateData.remainingAmount = Math.max(
          0,
          (validatedData.refundAmount || currentRefund.refundAmount) -
            validatedData.processedAmount
        );
      }
    } else if (validatedData.refundAmount !== undefined) {
      // 如果更新了refundAmount但没有更新processedAmount，获取当前processedAmount
      const currentRefund = await prisma.refundRecord.findUnique({
        where: { id: params.id },
        select: { processedAmount: true },
      });

      if (currentRefund) {
        updateData.remainingAmount = Math.max(
          0,
          validatedData.refundAmount - (currentRefund.processedAmount || 0)
        );
      }
    }

    const refund = await prisma.refundRecord.update({
      where: { id: params.id },
      data: updateData,
      include: {
        salesOrder: {
          include: {
            customer: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: refund,
      message: '退款记录更新成功',
    });
  } catch (error) {
    console.error('更新退款记录失败:', error);
    return NextResponse.json({ error: '更新退款记录失败' }, { status: 500 });
  }
}

// DELETE /api/finance/refunds/[id] - 删除退款记录
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params: {  id: string  } }
) => {
  try {
// 检查退款记录是否存在且可以删除
    const refund = await prisma.refundRecord.findUnique({
      where: { id: params.id },
    });

    if (!refund) {
      return NextResponse.json({ error: '退款记录不存在' }, { status: 404 });
    }

    if (refund.status === 'completed') {
      return NextResponse.json(
        { error: '已完成的退款记录不能删除' },
        { status: 400 }
      );
    }

    await prisma.refundRecord.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: '退款记录删除成功',
    });
  } catch (error) {
    console.error('删除退款记录失败:', error);
    return NextResponse.json({ error: '删除退款记录失败' }, { status: 500 });
  }
});
