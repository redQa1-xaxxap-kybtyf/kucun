// 单个应付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import type { PayableRecordDetail } from '@/lib/types/payable';
import { toNumber } from '@/lib/utils/number';
import { updatePayableRecordSchema } from '@/lib/validations/payable';

type PayableParams = { id: string };

const payableInclude = {
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
  paymentOutRecords: {
    select: {
      id: true,
      paymentNumber: true,
      payableRecordId: true,
      supplierId: true,
      userId: true,
      paymentAmount: true,
      actualPaymentAmount: true,
      roundingAmount: true,
      paymentDate: true,
      paymentMethod: true,
      status: true,
      remarks: true,
      voucherNumber: true,
      bankInfo: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { paymentDate: 'desc' as const },
  },
};

type PayableRecordWithInclude = Prisma.PayableRecordGetPayload<{
  include: typeof payableInclude;
}>;

const PAYABLE_SOURCE_TYPES = [
  'purchase_order',
  'factory_shipment',
  'sales_order',
  'service',
  'other',
] as const satisfies ReadonlyArray<PayableRecordDetail['sourceType']>;

const PAYABLE_STATUSES = [
  'pending',
  'partial',
  'paid',
  'overdue',
  'cancelled',
] as const satisfies ReadonlyArray<PayableRecordDetail['status']>;

const PAYMENT_OUT_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
] as const satisfies ReadonlyArray<
  PayableRecordDetail['paymentOutRecords'][number]['status']
>;

const PAYMENT_OUT_METHODS = [
  'cash',
  'bank_transfer',
  'alipay',
  'wechat',
  'check',
  'other',
] as const satisfies ReadonlyArray<
  PayableRecordDetail['paymentOutRecords'][number]['paymentMethod']
>;

function normalizePayableSourceType(
  value: string
): PayableRecordDetail['sourceType'] {
  return (PAYABLE_SOURCE_TYPES as readonly string[]).includes(value)
    ? (value as PayableRecordDetail['sourceType'])
    : 'other';
}

function normalizePayableStatus(value: string): PayableRecordDetail['status'] {
  return (PAYABLE_STATUSES as readonly string[]).includes(value)
    ? (value as PayableRecordDetail['status'])
    : 'pending';
}

function normalizePaymentOutStatus(
  value: string
): PayableRecordDetail['paymentOutRecords'][number]['status'] {
  return (PAYMENT_OUT_STATUSES as readonly string[]).includes(value)
    ? (value as PayableRecordDetail['paymentOutRecords'][number]['status'])
    : 'pending';
}

function normalizePaymentOutMethod(
  value: string
): PayableRecordDetail['paymentOutRecords'][number]['paymentMethod'] {
  return (PAYMENT_OUT_METHODS as readonly string[]).includes(value)
    ? (value as PayableRecordDetail['paymentOutRecords'][number]['paymentMethod'])
    : 'other';
}

function serializePayableRecordDetail(
  payable: PayableRecordWithInclude
): PayableRecordDetail {
  return {
    id: payable.id,
    payableNumber: payable.payableNumber,
    supplierId: payable.supplierId,
    userId: payable.userId,
    sourceType: normalizePayableSourceType(payable.sourceType),
    ...(payable.sourceId !== null && payable.sourceId !== undefined
      ? { sourceId: payable.sourceId }
      : {}),
    ...(payable.sourceNumber !== null && payable.sourceNumber !== undefined
      ? { sourceNumber: payable.sourceNumber }
      : {}),
    payableAmount: toNumber(payable.payableAmount),
    paidAmount: toNumber(payable.paidAmount),
    remainingAmount: toNumber(payable.remainingAmount),
    ...(payable.dueDate !== null && payable.dueDate !== undefined
      ? { dueDate: payable.dueDate }
      : {}),
    status: normalizePayableStatus(payable.status),
    paymentTerms: payable.paymentTerms,
    ...(payable.description !== null && payable.description !== undefined
      ? { description: payable.description }
      : {}),
    ...(payable.remarks !== null && payable.remarks !== undefined
      ? { remarks: payable.remarks }
      : {}),
    createdAt: payable.createdAt,
    updatedAt: payable.updatedAt,
    supplier: {
      id: payable.supplier.id,
      name: payable.supplier.name,
      ...(payable.supplier.phone !== null &&
      payable.supplier.phone !== undefined
        ? { phone: payable.supplier.phone }
        : {}),
      ...(payable.supplier.address !== null &&
      payable.supplier.address !== undefined
        ? { address: payable.supplier.address }
        : {}),
    },
    user: {
      id: payable.user.id,
      name: payable.user.name,
      email: payable.user.email ?? '',
    },
    paymentOutRecords: payable.paymentOutRecords.map(payment => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      ...(payment.payableRecordId !== null &&
      payment.payableRecordId !== undefined
        ? { payableRecordId: payment.payableRecordId }
        : {}),
      supplierId: payment.supplierId,
      userId: payment.userId,
      paymentMethod: normalizePaymentOutMethod(payment.paymentMethod),
      paymentAmount: toNumber(payment.paymentAmount),
      actualPaymentAmount: toNumber(payment.actualPaymentAmount),
      roundingAmount: toNumber(payment.roundingAmount),
      paymentDate: payment.paymentDate,
      status: normalizePaymentOutStatus(payment.status),
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
    })),
  };
}

