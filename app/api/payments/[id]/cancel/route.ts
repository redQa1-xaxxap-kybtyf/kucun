import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPayment } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { publishFinanceEvent } from '@/lib/events';
import { logger } from '@/lib/logger';

function appendCancelRemark(
  existing: string | null,
  note?: string
): string | null {
  if (!note?.trim()) {
    return existing;
  }
  const trimmed = note.trim();
  const prefix = '【取消备注】';
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
          { success: false, error: '收款记录已取消' },
          { status: 400 }
        );
      }

      if (payment.status === 'confirmed' || payment.status === 'applied') {
        return NextResponse.json(
          { success: false, error: '已确认或已冲抵的收款记录无法取消' },
          { status: 400 }
        );
      }

      const updated = await prisma.paymentRecord.update({
        where: { id },
        data: {
          status: 'cancelled',
          remarks: appendCancelRemark(payment.remarks, notes),
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

      await clearCacheAfterPayment();

      await publishFinanceEvent({
        action: 'cancelled',
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
        message: '收款记录已取消',
      });
    } catch (error) {
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
  }
);
