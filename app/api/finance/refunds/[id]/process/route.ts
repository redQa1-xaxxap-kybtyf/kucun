import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthUser } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import {
  processRefundWithLock,
  validateRefundProcessable,
} from '@/lib/utils/idempotency-refund';
import { toNumber } from '@/lib/utils/number';
import { processRefundSchema } from '@/lib/validations/refund';

export const POST = withAuth(
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
      user: AuthUser;
    }
  ) => {
    const { user, params } = context;
    let refundId: string | undefined;
    try {
      const body = await request.json();
      const validatedData = processRefundSchema.parse(body);

      const resolvedParams = params ? await Promise.resolve(params) : {};
      refundId = resolvedParams.id;
      if (!refundId) {
        return NextResponse.json(
          { success: false, error: '缺少退款记录ID' },
          { status: 400 }
        );
      }

      // 先验证退款是否可以处理
      const targetRefundId = refundId as string;

      const validation = await validateRefundProcessable(targetRefundId);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.reason || '退款无法处理',
          },
          { status: 400 }
        );
      }

      // 使用幂等性锁处理退款
      const result = await prisma.$transaction(async tx => {
        const processResult = await processRefundWithLock(
          targetRefundId,
          validatedData.processedAmount,
          validatedData.status,
          user.id,
          tx,
          { closeRemaining: validatedData.closeRemaining }
        );

        if (!processResult.success) {
          throw new Error(processResult.message || '退款处理失败');
        }

        // 更新处理日期和备注
        const updatedRefund = await tx.refundRecord.update({
          where: { id: targetRefundId },
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

        // ✅ 退款完成后同步往来账（避免总账/明细缺少退款流水）
        if (updatedRefund.status === 'completed' && updatedRefund.customerId) {
          const processedAmount = toNumber(updatedRefund.processedAmount, 0);
          const fallbackAmount = toNumber(updatedRefund.refundAmount, 0);
          const effectiveAmount =
            processedAmount > 0 ? processedAmount : fallbackAmount;

          if (effectiveAmount > 0) {
            await recordPartnerTransaction(
              {
                partnerId: updatedRefund.customerId,
                partnerName: updatedRefund.salesOrder?.customer?.name ?? undefined,
                partnerRole: 'customer',
                entityType: 'customer',
                transactionType: 'refund',
                amount: effectiveAmount,
                referenceId: updatedRefund.id,
                referenceNumber: updatedRefund.refundNumber,
                description: `退款 ${updatedRefund.refundNumber} 入账`,
                userId: user.id,
                occurredAt: updatedRefund.processedDate ?? updatedRefund.refundDate,
                metadata: {
                  source: 'refund_record',
                  salesOrderId: updatedRefund.salesOrderId,
                  returnOrderId: updatedRefund.returnOrderId ?? undefined,
                  refundMethod: updatedRefund.refundMethod,
                  refundType: updatedRefund.refundType,
                  status: updatedRefund.status,
                  triggeredBy: 'refund:process',
                },
              },
              tx
            );
          }
        }

        return updatedRefund;
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `退款${validatedData.status === 'completed' ? '批准' : '拒绝'}成功`,
      });
    } catch (error) {
      logger.error(
        'finance-refunds',
        '处理退款失败',
        error,
        refundId ? { refundId } : undefined
      );
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '处理退款失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:refund:process'] }
);
