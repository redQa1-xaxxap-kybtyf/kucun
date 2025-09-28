// 退款处理API
// 处理退款申请的审核、批准、拒绝等操作

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processRefundSchema } from '@/lib/validations/refund';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/finance/refunds/[id]/process
 * 处理退款申请
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();

    // 验证请求数据
    const validationResult = processRefundSchema.safeParse(body);
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

    const { processedAmount, processedDate, status, remarks } =
      validationResult.data;

    // 使用事务处理退款
    const result = await prisma.$transaction(async tx => {
      // 1. 查询现有退款记录
      const existingRefund = await tx.refundRecord.findUnique({
        where: { id },
        include: {
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
            },
          },
        },
      });

      if (!existingRefund) {
        throw new Error('退款记录不存在');
      }

      // 2. 检查退款状态
      if (
        existingRefund.status !== 'pending' &&
        existingRefund.status !== 'processing'
      ) {
        throw new Error('只能处理待处理或处理中状态的退款申请');
      }

      // 3. 验证处理金额
      if (status === 'completed') {
        if (processedAmount <= 0) {
          throw new Error('处理金额必须大于0');
        }
        if (processedAmount > existingRefund.remainingAmount) {
          throw new Error('处理金额不能超过剩余退款金额');
        }
      }

      // 4. 计算新的金额
      let newProcessedAmount = existingRefund.processedAmount;
      let newRemainingAmount = existingRefund.remainingAmount;
      let finalStatus = status;

      if (status === 'completed') {
        newProcessedAmount += processedAmount;
        newRemainingAmount -= processedAmount;

        // 如果剩余金额为0，标记为完全完成
        if (newRemainingAmount <= 0) {
          newRemainingAmount = 0;
          finalStatus = 'completed';
        } else {
          // 如果还有剩余金额，保持处理中状态
          finalStatus = 'processing';
        }
      } else if (status === 'rejected') {
        // 拒绝退款，重置金额
        newProcessedAmount = 0;
        newRemainingAmount = existingRefund.refundAmount;
        finalStatus = 'rejected';
      }

      // 5. 更新退款记录
      const updatedRefund = await tx.refundRecord.update({
        where: { id },
        data: {
          processedAmount: newProcessedAmount,
          remainingAmount: newRemainingAmount,
          processedDate: new Date(processedDate),
          status: finalStatus,
          remarks: remarks || existingRefund.remarks,
          updatedAt: new Date(),
        },
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

      // 6. 记录处理日志（可选，如果有日志表的话）
      // await tx.refundProcessLog.create({
      //   data: {
      //     refundId: id,
      //     userId: session.user.id,
      //     action: status,
      //     processedAmount,
      //     remarks,
      //     createdAt: new Date(),
      //   },
      // });

      return updatedRefund;
    });

    // 7. 返回处理结果
    const message =
      result.status === 'completed'
        ? '退款处理完成'
        : result.status === 'processing'
          ? '退款部分处理完成'
          : '退款申请已拒绝';

    return NextResponse.json({
      success: true,
      data: result,
      message,
    });
  } catch (error) {
    console.error('处理退款失败:', error);

    // 处理已知错误
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '处理退款失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/finance/refunds/[id]/process
 * 获取退款处理历史记录
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 查询退款记录
    const refund = await prisma.refundRecord.findUnique({
      where: { id },
      select: {
        id: true,
        refundNumber: true,
        status: true,
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        processedDate: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!refund) {
      return NextResponse.json(
        { success: false, error: '退款记录不存在' },
        { status: 404 }
      );
    }

    // 构造处理历史（基于现有数据）
    const processHistory = [];

    // 创建记录
    processHistory.push({
      action: 'created',
      date: refund.createdAt,
      amount: refund.refundAmount,
      status: 'pending',
      remarks: '退款申请已创建',
    });

    // 处理记录
    if (refund.processedDate) {
      processHistory.push({
        action:
          refund.status === 'completed'
            ? 'approved'
            : refund.status === 'rejected'
              ? 'rejected'
              : 'processing',
        date: refund.processedDate,
        amount: refund.processedAmount,
        status: refund.status,
        remarks: refund.remarks || '',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        refund,
        processHistory,
      },
    });
  } catch (error) {
    console.error('获取退款处理历史失败:', error);
    return NextResponse.json(
      { success: false, error: '获取退款处理历史失败' },
      { status: 500 }
    );
  }
}
