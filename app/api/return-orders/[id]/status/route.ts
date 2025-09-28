// 退货订单状态更新API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateReturnStatusSchema } from '@/lib/validations/return-order';

/**
 * PATCH /api/return-orders/[id]/status - 更新退货订单状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = updateReturnStatusSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { status, remarks, refundAmount, processedAt } =
      validationResult.data;

    // 检查退货订单是否存在
    const existingReturnOrder = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        items: true,
        salesOrder: true,
      },
    });

    if (!existingReturnOrder) {
      return NextResponse.json(
        { success: false, error: '退货订单不存在' },
        { status: 404 }
      );
    }

    // 验证状态流转规则
    const validStatusTransitions: Record<string, string[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['approved', 'rejected', 'cancelled'],
      approved: ['processing', 'cancelled'],
      rejected: [], // 已拒绝的订单不能再变更状态
      processing: ['completed', 'cancelled'],
      completed: [], // 已完成的订单不能再变更状态
      cancelled: [], // 已取消的订单不能再变更状态
    };

    const allowedStatuses =
      validStatusTransitions[existingReturnOrder.status] || [];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `订单状态不能从 ${existingReturnOrder.status} 变更为 ${status}`,
        },
        { status: 400 }
      );
    }

    // 使用事务更新状态
    const updatedReturnOrder = await prisma.$transaction(async tx => {
      // 准备更新数据
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (remarks !== undefined) {
        updateData.remarks = remarks;
      }

      if (refundAmount !== undefined) {
        updateData.refundAmount = refundAmount;
      }

      // 根据状态设置时间戳
      switch (status) {
        case 'submitted':
          updateData.submittedAt = new Date();
          break;
        case 'approved':
          updateData.approvedAt = new Date();
          break;
        case 'processing':
          updateData.processedAt = processedAt
            ? new Date(processedAt)
            : new Date();
          break;
        case 'completed':
          updateData.completedAt = new Date();
          // 如果是退款处理方式，自动创建退款记录
          if (existingReturnOrder.processType === 'refund') {
            await createRefundRecord(tx, existingReturnOrder, session.user.id);
          }
          break;
      }

      // 更新退货订单
      return await tx.returnOrder.update({
        where: { id },
        data: updateData,
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
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: updatedReturnOrder,
      message: '退货订单状态更新成功',
    });
  } catch (error) {
    console.error('更新退货订单状态失败:', error);
    return NextResponse.json(
      { success: false, error: '更新退货订单状态失败' },
      { status: 500 }
    );
  }
}

/**
 * 创建退款记录
 */
async function createRefundRecord(tx: any, returnOrder: any, userId: string) {
  // 生成退款单号
  const refundNumber = `RF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // 创建退款记录
  await tx.refundRecord.create({
    data: {
      refundNumber,
      returnOrderId: returnOrder.id,
      returnOrderNumber: returnOrder.returnNumber,
      salesOrderId: returnOrder.salesOrderId,
      customerId: returnOrder.customerId,
      userId,
      refundType: 'full_refund',
      refundMethod: 'original_payment',
      refundAmount: returnOrder.refundAmount,
      processedAmount: 0,
      remainingAmount: returnOrder.refundAmount,
      status: 'pending',
      refundDate: new Date(),
      reason: `退货订单 ${returnOrder.returnNumber} 自动生成退款`,
      remarks: `系统自动创建，关联退货订单：${returnOrder.returnNumber}`,
    },
  });
}
