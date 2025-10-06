// 退货订单审批API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { publishApprovalResult } from '@/lib/events';
import { returnOrderApprovalSchema } from '@/lib/validations/return-order';

/**
 * POST /api/return-orders/[id]/approve - 审批退货订单
 */
export const POST = withAuth(
  async (request: NextRequest, { user, params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    // 解析请求体
    const body = await request.json();
    const validationResult = returnOrderApprovalSchema.safeParse(body);

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

    const { approved, remarks, refundAmount } = validationResult.data;

    // 检查退货订单是否存在
    const existingReturnOrder = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        items: true,
        salesOrder: true,
        customer: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingReturnOrder) {
      return NextResponse.json(
        { success: false, error: '退货订单不存在' },
        { status: 404 }
      );
    }

    // 检查是否可以审批
    if (existingReturnOrder.status !== 'submitted') {
      return NextResponse.json(
        { success: false, error: '只有已提交的退货订单可以审批' },
        { status: 400 }
      );
    }

    // ✅ 使用事务处理审批，事件发布在事务成功后
    let updatedReturnOrder;

    try {
      updatedReturnOrder = await prisma.$transaction(async tx => {
        // 准备更新数据
        const updateData: {
          status: string;
          approvedAt: Date;
          updatedAt: Date;
          approvedBy?: string;
          remarks?: string;
          refundAmount?: number;
        } = {
          status: approved ? 'approved' : 'rejected',
          approvedAt: new Date(),
          updatedAt: new Date(),
        };

        if (remarks) {
          updateData.remarks = remarks;
        }

        // 如果审批通过且设置了退款金额
        if (approved && refundAmount !== undefined) {
          updateData.refundAmount = refundAmount;
        }

        // 更新退货订单
        const returnOrder = await tx.returnOrder.update({
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
                    code: true,
                  },
                },
              },
            },
          },
        });

        // 如果审批通过，可以选择自动进入处理状态
        if (approved) {
          // 这里可以添加自动处理逻辑，比如：
          // 1. 通知仓库准备收货
          // 2. 发送客户通知
          // 3. 创建相关任务等
          console.log(`退货订单 ${returnOrder.returnNumber} 审批通过`);
        } else {
          console.log(`退货订单 ${returnOrder.returnNumber} 审批拒绝`);
        }

        return returnOrder;
      });

      // ✅ 事务成功提交后才发布事件，避免事件发送但数据未提交的情况
      await publishApprovalResult({
      approved,
      resourceType: 'return',
      resourceId: updatedReturnOrder.id,
      resourceNumber: updatedReturnOrder.returnNumber,
      requesterId: existingReturnOrder.userId,
      requesterName: existingReturnOrder.user?.name || '未知用户',
      approverId: user.id,
      approverName: user.name || user.username,
      comment: remarks,
      userId: user.id,
    });

      return NextResponse.json({
        success: true,
        data: updatedReturnOrder,
        message: approved ? '退货订单审批通过' : '退货订单审批拒绝',
      });
    } catch (error) {
      // 如果事件发布失败，记录错误但不影响业务流程
      console.error('Event publish failed:', error);

      // 如果是事务执行失败，抛出错误
      if (!updatedReturnOrder) {
        throw error;
      }

      // 事务成功但事件发布失败，仍返回成功（事件发布为非关键路径）
      return NextResponse.json({
        success: true,
        data: updatedReturnOrder,
        message: approved ? '退货订单审批通过' : '退货订单审批拒绝',
      });
    }
  },
  { anyPermissions: ['returns:approve', 'returns:reject'] }
);
