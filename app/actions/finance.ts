'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseLocalDateString } from '@/lib/utils/datetime';
import { logger } from '@/lib/logger';

// cspell:words payables

/**
 * 财务模块 Server Actions
 *
 * ✅ Next.js 15 最佳实践：
 * 1. 'use server' 指令
 * 2. Zod 参数验证
 * 3. 身份认证检查
 * 4. Prisma 事务处理
 * 5. 路径重新验证
 */

// ============================================
// 类型定义
// ============================================

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// 收款记录 Actions
// ============================================

const createPaymentSchema = z
  .object({
    salesOrderId: z.string().min(1, '销售订单 ID 不能为空'),
    customerId: z.string().min(1, '客户 ID 不能为空'),
    paymentAmount: z.number().positive('收款金额必须大于 0'),
    actualPaymentAmount: z.number().min(0, '实际收款金额不能为负'),
    roundingAmount: z
      .number()
      .min(-9999999, '抹零金额不能低于 -9,999,999')
      .max(9999999, '抹零金额不能超过 9,999,999'),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'other']),
    paymentDate: z.date(),
    receiptNumber: z.string().optional(),
    remarks: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const expected = Number(
      (value.actualPaymentAmount + value.roundingAmount).toFixed(2)
    );
    const recorded = Number(value.paymentAmount.toFixed(2));
    if (Math.abs(expected - recorded) >= 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actualPaymentAmount'],
        message: '收款金额应等于实际收款金额与抹零金额之和',
      });
    }
  });

/**
 * 创建收款记录
 */
export async function createPaymentRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. 身份认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 数据验证
    const paymentAmount = parseFloat(formData.get('paymentAmount') as string);
    const actualAmount = parseFloat(
      (formData.get('actualPaymentAmount') as string) ?? ''
    );
    const roundingAmount = parseFloat(
      (formData.get('roundingAmount') as string) ?? ''
    );

    const rawData = {
      salesOrderId: formData.get('salesOrderId') as string,
      customerId: formData.get('customerId') as string,
      paymentAmount,
      actualPaymentAmount: Number.isFinite(actualAmount)
        ? actualAmount
        : paymentAmount,
      roundingAmount: Number.isFinite(roundingAmount)
        ? roundingAmount
        : Number(
            (
              paymentAmount -
              (Number.isFinite(actualAmount) ? actualAmount : paymentAmount)
            ).toFixed(2)
          ),
      paymentMethod: formData.get('paymentMethod') as string,
      paymentDate:
        parseLocalDateString(formData.get('paymentDate') as string) ??
        new Date(formData.get('paymentDate') as string),
      receiptNumber: formData.get('receiptNumber') as string,
      remarks: formData.get('remarks') as string,
    };

    const data = createPaymentSchema.parse(rawData);

    // 3. 数据库事务
    const result = await prisma.$transaction(async tx => {
      // 生成收款单号
      const count = await tx.paymentRecord.count();
      const paymentNumber = `PM${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

      // 创建收款记录
      const payment = await tx.paymentRecord.create({
        data: {
          paymentNumber,
          salesOrderId: data.salesOrderId,
          customerId: data.customerId,
          paymentAmount: data.paymentAmount,
          actualPaymentAmount: data.actualPaymentAmount,
          roundingAmount: data.roundingAmount,
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate,
          receiptNumber: data.receiptNumber,
          remarks: data.remarks,
          userId: session.user.id,
          status: 'pending',
        },
      });

      // 更新销售订单已收款金额
      const salesOrder = await tx.salesOrder.findUnique({
        where: { id: data.salesOrderId },
      });

      if (!salesOrder) {
        throw new Error('销售订单不存在');
      }

      const salesOrderFinancial = salesOrder as {
        paidAmount?: number | null;
        totalAmount: number;
      };
      const currentPaidAmount = salesOrderFinancial.paidAmount ?? 0;
      const computedPaidAmount = currentPaidAmount + data.paymentAmount;
      const cappedPaidAmount = Math.min(
        computedPaidAmount,
        salesOrderFinancial.totalAmount
      );

      await tx.salesOrder.update({
        where: { id: data.salesOrderId },
        data: {
          paidAmount: cappedPaidAmount,
        } as Prisma.SalesOrderUpdateInput,
      });

      return payment;
    });

    // 4. 重新验证路径
    revalidatePath('/finance/payments');
    revalidatePath('/finance/receivables');
    revalidatePath('/sales-orders');

    return { success: true, data: { id: result.id } };
  } catch (error) {
    logger.error('actions:finance', '创建收款记录失败', error, {
      action: 'createPaymentRecord',
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '创建收款记录失败' };
  }
}

/**
 * 确认收款记录
 */
export async function confirmPaymentRecord(
  paymentId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: { status: 'confirmed' },
    });

    revalidatePath('/finance/payments');
    revalidatePath('/finance/receivables');

    return { success: true };
  } catch (error) {
    logger.error('actions:finance', '确认收款记录失败', error, {
      action: 'confirmPaymentRecord',
      paymentId,
    });
    return { success: false, error: '确认收款记录失败' };
  }
}

// ============================================
// 应付款 Actions
// ============================================

const createPayableSchema = z.object({
  supplierId: z.string().min(1, '供应商 ID 不能为空'),
  payableAmount: z.number().positive('应付金额必须大于 0'),
  sourceType: z.enum(['purchase', 'return', 'other']),
  sourceId: z.string().optional(),
  dueDate: z.date().optional(),
  remarks: z.string().optional(),
});

/**
 * 创建应付款记录
 */
export async function createPayableRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      supplierId: formData.get('supplierId') as string,
      payableAmount: parseFloat(formData.get('payableAmount') as string),
      sourceType: formData.get('sourceType') as string,
      sourceId: formData.get('sourceId') as string,
      dueDate: formData.get('dueDate')
        ? new Date(formData.get('dueDate') as string)
        : undefined,
      remarks: formData.get('remarks') as string,
    };

    const data = createPayableSchema.parse(rawData);

    const result = await prisma.$transaction(async tx => {
      const count = await tx.payableRecord.count();
      const payableNumber = `PAY${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

      return await tx.payableRecord.create({
        data: {
          payableNumber,
          supplierId: data.supplierId,
          payableAmount: data.payableAmount,
          paidAmount: 0,
          remainingAmount: data.payableAmount,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          dueDate: data.dueDate,
          remarks: data.remarks,
          userId: session.user.id,
          status: 'pending',
        },
      });
    });

    revalidatePath('/finance/payables');
    return { success: true, data: { id: result.id } };
  } catch (error) {
    logger.error('actions:finance', '创建应付款记录失败', error, {
      action: 'createPayableRecord',
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '创建应付款记录失败' };
  }
}

