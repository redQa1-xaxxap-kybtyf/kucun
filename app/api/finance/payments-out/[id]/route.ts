// 单个付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';

import { verifyApiAuth, errorResponse } from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import type { PaymentOutRecordDetail } from '@/lib/types/payable';
import { updatePaymentOutRecordSchema } from '@/lib/validations/payable';

/**
 * GET /api/finance/payments-out/[id] - 获取单个付款记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 身份验证
    const auth = await verifyApiAuth(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    const { id } = await params;

    // 查询付款记录
    const payment = await prisma.paymentOutRecord.findUnique({
      where: { id },
      include: {
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
      },
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
    console.error('获取付款记录详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取付款记录详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/finance/payments-out/[id] - 更新付款记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 身份验证
    const auth = await verifyApiAuth(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    const { id } = await params;

    // 解析请求体
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

    const { id: _, ...updateData } = validationResult.data;

    // 检查付款记录是否存在
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

    // 如果付款记录已确认，不允许修改关键信息
    if (
      existingPayment.status === 'confirmed' &&
      (updateData.paymentAmount !== undefined ||
        updateData.status === 'cancelled')
    ) {
      return NextResponse.json(
        { success: false, error: '已确认的付款记录不能修改金额或取消' },
        { status: 400 }
      );
    }

    // 使用事务更新付款记录和相关应付款
    const updatedPayment = await prisma.$transaction(async tx => {
      // 如果修改付款金额或状态，需要更新关联的应付款记录
      if (
        existingPayment.payableRecordId &&
        (updateData.paymentAmount !== undefined ||
          updateData.status !== undefined)
      ) {
        const payableRecord = await tx.payableRecord.findUnique({
          where: { id: existingPayment.payableRecordId },
          select: {
            id: true,
            payableAmount: true,
            paidAmount: true,
          },
        });

        if (payableRecord) {
          let newPaidAmount = payableRecord.paidAmount;

          // 如果修改付款金额
          if (updateData.paymentAmount !== undefined) {
            const amountDiff =
              updateData.paymentAmount - existingPayment.paymentAmount;
            newPaidAmount += amountDiff;
          }

          // 如果取消付款
          if (updateData.status === 'cancelled') {
            newPaidAmount -= existingPayment.paymentAmount;
          }

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

      // 更新付款记录
      return await tx.paymentOutRecord.update({
        where: { id },
        data: {
          ...updateData,
          ...(updateData.paymentDate && {
            paymentDate: new Date(updateData.paymentDate),
          }),
        },
        include: {
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
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: updatedPayment as PaymentOutRecordDetail,
      message: '付款记录更新成功',
    });
  } catch (error) {
    console.error('更新付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '更新付款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/finance/payments-out/[id] - 删除付款记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 身份验证
    const auth = await verifyApiAuth(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    const { id } = await params;

    // 检查付款记录是否存在
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

    // 已确认的付款记录不能删除
    if (existingPayment.status === 'confirmed') {
      return NextResponse.json(
        { success: false, error: '已确认的付款记录不能删除' },
        { status: 400 }
      );
    }

    // 使用事务删除付款记录并更新应付款
    await prisma.$transaction(async tx => {
      // 如果关联应付款记录，需要更新应付款状态
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

      // 删除付款记录
      await tx.paymentOutRecord.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: '付款记录删除成功',
    });
  } catch (error) {
    console.error('删除付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '删除付款记录失败' },
      { status: 500 }
    );
  }
}
