// 退货订单批量操作API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { batchReturnOrderSchema } from '@/lib/validations/return-order';

/**
 * POST /api/return-orders/batch - 批量操作退货订单
 */
export async function POST(request: NextRequest) {
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
    const validationResult = batchReturnOrderSchema.safeParse(body);

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

    const { ids, action, remarks } = validationResult.data;

    // 检查退货订单是否存在
    const existingReturnOrders = await prisma.returnOrder.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        returnNumber: true,
        status: true,
      },
    });

    if (existingReturnOrders.length !== ids.length) {
      return NextResponse.json(
        { success: false, error: '部分退货订单不存在' },
        { status: 404 }
      );
    }

    let result;
    switch (action) {
      case 'approve':
        result = await batchApprove(existingReturnOrders, remarks);
        break;
      case 'reject':
        result = await batchReject(existingReturnOrders, remarks);
        break;
      case 'cancel':
        result = await batchCancel(existingReturnOrders, remarks);
        break;
      case 'export':
        result = await batchExport(existingReturnOrders);
        break;
      default:
        return NextResponse.json(
          { success: false, error: '不支持的操作类型' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `批量${getActionName(action)}操作完成`,
    });
  } catch (error) {
    console.error('批量操作退货订单失败:', error);
    return NextResponse.json(
      { success: false, error: '批量操作退货订单失败' },
      { status: 500 }
    );
  }
}

/**
 * 批量审批通过
 */
async function batchApprove(returnOrders: any[], remarks?: string) {
  const validOrders = returnOrders.filter(
    order => order.status === 'submitted'
  );

  if (validOrders.length === 0) {
    throw new Error('没有可审批的退货订单');
  }

  const result = await prisma.returnOrder.updateMany({
    where: {
      id: {
        in: validOrders.map(order => order.id),
      },
    },
    data: {
      status: 'approved',
      approvedAt: new Date(),
      updatedAt: new Date(),
      ...(remarks && { remarks }),
    },
  });

  return {
    processed: result.count,
    skipped: returnOrders.length - result.count,
    details: `成功审批 ${result.count} 个退货订单`,
  };
}

/**
 * 批量审批拒绝
 */
async function batchReject(returnOrders: any[], remarks?: string) {
  const validOrders = returnOrders.filter(
    order => order.status === 'submitted'
  );

  if (validOrders.length === 0) {
    throw new Error('没有可拒绝的退货订单');
  }

  const result = await prisma.returnOrder.updateMany({
    where: {
      id: {
        in: validOrders.map(order => order.id),
      },
    },
    data: {
      status: 'rejected',
      approvedAt: new Date(),
      updatedAt: new Date(),
      ...(remarks && { remarks }),
    },
  });

  return {
    processed: result.count,
    skipped: returnOrders.length - result.count,
    details: `成功拒绝 ${result.count} 个退货订单`,
  };
}

/**
 * 批量取消
 */
async function batchCancel(returnOrders: any[], remarks?: string) {
  const validOrders = returnOrders.filter(order =>
    ['draft', 'submitted', 'approved'].includes(order.status)
  );

  if (validOrders.length === 0) {
    throw new Error('没有可取消的退货订单');
  }

  const result = await prisma.returnOrder.updateMany({
    where: {
      id: {
        in: validOrders.map(order => order.id),
      },
    },
    data: {
      status: 'cancelled',
      updatedAt: new Date(),
      ...(remarks && { remarks }),
    },
  });

  return {
    processed: result.count,
    skipped: returnOrders.length - result.count,
    details: `成功取消 ${result.count} 个退货订单`,
  };
}

/**
 * 批量导出
 */
async function batchExport(returnOrders: any[]) {
  // 这里可以实现导出逻辑
  // 例如生成Excel文件、CSV文件等

  return {
    processed: returnOrders.length,
    skipped: 0,
    details: `准备导出 ${returnOrders.length} 个退货订单`,
    exportUrl: '/api/return-orders/export', // 可以返回导出文件的URL
  };
}

/**
 * 获取操作名称
 */
function getActionName(action: string): string {
  const actionNames: Record<string, string> = {
    approve: '审批通过',
    reject: '审批拒绝',
    cancel: '取消',
    export: '导出',
  };

  return actionNames[action] || action;
}
