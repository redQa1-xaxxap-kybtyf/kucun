'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

const createPaymentSchema = z.object({
  salesOrderId: z.string().min(1, '销售订单 ID 不能为空'),
  customerId: z.string().min(1, '客户 ID 不能为空'),
  paymentAmount: z.number().positive('收款金额必须大于 0'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'other']),
  paymentDate: z.date(),
  receiptNumber: z.string().optional(),
  remarks: z.string().optional(),
});

/**
 * 创建收款记录
 */
export async function createPaymentRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. 身份认证
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 数据验证
    const rawData = {
      salesOrderId: formData.get('salesOrderId') as string,
      customerId: formData.get('customerId') as string,
      paymentAmount: parseFloat(formData.get('paymentAmount') as string),
      paymentMethod: formData.get('paymentMethod') as string,
      paymentDate: new Date(formData.get('paymentDate') as string),
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
        select: { paidAmount: true, totalAmount: true },
      });

      if (salesOrder) {
        const newPaidAmount = salesOrder.paidAmount + data.paymentAmount;
        const newPaymentStatus =
          newPaidAmount >= salesOrder.totalAmount
            ? 'paid'
            : newPaidAmount > 0
              ? 'partial'
              : 'unpaid';

        await tx.salesOrder.update({
          where: { id: data.salesOrderId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus: newPaymentStatus,
          },
        });
      }

      return payment;
    });

    // 4. 重新验证路径
    revalidatePath('/finance/payments');
    revalidatePath('/finance/receivables');
    revalidatePath('/sales-orders');

    return { success: true, data: { id: result.id } };
  } catch (error) {
    console.error('创建收款记录失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
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
    const session = await auth();
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
    console.error('确认收款记录失败:', error);
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
    const session = await auth();
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
    console.error('创建应付款记录失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: '创建应付款记录失败' };
  }
}

// ============================================
// 付款 Actions
// ============================================

const createPaymentOutSchema = z.object({
  payableId: z.string().min(1, '应付款 ID 不能为空'),
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      payableId: formData.get('payableId') as string,
      paymentAmount: parseFloat(formData.get('paymentAmount') as string),
      paymentMethod: formData.get('paymentMethod') as string,
      paymentDate: new Date(formData.get('paymentDate') as string),
      voucherNumber: formData.get('voucherNumber') as string,
      remarks: formData.get('remarks') as string,
    };

    const data = createPaymentOutSchema.parse(rawData);

    const result = await prisma.$transaction(async tx => {
      const count = await tx.paymentOutRecord.count();
      const paymentNumber = `PO${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

      const payment = await tx.paymentOutRecord.create({
        data: {
          paymentNumber,
          payableId: data.payableId,
          paymentAmount: data.paymentAmount,
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate,
          voucherNumber: data.voucherNumber,
          remarks: data.remarks,
          userId: session.user.id,
          status: 'pending',
        },
      });

      // 更新应付款记录
      const payable = await tx.payableRecord.findUnique({
        where: { id: data.payableId },
        select: { paidAmount: true, payableAmount: true },
      });

      if (payable) {
        const newPaidAmount = payable.paidAmount + data.paymentAmount;
        const newRemainingAmount = payable.payableAmount - newPaidAmount;
        const newStatus =
          newRemainingAmount <= 0
            ? 'paid'
            : newPaidAmount > 0
              ? 'partial'
              : 'pending';

        await tx.payableRecord.update({
          where: { id: data.payableId },
          data: {
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            status: newStatus,
          },
        });
      }

      return payment;
    });

    revalidatePath('/finance/payments-out');
    revalidatePath('/finance/payables');

    return { success: true, data: { id: result.id } };
  } catch (error) {
    console.error('创建付款记录失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
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
    const session = await auth();
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
    console.error('确认付款记录失败:', error);
    return { success: false, error: '确认付款记录失败' };
  }
}

// ============================================
// 退款 Actions
// ============================================

const createRefundSchema = z.object({
  returnOrderId: z.string().min(1, '退货订单 ID 不能为空'),
  customerId: z.string().min(1, '客户 ID 不能为空'),
  refundAmount: z.number().positive('退款金额必须大于 0'),
  refundMethod: z.enum(['cash', 'bank_transfer', 'check', 'other']),
  refundDate: z.date(),
  voucherNumber: z.string().optional(),
  remarks: z.string().optional(),
});

/**
 * 创建退款记录
 */
export async function createRefundRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      returnOrderId: formData.get('returnOrderId') as string,
      customerId: formData.get('customerId') as string,
      refundAmount: parseFloat(formData.get('refundAmount') as string),
      refundMethod: formData.get('refundMethod') as string,
      refundDate: new Date(formData.get('refundDate') as string),
      voucherNumber: formData.get('voucherNumber') as string,
      remarks: formData.get('remarks') as string,
    };

    const data = createRefundSchema.parse(rawData);

    const result = await prisma.$transaction(async tx => {
      const count = await tx.refundRecord.count();
      const refundNumber = `RF${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

      const refund = await tx.refundRecord.create({
        data: {
          refundNumber,
          returnOrderId: data.returnOrderId,
          customerId: data.customerId,
          refundAmount: data.refundAmount,
          refundMethod: data.refundMethod,
          refundDate: data.refundDate,
          voucherNumber: data.voucherNumber,
          remarks: data.remarks,
          userId: session.user.id,
          status: 'pending',
        },
      });

      // 更新退货订单状态
      await tx.returnOrder.update({
        where: { id: data.returnOrderId },
        data: { refundStatus: 'completed' },
      });

      return refund;
    });

    revalidatePath('/finance/refunds');
    revalidatePath('/return-orders');

    return { success: true, data: { id: result.id } };
  } catch (error) {
    console.error('创建退款记录失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
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
    const session = await auth();
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
    console.error('确认退款记录失败:', error);
    return { success: false, error: '确认退款记录失败' };
  }
}