// ============================================
// 付款 Actions
// ============================================

const createPaymentOutSchema = z.object({
  payableRecordId: z.string().min(1, '应付款 ID 不能为空'),
  paymentAmount: z.number().positive('付款金额必须大于 0'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'other']),
  paymentDate: z.date(),
  voucherNumber: z.string().optional(),
  remarks: z.string().optional(),
});

/**
 * 创建付款记录
 */
export async function createPaymentOutRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      payableRecordId: formData.get('payableRecordId') as string,
      paymentAmount: parseFloat(formData.get('paymentAmount') as string),
      paymentMethod: formData.get('paymentMethod') as string,
      paymentDate:
        parseLocalDateString(formData.get('paymentDate') as string) ??
        new Date(formData.get('paymentDate') as string),
      voucherNumber: formData.get('voucherNumber') as string,
      remarks: formData.get('remarks') as string,
    };

    const data = createPaymentOutSchema.parse(rawData);

    const result = await prisma.$transaction(async tx => {
      const count = await tx.paymentOutRecord.count();
      const paymentNumber = `PO${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

      const payableRecord = await tx.payableRecord.findUnique({
        where: { id: data.payableRecordId },
      });

      if (!payableRecord) {
        throw new Error('关联的应付记录不存在');
      }

      const payment = await tx.paymentOutRecord.create({
        data: {
          paymentNumber,
          payableRecordId: data.payableRecordId,
          supplierId: payableRecord.supplierId,
          paymentAmount: data.paymentAmount,
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate,
          voucherNumber: data.voucherNumber,
          remarks: data.remarks,
          userId: session.user.id,
          status: 'pending',
        },
      });

      const currentPaidAmount = payableRecord.paidAmount ?? 0;
      const computedPaidAmount = currentPaidAmount + data.paymentAmount;
      const updatedPaidAmount = Math.min(
        computedPaidAmount,
        payableRecord.payableAmount
      );
      const remainingAmount = Math.max(
        payableRecord.payableAmount - updatedPaidAmount,
        0
      );
      const updatedStatus =
        remainingAmount <= 0
          ? 'paid'
          : updatedPaidAmount > 0
            ? 'partial'
            : 'pending';

      await tx.payableRecord.update({
        where: { id: data.payableRecordId },
        data: {
          paidAmount: updatedPaidAmount,
          remainingAmount,
          status: updatedStatus,
        },
      });

      return payment;
    });

    revalidatePath('/finance/payments-out');
    revalidatePath('/finance/payables');

    return { success: true, data: { id: result.id } };
  } catch (error) {
    logger.error('actions:finance', '创建付款记录失败', error, {
      action: 'createPaymentOutRecord',
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '创建付款记录失败' };
  }
}

/**
 * 确认付款记录
 */
export async function confirmPaymentOutRecord(
  paymentId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.paymentOutRecord.update({
      where: { id: paymentId },
      data: { status: 'confirmed' },
    });

    revalidatePath('/finance/payments-out');
    revalidatePath('/finance/payables');

    return { success: true };
  } catch (error) {
    logger.error('actions:finance', '确认付款记录失败', error, {
      action: 'confirmPaymentOutRecord',
      paymentId,
    });
    return { success: false, error: '确认付款记录失败' };
  }
}

// ============================================
// 退款 Actions
// ============================================

const createRefundSchema = z.object({
  returnOrderId: z.string().min(1, '退货订单 ID 不能为空'),
  salesOrderId: z.string().min(1, '销售订单 ID 不能为空'),
  customerId: z.string().min(1, '客户 ID 不能为空'),
  refundType: z.enum(['full_refund', 'partial_refund', 'exchange_refund']),
  refundAmount: z.number().positive('退款金额必须大于 0'),
  refundMethod: z.enum([
    'cash',
    'bank_transfer',
    'check',
    'original_payment',
    'other',
  ]),
  refundDate: z.date(),
  reason: z.string().min(1, '退款原因不能为空'),
  receiptNumber: z.string().optional(),
  bankInfo: z.string().optional(),
  remarks: z.string().optional(),
});

/**
 * 创建退款记录
 */
export async function createRefundRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      returnOrderId: formData.get('returnOrderId') as string,
      salesOrderId: formData.get('salesOrderId') as string,
      customerId: formData.get('customerId') as string,
      refundType: formData.get('refundType') as string,
      refundAmount: parseFloat(formData.get('refundAmount') as string),
      refundMethod: formData.get('refundMethod') as string,
      refundDate: new Date(formData.get('refundDate') as string),
      reason: formData.get('reason') as string,
      receiptNumber: formData.get('receiptNumber') as string,
      bankInfo: formData.get('bankInfo') as string,
      remarks: formData.get('remarks') as string,
    };

    const data = createRefundSchema.parse(rawData);

    const result = await prisma.$transaction(async tx => {
      const count = await tx.refundRecord.count();
      const refundNumber = `RF${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

      const returnOrder = await tx.returnOrder.findUnique({
        where: { id: data.returnOrderId },
        select: { salesOrderId: true },
      });

      if (!returnOrder) {
        throw new Error('退货订单不存在');
      }

      if (returnOrder.salesOrderId !== data.salesOrderId) {
        throw new Error('退货订单与销售订单不匹配');
      }

      const receiptNumber = data.receiptNumber?.trim()
        ? data.receiptNumber
        : undefined;
      const bankInfo = data.bankInfo?.trim() ? data.bankInfo : undefined;
      const remarks = data.remarks?.trim() ? data.remarks : undefined;

      const refund = await tx.refundRecord.create({
        data: {
          refundNumber,
          returnOrderId: data.returnOrderId,
          salesOrderId: data.salesOrderId,
          customerId: data.customerId,
          refundType: data.refundType,
          refundAmount: data.refundAmount,
          refundMethod: data.refundMethod,
          refundDate: data.refundDate,
          reason: data.reason,
          remarks,
          receiptNumber,
          bankInfo,
          processedAmount: 0,
          remainingAmount: data.refundAmount,
          userId: session.user.id,
          status: 'pending',
        },
      });

      // 更新退货订单状态
      await tx.returnOrder.update({
        where: { id: data.returnOrderId },
        data: { status: 'processing' },
      });

      return refund;
    });

    revalidatePath('/finance/refunds');
    revalidatePath('/return-orders');

    return { success: true, data: { id: result.id } };
  } catch (error) {
    logger.error('actions:finance', '创建退款记录失败', error, {
      action: 'createRefundRecord',
    });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '创建退款记录失败' };
  }
}

/**
 * 确认退款记录
 */
export async function confirmRefundRecord(
  refundId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.refundRecord.update({
      where: { id: refundId },
      data: { status: 'confirmed' },
    });

    revalidatePath('/finance/refunds');

    return { success: true };
  } catch (error) {
    logger.error('actions:finance', '确认退款记录失败', error, {
      action: 'confirmRefundRecord',
      refundId,
    });
    return { success: false, error: '确认退款记录失败' };
  }
}
