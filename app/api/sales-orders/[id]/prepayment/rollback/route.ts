import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPayment } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { recalculateSalesOrderPaidAmount } from '@/lib/services/sales-order-settlement';
import { toNumber } from '@/lib/utils/number';

const ROLLBACK_ALLOWED_ORDER_STATUSES = new Set(['draft', 'confirmed']);

class RollbackError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'RollbackError';
  }
}

function resolvePrepaymentStatus(
  paymentAmount: number,
  appliedAmount: number
): 'confirmed' | 'applied' {
  return appliedAmount >= paymentAmount - 0.0001 ? 'applied' : 'confirmed';
}

function appendRollbackRemark(
  existing: string | null,
  amount: number,
  note?: string
): string {
  const content = note?.trim() || `回滚预收款抵扣 ${amount.toFixed(2)}`;
  const prefix = '【预收回滚】';
  if (!existing) {
    return `${prefix}${content}`;
  }
  if (existing.includes(prefix) && existing.endsWith(content)) {
    return existing;
  }
  return `${existing}\n${prefix}${content}`;
}

export const POST = withAuth(
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
      user?: { id: string };
    }
  ) => {
    let orderId: string | undefined;
    try {
      const { id } = await resolveParams(context.params);
      orderId = id;

      const body = request.bodyUsed
        ? undefined
        : await request.json().catch(() => undefined);
      const notes =
        typeof body === 'object' && body && typeof body.notes === 'string'
          ? body.notes
          : undefined;

      const result = await prisma.$transaction(async tx => {
        const order = await tx.salesOrder.findUnique({
          where: { id },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            remarks: true,
            prepaymentAmount: true,
            prepaymentUsages: {
              select: {
                id: true,
                paymentRecordId: true,
                appliedAmount: true,
                paymentRecord: {
                  select: {
                    id: true,
                    paymentType: true,
                    paymentAmount: true,
                    appliedAmount: true,
                  },
                },
              },
            },
          },
        });

        if (!order) {
          throw new RollbackError('销售订单不存在', 404);
        }

        if (!ROLLBACK_ALLOWED_ORDER_STATUSES.has(order.status)) {
          throw new RollbackError(
            '只有草稿或已确认且未发货的订单才能回滚预收款抵扣'
          );
        }

        const recordedPrepaymentAmount = toNumber(order.prepaymentAmount, 0);
        if (
          order.prepaymentUsages.length === 0 &&
          recordedPrepaymentAmount <= 0.0001
        ) {
          throw new RollbackError('订单没有可回滚的预收款抵扣');
        }

        const rollbackByPayment = new Map<
          string,
          {
            paymentAmount: number;
            currentAppliedAmount: number;
            rollbackAmount: number;
          }
        >();

        let rolledBackAmount = 0;
        for (const usage of order.prepaymentUsages) {
          const appliedAmount = toNumber(usage.appliedAmount, 0);
          if (appliedAmount <= 0) {
            continue;
          }

          if (usage.paymentRecord.paymentType !== 'prepayment') {
            throw new RollbackError(
              `抵扣记录 ${usage.id} 关联的收款不是预收款，不能自动回滚`
            );
          }

          const existing = rollbackByPayment.get(usage.paymentRecordId);
          if (existing) {
            existing.rollbackAmount += appliedAmount;
          } else {
            rollbackByPayment.set(usage.paymentRecordId, {
              paymentAmount: toNumber(usage.paymentRecord.paymentAmount, 0),
              currentAppliedAmount: toNumber(
                usage.paymentRecord.appliedAmount,
                0
              ),
              rollbackAmount: appliedAmount,
            });
          }

          rolledBackAmount += appliedAmount;
        }

        for (const [paymentRecordId, rollback] of rollbackByPayment) {
          const nextAppliedAmount = Math.max(
            0,
            rollback.currentAppliedAmount - rollback.rollbackAmount
          );

          await tx.paymentRecord.update({
            where: { id: paymentRecordId },
            data: {
              appliedAmount: nextAppliedAmount,
              status: resolvePrepaymentStatus(
                rollback.paymentAmount,
                nextAppliedAmount
              ),
            },
          });
        }

        if (order.prepaymentUsages.length > 0) {
          await tx.prepaymentUsage.deleteMany({
            where: { salesOrderId: id },
          });
        }

        await tx.salesOrder.update({
          where: { id },
          data: {
            usePrepayment: false,
            prepaymentAmount: 0,
            remarks: appendRollbackRemark(
              order.remarks,
              rolledBackAmount || recordedPrepaymentAmount,
              notes
            ),
          },
        });

        const recalculated = await recalculateSalesOrderPaidAmount(tx, id);

        return {
          orderId: id,
          orderNumber: order.orderNumber,
          usageCount: order.prepaymentUsages.length,
          rolledBackAmount,
          paidAmount: recalculated?.paidAmount ?? 0,
          operatorId: context.user?.id,
        };
      });

      await clearCacheAfterPayment();

      return NextResponse.json({
        success: true,
        data: result,
        message:
          result.rolledBackAmount > 0
            ? '预收款抵扣已回滚'
            : '预收款抵扣标记已清理',
      });
    } catch (error) {
      if (error instanceof RollbackError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }

      logger.error(
        'sales-orders',
        '回滚预收款抵扣失败',
        error,
        orderId ? { orderId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '回滚预收款抵扣失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);
