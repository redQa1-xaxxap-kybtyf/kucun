// 单个付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import type { PaymentOutRecordDetail } from '@/lib/types/payable';
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

/**
 * GET /api/finance/payments-out/[id] - 获取单个付款记录详情
 */
const getPaymentHandler = withAuth(
  async (request: NextRequest, context) => {
    let paymentId: string | undefined;
    try {
      const { id } = await resolveParams<PaymentParams>(context.params);
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
        data: payment as PaymentOutRecordDetail,
      });
    } catch (error) {
      logger.error(
        'finance-payments-out',
        '获取付款记录详情失败',
        error,
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
      const { id } = await resolveParams<PaymentParams>(context.params);
      paymentId = id;

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
        },
      });

      if (!existingPayment) {
        return NextResponse.json(
          { success: false, error: '付款记录不存在' },
          { status: 404 }
        );
      }

      const updatedPayment = await prisma.$transaction(async tx => {
        // 更新付款记录
        const payment = await tx.paymentOutRecord.update({
          where: { id },
          data: updateData,
          include: paymentInclude,
        });

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
            const newPaidAmount =
              payableRecord.paidAmount -
              existingPayment.paymentAmount +
              payment.paymentAmount;
            const newRemainingAmount =
              payableRecord.payableAmount - newPaidAmount;

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
          }
        }

        return payment;
      });

      return NextResponse.json({
        success: true,
        data: updatedPayment as PaymentOutRecordDetail,
        message: '付款记录更新成功',
      });
    } catch (error) {
      logger.error(
        'finance-payments-out',
        '更新付款记录失败',
        error,
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
      const { id } = await resolveParams<PaymentParams>(context.params);
      paymentId = id;

      const existingPayment = await prisma.paymentOutRecord.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          paymentAmount: true,
          payableRecordId: true,
        },
      });

      if (!existingPayment) {
        return NextResponse.json(
          { success: false, error: '付款记录不存在' },
          { status: 404 }
        );
      }

      if (existingPayment.status === 'confirmed') {
        return NextResponse.json(
          { success: false, error: '已确认的付款记录不能删除' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async tx => {
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
            const newPaidAmount =
              payableRecord.paidAmount - existingPayment.paymentAmount;
            const newRemainingAmount =
              payableRecord.payableAmount - newPaidAmount;

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
          }
        }

        await tx.paymentOutRecord.delete({
          where: { id },
        });
      });

      return NextResponse.json({
        success: true,
        message: '付款记录删除成功',
      });
    } catch (error) {
      logger.error(
        'finance-payments-out',
        '删除付款记录失败',
        error,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '删除付款记录失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);

export const DELETE = withRateLimit(RateLimitType.WRITE)(deletePaymentHandler);
