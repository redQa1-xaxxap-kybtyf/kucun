import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/sales-orders/[id]/returnable-items
 * 获取销售订单的可退货明细
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 查询销售订单及其明细
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                unit: true,
                specification: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!salesOrder) {
      return NextResponse.json(
        { success: false, error: '销售订单不存在' },
        { status: 404 }
      );
    }

    // 检查订单状态是否允许退货
    const allowedStatuses = ['confirmed', 'shipped', 'completed'];
    if (!allowedStatuses.includes(salesOrder.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `订单状态为 ${salesOrder.status}，不允许退货`,
        },
        { status: 400 }
      );
    }

    // 查询已退货数量
    const existingReturns = await prisma.returnOrderItem.findMany({
      where: {
        returnOrder: {
          salesOrderId: id,
          status: {
            not: 'cancelled', // 排除已取消的退货订单
          },
        },
      },
      select: {
        salesOrderItemId: true,
        returnQuantity: true,
      },
    });

    // 计算每个明细项的已退货数量
    const returnedQuantities = existingReturns.reduce(
      (acc, item) => {
        const key = item.salesOrderItemId;
        acc[key] = (acc[key] || 0) + item.returnQuantity;
        return acc;
      },
      {} as Record<string, number>
    );

    // 构建可退货明细
    const returnableItems = (salesOrder as any).items
      .map((item: any) => {
        const returnedQuantity = returnedQuantities[item.id] || 0;
        const availableQuantity = item.quantity - returnedQuantity;

        return {
          salesOrderItemId: item.id,
          productId: item.productId,
          product: item.product,
          originalQuantity: item.quantity,
          returnedQuantity,
          availableQuantity,
          unitPrice: item.unitPrice,
          maxReturnAmount: availableQuantity * item.unitPrice,
          colorCode: item.colorCode,
          productionDate: item.productionDate,
          batchNumber: item.batchNumber,
          variantId: item.variantId,
        };
      })
      .filter((item: any) => item.availableQuantity > 0); // 只返回还可以退货的明细

    const response = {
      salesOrder: {
        id: salesOrder.id,
        orderNumber: salesOrder.orderNumber,
        status: salesOrder.status,
        totalAmount: salesOrder.totalAmount,
        customer: (salesOrder as any).customer,
        createdAt: salesOrder.createdAt,
      },
      returnableItems,
      summary: {
        totalItems: (salesOrder as any).items.length,
        returnableItems: returnableItems.length,
        maxReturnAmount: returnableItems.reduce(
          (sum: any, item: any) => sum + item.maxReturnAmount,
          0
        ),
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('获取可退货明细失败:', error);
    return NextResponse.json(
      { success: false, error: '获取可退货明细失败' },
      { status: 500 }
    );
  }
}
