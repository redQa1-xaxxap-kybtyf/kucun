import { type NextRequest, NextResponse } from 'next/server';

import { errorResponse, requireAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
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
    logger.error('refunds', '获取退款详情失败', error);
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

    const closeRemainingRequested =
      validatedData.closeRemaining === true &&
      validatedData.status === 'completed';

    const canProcess =
      refund.status === 'pending' ||
      refund.status === 'processing' ||
      (refund.status === 'completed' &&
        refund.remainingAmount > 0 &&
        closeRemainingRequested);

    if (!canProcess) {
      return errorResponse('当前退款状态不支持该操作', 400);
    }

    if (
      validatedData.processedAmount - refund.remainingAmount >
      0.00001
    ) {
      return errorResponse('处理金额不能超过待处理金额', 400);
    }

    const processedAmountDelta = validatedData.processedAmount;
    const newProcessedAmount = Number(
      (refund.processedAmount + processedAmountDelta).toFixed(2)
    );

    if (
      !closeRemainingRequested &&
      newProcessedAmount - refund.refundAmount > 0.00001
    ) {
      return errorResponse('处理金额不能超过应退金额', 400);
    }

    let calculatedRemaining = Number(
      (refund.refundAmount - newProcessedAmount).toFixed(2)
    );

    if (calculatedRemaining < -0.01) {
      return errorResponse('处理金额不能超过待处理金额', 400);
    }

    if (Math.abs(calculatedRemaining) < 0.01) {
      calculatedRemaining = 0;
    }

    let finalProcessedAmount = newProcessedAmount;
    let finalRemainingAmount = calculatedRemaining;
    let finalRefundAmount = Number(refund.refundAmount.toFixed(2));
    const finalStatus = validatedData.status;

    const providedRemarks = validatedData.remarks?.trim() ?? '';
    let mergedRemarks =
      providedRemarks.length > 0
        ? providedRemarks
        : refund.remarks?.trim() ?? '';

    let writeOffAmount = 0;

    if (validatedData.status === 'completed') {
      if (finalRemainingAmount > 0) {
        if (!closeRemainingRequested) {
          return errorResponse(
            '还有剩余金额未处理，如需结清请勾选“抹平剩余金额”并提交。',
            400
          );
        }
        writeOffAmount = finalRemainingAmount;
        finalRemainingAmount = 0;
        finalRefundAmount = Number(finalProcessedAmount.toFixed(2));
      } else if (closeRemainingRequested && refund.remainingAmount > 0) {
        writeOffAmount = Number(refund.remainingAmount.toFixed(2));
        finalRefundAmount = Number(finalProcessedAmount.toFixed(2));
      }
    }

    if (writeOffAmount > 0) {
      const note = `系统自动核销剩余金额 ¥${writeOffAmount.toFixed(2)}`;
      if (!mergedRemarks.includes(note)) {
        mergedRemarks = mergedRemarks
          ? `${mergedRemarks}\n${note}`
          : note;
      }
    }

    const finalRemarks = mergedRemarks || null;

    const updatedRefund = await prisma.$transaction(async tx => {
      const updatedRecord = await tx.refundRecord.update({
        where: { id },
        data: {
          processedAmount: finalProcessedAmount,
          remainingAmount: finalRemainingAmount,
          refundAmount: finalRefundAmount,
          processedDate: new Date(validatedData.processedDate),
          status: finalStatus,
          remarks: finalRemarks,
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

      if (
        refund.returnOrderId &&
        validatedData.status === 'completed' &&
        closeRemainingRequested &&
        writeOffAmount > 0
      ) {
        await tx.returnOrder.update({
          where: { id: refund.returnOrderId },
          data: {
            refundAmount: finalRefundAmount,
          },
        });
      }

      return updatedRecord;
    });

    return NextResponse.json({ success: true, data: updatedRefund });
  } catch (error) {
    logger.error('refunds', '处理退款失败', error);
    if (error instanceof Error && 'issues' in error) {
      return errorResponse('数据验证失败', 400);
    }
    return errorResponse('处理退款失败', 500);
  }
}
