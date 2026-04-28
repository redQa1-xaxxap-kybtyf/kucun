import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPayment } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { publishFinanceEvent } from '@/lib/events';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import {
  buildExcludeAutoReceivableConfirmationWhere,
  isAutoReceivableConfirmationPayment,
} from '@/lib/services/receivables-helpers';
import { getSalesOrderReceivableTotal } from '@/lib/utils/sample-order';

const serializeError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { value: String(error) };

function appendRemark(existing: string | null, note?: string): string | null {
  if (!note?.trim()) {
    return existing;
  }
  const trimmed = note.trim();
  const prefix = '【确认备注】';
  if (!existing) {
    return `${prefix}${trimmed}`;
  }
  if (existing.includes(prefix) && existing.endsWith(trimmed)) {
    return existing;
  }
  return `${existing}\n${prefix}${trimmed}`;
}

export const POST = withAuth(
  async (request: NextRequest, { user, params }) => {
    let paymentId: string | undefined;
    try {
      const { id } = await resolveParams(params);
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
          { success: false, error: '系统应收建账记录不能手工确认收款' },
          { status: 400 }
        );
      }

      if (payment.status === 'cancelled') {
        return NextResponse.json(
          { success: false, error: '已取消的收款记录无法确认' },
          { status: 400 }
        );
      }

      if (payment.status === 'confirmed' || payment.status === 'applied') {
        return NextResponse.json(
          { success: false, error: '收款记录已确认' },
          { status: 400 }
        );
      }

      const updated = await prisma.$transaction(async tx => {
        const updatedPayment = await tx.paymentRecord.update({
          where: { id },
          data: {
            status: 'confirmed',
            remarks: appendRemark(payment.remarks, notes),
          },
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

        if (updatedPayment.salesOrderId) {
          const salesOrder = await tx.salesOrder.findUnique({
            where: { id: updatedPayment.salesOrderId },
            select: {
              id: true,
              totalAmount: true,
              roundingAdjustment: true,
              isSampleOrder: true,
              sampleSettlementType: true,
              status: true,
              prepaymentUsages: {
                select: {
                  appliedAmount: true,
                },
              },
            },
          });

          if (salesOrder) {
            // 按统一口径统计已核销金额：paymentAmount 已经等于 实收 + 抹零
            const confirmedSum = await tx.paymentRecord.aggregate({
              where: {
                salesOrderId: updatedPayment.salesOrderId,
                status: { in: ['confirmed', 'applied'] },
                ...buildExcludeAutoReceivableConfirmationWhere(),
              },
              _sum: { paymentAmount: true },
            });

            const totalPaid = Number(confirmedSum._sum.paymentAmount ?? 0);
            const prepaymentApplied = salesOrder.prepaymentUsages.reduce(
              (sum, usage) => sum + Number(usage.appliedAmount ?? 0),
              0
            );

            const orderDue = getSalesOrderReceivableTotal({
              isSampleOrder: salesOrder.isSampleOrder,
              sampleSettlementType: salesOrder.sampleSettlementType,
              totalAmount: salesOrder.totalAmount,
              roundingAdjustment: salesOrder.roundingAdjustment,
            });
            const totalSettled = totalPaid + prepaymentApplied;

            await tx.salesOrder.update({
              where: { id: salesOrder.id },
              data: {
                paidAmount: Math.min(orderDue, totalSettled),
                ...(salesOrder.status === 'shipped' && totalSettled >= orderDue
                  ? { status: 'completed' }
                  : {}),
              },
            });
          }
        }

        return updatedPayment;
      });

      await clearCacheAfterPayment();

      if (
        updated.customerId &&
        Number(updated.actualPaymentAmount) > 0 &&
        updated.status === 'confirmed'
      ) {
        try {
          await recordPartnerTransaction({
            partnerId: updated.customerId,
            partnerRole: 'customer',
            entityType: 'customer',
            transactionType: 'payment_in',
            amount: Number(updated.actualPaymentAmount),
            referenceId: updated.id,
            referenceNumber: updated.paymentNumber,
            description: `收款 ${updated.paymentNumber} 确认到账`,
            userId: user.id,
            occurredAt: updated.paymentDate ?? new Date(),
            metadata: {
              paymentMethod: updated.paymentMethod,
              paymentType: updated.paymentType,
              salesOrderId: updated.salesOrderId ?? undefined,
              paymentAmount: Number(updated.paymentAmount),
              actualPaymentAmount: Number(updated.actualPaymentAmount),
              roundingAmount: Number(updated.roundingAmount),
              triggeredBy: 'payment:confirm',
            },
          });
        } catch (error) {
          logger.warn(
            'payments',
            '确认收款后同步往来账失败',
            {
              paymentId: updated.id,
              paymentNumber: updated.paymentNumber,
            },
            { error: serializeError(error) }
          );
        }
      }

      await publishFinanceEvent({
        action: 'confirmed',
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
        message: '收款记录已确认',
      });
    } catch (error) {
      logger.error(
        'payments',
        '确认收款记录失败',
        error,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '确认收款记录失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);
