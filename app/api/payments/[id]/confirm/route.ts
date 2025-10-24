import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPayment } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { publishFinanceEvent } from '@/lib/events';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';

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
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
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
              roundingAdjustment: true, // ✅ 新增: 获取订单抹零金额
              status: true,
            },
          });

          if (salesOrder) {
            // ✅ 修复: 使用实际到账金额(actualPaymentAmount)统计已收款
            const confirmedSum = await tx.paymentRecord.aggregate({
              where: {
                salesOrderId: updatedPayment.salesOrderId,
                status: { in: ['confirmed', 'applied'] },
              },
              _sum: { actualPaymentAmount: true }, // ✅ 改用实际到账金额
            });

            const totalConfirmed = confirmedSum._sum.actualPaymentAmount ?? 0;

            // ✅ 修复: 实际应收金额 = totalAmount + roundingAdjustment
            const actualTotalAmount =
              Number(salesOrder.totalAmount ?? 0) +
              Number(salesOrder.roundingAdjustment || 0);

            // ✅ 修复: 使用实际到账金额与实际应收金额比较
            if (salesOrder.status === 'shipped' && totalConfirmed >= actualTotalAmount) {
              await tx.salesOrder.update({
                where: { id: salesOrder.id },
                data: { status: 'completed' },
              });
            }
          }
        }

        return updatedPayment;
      });

      await clearCacheAfterPayment();

      // ✅ 修复: 只有订单已发货时才记录往来账单的收款
      // 预收款不记录(预收款在冲抵时才影响往来账)
      // 未发货订单的收款也不记录(因为还没有应收款记录)
      if (
        updated.customerId &&
        updated.paymentType === 'order_payment' &&
        Number(updated.actualPaymentAmount) > 0 &&
        updated.status === 'confirmed' &&
        updated.salesOrder?.status &&
        ['shipped', 'completed'].includes(updated.salesOrder.status) // ✅ 关键修复: 只有已发货订单才记录收款
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
            occurredAt: updated.paymentDate ?? new Date(),
            metadata: {
              paymentMethod: updated.paymentMethod,
              paymentType: updated.paymentType,
              salesOrderId: updated.salesOrderId ?? undefined,
              paymentAmount: updated.paymentAmount,
              actualPaymentAmount: updated.actualPaymentAmount,
              roundingAmount: updated.roundingAmount,
              triggeredBy: 'payment:confirm',
            },
          });
        } catch (error) {
          logger.error('payments', '确认收款后同步往来账失败', error, {
            paymentId: updated.id,
            paymentNumber: updated.paymentNumber,
          });
        }
      }

      await publishFinanceEvent({
        action: 'confirmed',
        recordType: 'payment',
        recordId: updated.id,
        recordNumber: updated.paymentNumber,
        amount: updated.paymentAmount,
        customerId: updated.customerId,
        customerName: updated.customer?.name,
        userId: updated.userId,
      });

      return NextResponse.json({
        success: true,
        data: updated,
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
  }
);
