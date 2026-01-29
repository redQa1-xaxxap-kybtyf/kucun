// 单个付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPaymentOut } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { syncExpensePaymentStatusFromPayable } from '@/lib/services/expense-payable-integration';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import type { PaymentOutRecordDetail } from '@/lib/types/payable';
import { toNumber } from '@/lib/utils/number';
import { updatePaymentOutRecordSchema } from '@/lib/validations/payable';

type PaymentParams = { id: string };

const paymentInclude = {
  payableRecord: {
    select: {
      id: true,
      payableNumber: true,
      payableAmount: true,
      remainingAmount: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

type PaymentOutRecordWithInclude = Prisma.PaymentOutRecordGetPayload<{
  include: typeof paymentInclude;
}>;

const PAYMENT_OUT_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
] as const satisfies ReadonlyArray<PaymentOutRecordDetail['status']>;

const PAYMENT_OUT_METHODS = [
  'cash',
  'bank_transfer',
  'alipay',
  'wechat',
  'check',
  'other',
] as const satisfies ReadonlyArray<PaymentOutRecordDetail['paymentMethod']>;

function normalizePaymentOutStatus(
  value: string
): PaymentOutRecordDetail['status'] {
  return (PAYMENT_OUT_STATUSES as readonly string[]).includes(value)
    ? (value as PaymentOutRecordDetail['status'])
    : 'pending';
}

function normalizePaymentOutMethod(
  value: string
): PaymentOutRecordDetail['paymentMethod'] {
  return (PAYMENT_OUT_METHODS as readonly string[]).includes(value)
    ? (value as PaymentOutRecordDetail['paymentMethod'])
    : 'other';
}

function serializePaymentOutRecordDetail(
  payment: PaymentOutRecordWithInclude
): PaymentOutRecordDetail {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    supplierId: payment.supplierId,
    userId: payment.userId,
    paymentMethod: normalizePaymentOutMethod(payment.paymentMethod),
    paymentAmount: toNumber(payment.paymentAmount),
    paymentDate: payment.paymentDate,
    status: normalizePaymentOutStatus(payment.status),
    ...(payment.payableRecordId !== null &&
    payment.payableRecordId !== undefined
      ? { payableRecordId: payment.payableRecordId }
      : {}),
    ...(payment.remarks !== null && payment.remarks !== undefined
      ? { remarks: payment.remarks }
      : {}),
    ...(payment.voucherNumber !== null && payment.voucherNumber !== undefined
      ? { voucherNumber: payment.voucherNumber }
      : {}),
    ...(payment.bankInfo !== null && payment.bankInfo !== undefined
      ? { bankInfo: payment.bankInfo }
      : {}),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    ...(payment.payableRecord
      ? {
          payableRecord: {
            id: payment.payableRecord.id,
            payableNumber: payment.payableRecord.payableNumber,
            payableAmount: toNumber(payment.payableRecord.payableAmount),
            remainingAmount: toNumber(payment.payableRecord.remainingAmount),
          },
        }
      : {}),
    supplier: {
      id: payment.supplier.id,
      name: payment.supplier.name,
      ...(payment.supplier.phone !== null &&
      payment.supplier.phone !== undefined
        ? { phone: payment.supplier.phone }
        : {}),
      ...(payment.supplier.address !== null &&
      payment.supplier.address !== undefined
        ? { address: payment.supplier.address }
        : {}),
    },
    user: {
      id: payment.user.id,
      name: payment.user.name,
      email: payment.user.email ?? '',
    },
  };
}

/**
 * GET /api/finance/payments-out/[id] - 获取单个付款记录详情
 */
const getPaymentHandler = withAuth(
  async (request: NextRequest, context) => {
    let paymentId: string | undefined;
    try {
      const { id } = await resolveParams<PaymentParams>(
        context.params as Promise<PaymentParams> | PaymentParams | undefined
      );
      paymentId = id;

      const payment = await prisma.paymentOutRecord.findUnique({
        where: { id },
        include: paymentInclude,
      });

      if (!payment) {
        return NextResponse.json(
          { success: false, error: '付款记录不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: serializePaymentOutRecordDetail(payment),
      });
    } catch (error) {
      logger.error(
        'finance-payments-out',
        '获取付款记录详情失败',
        error,
        undefined,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '获取付款记录详情失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getPaymentHandler);

/**
 * PUT /api/finance/payments-out/[id] - 更新付款记录
 */
const putPaymentHandler = withAuth(
  async (request: NextRequest, context) => {
    let paymentId: string | undefined;
    try {
      const { id } = await resolveParams<PaymentParams>(
        context.params as Promise<PaymentParams> | PaymentParams | undefined
      );
      paymentId = id;
      const { user } = context;

      const body = await request.json();
      const validationResult = updatePaymentOutRecordSchema.safeParse({
        ...body,
        id,
      });

      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: '数据验证失败',
            details: validationResult.error.issues,
          },
          { status: 400 }
        );
      }

      const updateData = { ...validationResult.data };
      delete (updateData as { id?: string }).id;

      const existingPayment = await prisma.paymentOutRecord.findUnique({
        where: { id },
        select: {
          id: true,
          paymentAmount: true,
          status: true,
          payableRecordId: true,
          supplierId: true,
          paymentNumber: true,
          voidedAt: true,
          paymentDate: true,
        },
      });

      if (!existingPayment) {
        return NextResponse.json(
          { success: false, error: '付款记录不存在' },
          { status: 404 }
        );
      }

      if (existingPayment.voidedAt) {
        return NextResponse.json(
          { success: false, error: '已作废的付款记录不能修改' },
          { status: 400 }
        );
      }

      const existingPaymentAmount = toNumber(existingPayment.paymentAmount);

      const updatedPayment = await prisma.$transaction(async tx => {
        // ✅ 修复：如果更新了付款金额，需要先校验
        if (updateData.paymentAmount !== undefined) {
          // 如果关联应付款记录，校验金额范围
          if (existingPayment.payableRecordId) {
            const payableRecord = await tx.payableRecord.findUnique({
              where: { id: existingPayment.payableRecordId },
              select: {
                id: true,
                payableAmount: true,
                paidAmount: true,
              },
            });

            if (payableRecord) {
              const updatedPaymentAmount = toNumber(updateData.paymentAmount);
              const payablePaidAmount = toNumber(payableRecord.paidAmount);
              const payableAmount = toNumber(payableRecord.payableAmount);

              // 计算新的已付金额
              const newPaidAmount =
                payablePaidAmount -
                existingPaymentAmount +
                updatedPaymentAmount;

              // ✅ 校验：付款金额不能为负数
              if (newPaidAmount < 0) {
                throw new Error('付款金额不能为负数');
              }

              // ✅ 校验：付款金额不能超过应付金额
              if (newPaidAmount > payableAmount) {
                throw new Error(`付款金额不能超过应付金额 ${payableAmount}`);
              }
            }
          }
        }

        // 更新付款记录
        const payment = await tx.paymentOutRecord.update({
          where: { id },
          data: updateData,
          include: paymentInclude,
        });

        const currentPaymentAmount = toNumber(payment.paymentAmount);
        const paymentAmountDelta =
          Math.round((currentPaymentAmount - existingPaymentAmount) * 100) /
          100;

        // 如果关联应付款记录，需要同步更新应付款状态
        if (payment.payableRecordId) {
          const payableRecord = await tx.payableRecord.findUnique({
            where: { id: payment.payableRecordId },
            select: {
              id: true,
              payableAmount: true,
              paidAmount: true,
            },
          });

          if (payableRecord) {
            const payableAmount = toNumber(payableRecord.payableAmount);
            const payablePaidAmount = toNumber(payableRecord.paidAmount);

            const newPaidAmount =
              payablePaidAmount - existingPaymentAmount + currentPaymentAmount;
            const newRemainingAmount = payableAmount - newPaidAmount;

            let newStatus = 'pending';
            if (newRemainingAmount <= 0) {
              newStatus = 'paid';
            } else if (newPaidAmount > 0) {
              newStatus = 'partial';
            }

            await tx.payableRecord.update({
              where: { id: payableRecord.id },
              data: {
                paidAmount: newPaidAmount,
                remainingAmount: newRemainingAmount,
                status: newStatus,
              },
            });

            // 阶段3：付款金额变更后联动更新关联费用支付状态（支持回滚）
            if (env.EXPENSE_TO_PAYABLE_ENABLED) {
              await syncExpensePaymentStatusFromPayable({
                payableRecordId: payableRecord.id,
                tx,
              });
            }
          }
        }

        // ✅ 付款金额变更需同步供应商往来账单（追加差额流水，避免重算历史余额）
        if (paymentAmountDelta !== 0) {
          const transactionType =
            paymentAmountDelta > 0 ? 'payment_out' : 'payment_out_reversal';
          const amount = Math.abs(paymentAmountDelta);

          await recordPartnerTransaction(
            {
              partnerId: payment.supplierId,
              partnerName: payment.supplier.name,
              partnerRole: 'supplier',
              entityType: 'supplier',
              transactionType: transactionType as any,
              amount,
              referenceId: randomUUID(),
              referenceNumber: payment.paymentNumber,
              description:
                paymentAmountDelta > 0
                  ? `付款 ${payment.paymentNumber} 金额调增`
                  : `付款 ${payment.paymentNumber} 金额调减`,
              userId: user.id,
              occurredAt: payment.paymentDate,
              metadata: {
                triggeredBy: 'payment_out:update',
                source: payment.id,
                userId: user.id,
              },
            },
            tx
          );
        }

        return payment;
      });

      // 清除相关缓存（避免统计/对账单/列表读到旧值）
      await clearCacheAfterPaymentOut();

      return NextResponse.json({
        success: true,
        data: serializePaymentOutRecordDetail(updatedPayment),
        message: '付款记录更新成功',
      });
    } catch (error) {
      logger.error(
        'finance-payments-out',
        '更新付款记录失败',
        error,
        undefined,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '更新付款记录失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);

export const PUT = withRateLimit(RateLimitType.WRITE)(putPaymentHandler);

/**
 * DELETE /api/finance/payments-out/[id] - 删除付款记录
 */
const deletePaymentHandler = withAuth(
  async (request: NextRequest, context) => {
    let paymentId: string | undefined;
    try {
      const { id } = await resolveParams<PaymentParams>(
        context.params as Promise<PaymentParams> | PaymentParams | undefined
      );
      paymentId = id;
      const { user } = context;

      const existingPayment = await prisma.paymentOutRecord.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          paymentAmount: true,
          payableRecordId: true,
          supplierId: true,
          paymentNumber: true,
          voidedAt: true,
          paymentDate: true,
        },
      });

      if (!existingPayment) {
        return NextResponse.json(
          { success: false, error: '付款记录不存在' },
          { status: 404 }
        );
      }

      if (existingPayment.voidedAt || existingPayment.status === 'cancelled') {
        return NextResponse.json(
          { success: true, message: '付款记录已作废' },
          { status: 200 }
        );
      }

      // 尝试读取作废原因（可选）
      let voidReason: string | null = null;
      try {
        const body = await request.json();
        if (body && typeof body.voidReason === 'string' && body.voidReason) {
          voidReason = body.voidReason.slice(0, 64);
        }
      } catch (_error) {
        // ignore
      }

      await prisma.$transaction(async tx => {
        const now = new Date();
        const paymentAmount = toNumber(existingPayment.paymentAmount);

        // 1) 回滚关联应付款（若存在）
        if (existingPayment.payableRecordId) {
          const payableRecord = await tx.payableRecord.findUnique({
            where: { id: existingPayment.payableRecordId },
            select: {
              id: true,
              payableAmount: true,
              paidAmount: true,
            },
          });

          if (payableRecord) {
            const payableAmount = toNumber(payableRecord.payableAmount);
            const payablePaidAmount = toNumber(payableRecord.paidAmount);

            const newPaidAmount = Math.max(
              0,
              Math.round((payablePaidAmount - paymentAmount) * 100) / 100
            );
            const newRemainingAmount =
              Math.round((payableAmount - newPaidAmount) * 100) / 100;

            let newStatus = 'pending';
            if (newRemainingAmount <= 0) {
              newStatus = 'paid';
            } else if (newPaidAmount > 0) {
              newStatus = 'partial';
            }

            await tx.payableRecord.update({
              where: { id: payableRecord.id },
              data: {
                paidAmount: newPaidAmount,
                remainingAmount: newRemainingAmount,
                status: newStatus,
              },
            });

            if (env.EXPENSE_TO_PAYABLE_ENABLED) {
              await syncExpensePaymentStatusFromPayable({
                payableRecordId: payableRecord.id,
                tx,
              });
            }
          }
        }

        // 2) 标记付款记录作废（不做物理删除，便于报表口径过滤 voidedAt）
        await tx.paymentOutRecord.update({
          where: { id },
          data: {
            status: 'cancelled',
            voidedAt: now,
            voidedBy: user.id,
            voidReason: voidReason ?? 'voided',
          },
        });

        // 3) 写入供应商往来账反向流水（幂等：referenceId+type 唯一）
        const supplier = await tx.supplier.findUnique({
          where: { id: existingPayment.supplierId },
          select: { id: true, name: true },
        });

        if (!supplier) {
          throw new Error('供应商不存在');
        }

        await recordPartnerTransaction(
          {
            partnerId: existingPayment.supplierId,
            partnerName: supplier.name,
            partnerRole: 'supplier',
            entityType: 'supplier',
            transactionType: 'payment_out_reversal',
            amount: paymentAmount,
            referenceId: existingPayment.id,
            referenceNumber: existingPayment.paymentNumber,
            description: `付款 ${existingPayment.paymentNumber} 作废`,
            userId: user.id,
            occurredAt: now,
            metadata: {
              triggeredBy: 'payment_out:void',
              source: existingPayment.id,
              userId: user.id,
            },
          },
          tx
        );
      });

      // 清除相关缓存（避免统计/对账单/列表读到旧值）
      await clearCacheAfterPaymentOut();

      return NextResponse.json({
        success: true,
        message: '付款记录作废成功',
      });
    } catch (error) {
      logger.error(
        'finance-payments-out',
        '作废付款记录失败',
        error,
        undefined,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '作废付款记录失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);

export const DELETE = withRateLimit(RateLimitType.WRITE)(deletePaymentHandler);