/**
 * GET /api/finance/payables/[id] - 获取单个应付款记录详情
 */
const getPayableHandler = withAuth(
  async (request: NextRequest, context) => {
    let payableId: string | undefined;
    try {
      const { id } = await resolveParams<PayableParams>(
        context.params as Promise<PayableParams> | PayableParams | undefined
      );
      payableId = id;

      const payable = await prisma.payableRecord.findUnique({
        where: { id },
        include: payableInclude,
      });

      if (!payable) {
        return NextResponse.json(
          { success: false, error: '应付款记录不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: serializePayableRecordDetail(payable),
      });
    } catch (error) {
      logger.error(
        'finance-payables',
        '获取应付款记录详情失败',
        error,
        payableId ? { payableId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '获取应付款记录详情失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getPayableHandler);

/**
 * PUT /api/finance/payables/[id] - 更新应付款记录
 */
const putPayableHandler = withAuth(
  async (request: NextRequest, context) => {
    let payableId: string | undefined;
    try {
      const { id } = await resolveParams<PayableParams>(
        context.params as Promise<PayableParams> | PayableParams | undefined
      );
      payableId = id;

      const body = await request.json();
      const validationResult = updatePayableRecordSchema.safeParse({
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

      const updateData = validationResult.data;

      const existingPayable = await prisma.payableRecord.findUnique({
        where: { id },
        select: {
          id: true,
          payableAmount: true,
          paidAmount: true,
          status: true,
        },
      });

      if (!existingPayable) {
        return NextResponse.json(
          { success: false, error: '应付款记录不存在' },
          { status: 404 }
        );
      }

      if (
        updateData.payableAmount !== undefined &&
        updateData.payableAmount < toNumber(existingPayable.paidAmount)
      ) {
        return NextResponse.json(
          { success: false, error: '应付金额不能小于已付金额' },
          { status: 400 }
        );
      }

      const existingPaidAmount = toNumber(existingPayable.paidAmount);
      const existingPayableAmount = toNumber(existingPayable.payableAmount);
      const remainingAmount =
        updateData.payableAmount !== undefined
          ? updateData.payableAmount - existingPaidAmount
          : existingPayableAmount - existingPaidAmount;

      const updatedPayable = await prisma.payableRecord.update({
        where: { id },
        data: {
          ...updateData,
          ...(updateData.payableAmount !== undefined && { remainingAmount }),
        },
        include: payableInclude,
      });

      return NextResponse.json({
        success: true,
        data: serializePayableRecordDetail(updatedPayable),
        message: '应付款记录更新成功',
      });
    } catch (error) {
      logger.error(
        'finance-payables',
        '更新应付款记录失败',
        error,
        payableId ? { payableId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '更新应付款记录失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);

export const PUT = withRateLimit(RateLimitType.WRITE)(putPayableHandler);

/**
 * DELETE /api/finance/payables/[id] - 删除应付款记录
 */
const deletePayableHandler = withAuth(
  async (request: NextRequest, context) => {
    let payableId: string | undefined;
    try {
      const { id } = await resolveParams<PayableParams>(
        context.params as Promise<PayableParams> | PayableParams | undefined
      );
      payableId = id;

      const existingPayable = await prisma.payableRecord.findUnique({
        where: { id },
        select: {
          id: true,
          paidAmount: true,
          paymentOutRecords: {
            select: { id: true },
          },
        },
      });

      if (!existingPayable) {
        return NextResponse.json(
          { success: false, error: '应付款记录不存在' },
          { status: 404 }
        );
      }

      if (
        toNumber(existingPayable.paidAmount) > 0 ||
        existingPayable.paymentOutRecords.length > 0
      ) {
        return NextResponse.json(
          { success: false, error: '已有付款记录的应付款不能删除' },
          { status: 400 }
        );
      }

      await prisma.payableRecord.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: '应付款记录删除成功',
      });
    } catch (error) {
      logger.error(
        'finance-payables',
        '删除应付款记录失败',
        error,
        payableId ? { payableId } : undefined
      );
      return NextResponse.json(
        { success: false, error: '删除应付款记录失败' },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:manage'] }
);

export const DELETE = withRateLimit(RateLimitType.WRITE)(deletePayableHandler);
