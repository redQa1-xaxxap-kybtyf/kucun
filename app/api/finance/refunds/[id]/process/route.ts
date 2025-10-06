import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import {
  processRefundWithLock,
  validateRefundProcessable,
} from '@/lib/utils/idempotency-refund';
import { processRefundSchema } from '@/lib/validations/refund';

export const POST = withAuth(
  async (
    request: NextRequest,
    { params }: { params: { id: string } },
    { user }: { user: { id: string; email: string; name: string } }
  ) => {
    try {
      const body = await request.json();
      const validatedData = processRefundSchema.parse(body);

      const refundId = params.id;

      // 先验证退款是否可以处理
      const validation = await validateRefundProcessable(refundId);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: validation.reason || '退款无法处理',
          },
          { status: 400 }
        );
      }

      // 使用幂等性锁处理退款
      const result = await prisma.$transaction(async tx => {
        const processResult = await processRefundWithLock(
          refundId,
          validatedData.processedAmount,
          validatedData.status,
          user.id,
          tx
        );

        if (!processResult.success) {
          throw new Error(processResult.message || '退款处理失败');
        }

        // 更新处理日期和备注
        const updatedRefund = await tx.refundRecord.update({
          where: { id: refundId },
          data: {
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
  },
  { permissions: ['finance:refund:process'] }
);
