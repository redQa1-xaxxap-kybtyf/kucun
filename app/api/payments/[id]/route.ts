import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { parseLocalDateString } from '@/lib/utils/datetime';
import { updatePaymentRecordSchema } from '@/lib/validations/payment';

/**
 * GET /api/payments/[id] - 获取单个收款记录详情
 */
export const GET = withAuth(
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

      // 查询收款记录
      const payment = await prisma.paymentRecord.findUnique({
        where: { id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
              createdAt: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!payment) {
        return NextResponse.json(
          { success: false, error: '收款记录不存在' },
          { status: 404 }
        );
      }

      const serializedPayment = {
        ...payment,
        paymentAmount: Number(payment.paymentAmount),
        actualPaymentAmount: Number(payment.actualPaymentAmount),
        roundingAmount: Number(payment.roundingAmount),
        appliedAmount: Number(payment.appliedAmount),
      };

      return NextResponse.json({
        success: true,
        data: serializedPayment,
      });
    } catch (error) {
      logger.error(
        'payments',
        '获取收款记录详情失败',
        error,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '获取收款记录详情失败' },
        { status: 500 }
      );
    }
  }
);

/**
 * PUT /api/payments/[id] - 更新收款记录
 */
export const PUT = withAuth(
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

      // 验证收款记录是否存在
      const existingPayment = await prisma.paymentRecord.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!existingPayment) {
        return NextResponse.json(
          { success: false, error: '收款记录不存在' },
          { status: 404 }
        );
      }

      // 解析请求体
      const body = await request.json();
      const parseNumber = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string' && value.trim() !== '') {
          const parsed = Number(value);
          if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
            return parsed;
          }
        }
        return Number.NaN;
      };

      const normalizedBody = {
        ...body,
        ...(body?.paymentAmount !== undefined && {
          paymentAmount: parseNumber(body.paymentAmount),
        }),
        ...(body?.actualPaymentAmount !== undefined && {
          actualPaymentAmount: parseNumber(body.actualPaymentAmount),
        }),
        ...(body?.roundingAmount !== undefined && {
          roundingAmount: parseNumber(body.roundingAmount),
        }),
      };

      const validationResult =
        updatePaymentRecordSchema.safeParse(normalizedBody);

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

      const updateData = validationResult.data;

      // 处理日期字段并创建更新对象
      const updateDataWithDate = {
        ...updateData,
        ...(updateData.paymentDate && {
          paymentDate:
            parseLocalDateString(updateData.paymentDate) ??
            new Date(updateData.paymentDate),
        }),
      };

      // 更新收款记录
      const updatedPayment = await prisma.paymentRecord.update({
        where: { id },
        data: updateDataWithDate,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
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
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const serializedPayment = {
        ...updatedPayment,
        paymentAmount: Number(updatedPayment.paymentAmount),
        actualPaymentAmount: Number(updatedPayment.actualPaymentAmount),
        roundingAmount: Number(updatedPayment.roundingAmount),
        appliedAmount: Number(updatedPayment.appliedAmount),
      };

      return NextResponse.json({
        success: true,
        data: serializedPayment,
        message: '收款记录更新成功',
      });
    } catch (error) {
      logger.error(
        'payments',
        '更新收款记录失败',
        error,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '更新收款记录失败' },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/payments/[id] - 删除收款记录
 */
export const DELETE = withAuth(
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

      // 验证收款记录是否存在
      const existingPayment = await prisma.paymentRecord.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!existingPayment) {
        return NextResponse.json(
          { success: false, error: '收款记录不存在' },
          { status: 404 }
        );
      }

      // 检查是否可以删除（只有待确认状态的记录可以删除）
      if (existingPayment.status === 'confirmed') {
        return NextResponse.json(
          { success: false, error: '已确认的收款记录不能删除' },
          { status: 400 }
        );
      }

      // 删除收款记录
      await prisma.paymentRecord.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: '收款记录删除成功',
      });
    } catch (error) {
      logger.error(
        'payments',
        '删除收款记录失败',
        error,
        paymentId ? { paymentId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '删除收款记录失败' },
        { status: 500 }
      );
    }
  }
);
