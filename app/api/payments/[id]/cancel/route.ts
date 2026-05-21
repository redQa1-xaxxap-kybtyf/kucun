import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPayment } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { publishFinanceEvent } from '@/lib/events';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { isAutoReceivableConfirmationPayment } from '@/lib/services/receivables-helpers';
import { recalculateSalesOrderPaidAmount } from '@/lib/services/sales-order-settlement';

const REVERSIBLE_ORDER_STATUSES = new Set(['draft', 'confirmed']);
const REVERSIBLE_PAYMENT_STATUSES = new Set(['confirmed', 'applied']);

function appendOperationRemark(
  existing: string | null,
  note: string | undefined,
  prefix: string
): string | null {
  if (!note?.trim()) {
    return existing;
  }
  const trimmed = note.trim();
  if (!existing) {
    return `${prefix}${trimmed}`;
  }
  if (existing.includes(prefix) && existing.endsWith(trimmed)) {
    return existing;
  }
  return `${existing}\n${prefix}${trimmed}`;
}

function appendCancelRemark(
  existing: string | null,
  note?: string
): string | null {
  return appendOperationRemark(existing, note, '【取消备注】');
}

function appendReversalRemark(
  existing: string | null,
  note?: string
): string | null {
  return appendOperationRemark(existing, note, '【冲销备注】');
}

function getSettledPaymentBlockReason(payment: {
  paymentType: string;
  salesOrderId?: string | null;
  appliedAmount?: unknown;
  salesOrder?: { status: string } | null;
  prepaymentUsages?: Array<{ id: string }>;
}): string | null {
  if (payment.paymentType === 'order_payment') {
    if (!payment.salesOrderId || !payment.salesOrder) {
      return '这笔收款未关联销售订单，暂不支持直接冲销';
    }

    if (!REVERSIBLE_ORDER_STATUSES.has(payment.salesOrder.status)) {
      return '订单已发货、完成或取消，不能直接冲销收款，请走退款/退货流程';
    }

    return null;
  }

  if (payment.paymentType === 'prepayment') {
    const usageCount = payment.prepaymentUsages?.length ?? 0;
    const appliedAmount = Number(payment.appliedAmount ?? 0);
    if (usageCount > 0 || appliedAmount > 0.0001) {
      return '这笔预收款已被订单抵扣，请先回滚预收款抵扣';
    }

    return null;
  }

  return '当前收款类型暂不支持冲销';
}

export const POST = withAuth(
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
      user?: { id: string };
    }
  ) => {
    let paymentId: string | undefined;
    try {
      const { id } = await resolveParams(context.params);
      paymentId = id;

      const body = request.bodyUsed
        ? undefined
        : await request.json().catch(() => undefined);
      const notes =
        typeof body === 'object' && body && typeof body.notes === 'string'
          ? body.notes
          : undefined;

      const payment = await prisma.paymentRecord.findUnique({
        where: { id },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
            },
          },
          prepaymentUsages: {
            select: { id: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      });

      if (!payment) {
        return NextResponse.json(
          { success: false, error: '收款记录不存在' },
          { status: 404 }
        );
      }

      if (isAutoReceivableConfirmationPayment(payment)) {
        return NextResponse.json(
          { success: false, error: '系统应收建账记录不能手工取消' },
          { status: 400 }
        );
      }

      if (payment.status === 'cancelled') {
        return NextResponse.json(
          { success: false, error: '收款记录已取消' },
          { status: 400 }
        );
      }

      const isPendingCancellation = payment.status === 'pending';
      const isSettledReversal = REVERSIBLE_PAYMENT_STATUSES.has(payment.status);

      if (!isPendingCancellation && !isSettledReversal) {
        return NextResponse.json(
          { success: false, error: '当前状态的收款记录无法取消' },
          { status: 400 }
        );
      }

      if (isSettledReversal) {
        const blockReason = getSettledPaymentBlockReason(payment);
        if (blockReason) {
          return NextResponse.json(
            { success: false, error: blockReason },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.$transaction(async tx => {
        const updateResult = await tx.paymentRecord.updateMany({
          where: { id, status: payment.status },
          data: {
            status: 'cancelled',
            remarks: isSettledReversal
              ? appendReversalRemark(payment.remarks, notes)
              : appendCancelRemark(payment.remarks, notes),
          },
        });

        if (updateResult.count === 0) {
          throw new Error('收款记录状态已变更，请刷新后重试');
        }

        const updatedPayment = await tx.paymentRecord.findUnique({
          where: { id },
          include: {
            customer: {
              select: { id: true, name: true, phone: true },
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
              select: { id: true, name: true },
            },
          },
        });

        if (!updatedPayment) {
          throw new Error('收款记录不存在');
        }

        if (isSettledReversal && payment.salesOrderId) {
          await recalculateSalesOrderPaidAmount(tx, payment.salesOrderId);
        }

        if (
          isSettledReversal &&
          updatedPayment.customerId &&
          Number(updatedPayment.actualPaymentAmount) > 0
        ) {
          await recordPartnerTransaction(
            {
              partnerId: updatedPayment.customerId,
              partnerRole: 'customer',
              entityType: 'customer',
              transactionType: 'payment_in_reversal',
              amount: Number(updatedPayment.actualPaymentAmount),
              referenceId: updatedPayment.id,
              referenceNumber: updatedPayment.paymentNumber,
              description: `收款 ${updatedPayment.paymentNumber} 冲销`,
              userId: context.user?.id ?? updatedPayment.userId,
              occurredAt: new Date(),
              metadata: {
                originalPaymentStatus: payment.status,
                paymentType: updatedPayment.paymentType,
                salesOrderId: updatedPayment.salesOrderId ?? undefined,
                paymentAmount: Number(updatedPayment.paymentAmount),
                actualPaymentAmount: Number(
                  updatedPayment.actualPaymentAmount
                ),
                roundingAmount: Number(updatedPayment.roundingAmount),
                triggeredBy: 'payment:cancel',
              },
            },
            tx
          );
        }

        return updatedPayment;
      });

      await clearCacheAfterPayment();

      await publishFinanceEvent({
        action: 'cancelled',
        recordType: 'payment',
        recordId: updated.id,
        recordNumber: updated.paymentNumber,
        amount: Number(updated.paymentAmount),
        customerId: updated.customerId,
        customerName: updated.customer?.name,
        userId: updated.userId,
      });

      const serializedPayment = {
        ...updated,
        paymentAmount: Number(updated.paymentAmount),
        actualPaymentAmount: Number(updated.actualPaymentAmount),
        roundingAmount: Number(updated.roundingAmount),
        appliedAmount: Number(updated.appliedAmount),
      };

      return NextResponse.json({
        success: true,
        data: serializedPayment,
        message: isSettledReversal ? '收款记录已冲销' : '收款记录已取消',
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === '收款记录状态已变更，请刷新后重试'
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 409 }
        );
      }
      logger.error(
        'payments',
        '取消收款记录失败',
        error,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '取消收款记录失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);
