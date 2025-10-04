import { NextResponse, type NextRequest } from 'next/server';

import { verifyApiAuth, errorResponse } from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import { processRefundSchema } from '@/lib/validations/refund';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyApiAuth(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    const body = await request.json();
    const validatedData = processRefundSchema.parse(body);

    const refundId = params.id;

    // 使用事务处理退款
    const result = await prisma.$transaction(async tx => {
      // 获取退款记录
      const refund = await tx.refundRecord.findUnique({
        where: { id: refundId },
        include: {
          salesOrder: true,
        },
      });

      if (!refund) {
        throw new Error('退款记录不存在');
      }

      if (refund.status !== 'pending' && refund.status !== 'processing') {
        throw new Error('只能处理待处理或处理中的退款申请');
      }

      // 验证处理金额
      const maxProcessAmount = refund.refundAmount - refund.processedAmount;
      if (validatedData.processedAmount > maxProcessAmount) {
        throw new Error(`处理金额不能超过剩余金额 ¥${maxProcessAmount}`);
      }

      // 计算新的已处理金额和剩余金额
      const newProcessedAmount =
        refund.processedAmount + validatedData.processedAmount;
      const newRemainingAmount = refund.refundAmount - newProcessedAmount;

      // 确定新状态
      let newStatus: string;
      if (validatedData.status === 'completed') {
        if (newRemainingAmount <= 0) {
          newStatus = 'completed';
        } else {
          newStatus = 'processing';
        }
      } else {
        newStatus = 'rejected';
      }

      // 更新退款记录
      const updatedRefund = await tx.refundRecord.update({
        where: { id: refundId },
        data: {
          status: newStatus,
          processedAmount: newProcessedAmount,
          remainingAmount: newRemainingAmount,
          processedDate: new Date(validatedData.processedDate),
          remarks: validatedData.remarks,
        },
        include: {
          salesOrder: {
            include: {
              customer: true,
            },
          },
        },
      });

      return updatedRefund;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `退款${validatedData.status === 'completed' ? '批准' : '拒绝'}成功`,
    });
  } catch (error) {
    console.error('处理退款失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '处理退款失败',
      },
      { status: 500 }
    );
  }
}
