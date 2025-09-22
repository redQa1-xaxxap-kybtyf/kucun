import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma, withTransaction } from '@/lib/db';

// 获取单个销售订单信息
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

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        totalAmount: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        customer: {
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
        items: {
          select: {
            id: true,
            productId: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                specification: true,
                unit: true,
                piecesPerUnit: true,
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

    // 转换数据格式
    const formattedOrder = {
      id: salesOrder.id,
      orderNumber: salesOrder.orderNumber,
      customerId: salesOrder.customerId,
      userId: salesOrder.userId,
      status: salesOrder.status,
      totalAmount: salesOrder.totalAmount,
      remarks: salesOrder.remarks,
      customer: salesOrder.customer,
      user: salesOrder.user,
      items: salesOrder.items.map(
        (item: {
          id: string;
          productId: string;
          colorCode: string;
          productionDate: Date;
          quantity: number;
          unitPrice: number;
          subtotal: number;
          product: unknown;
        }) => ({
          id: item.id,
          productId: item.productId,
          colorCode: item.colorCode,
          productionDate: item.productionDate,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          product: item.product,
        })
      ),
      createdAt: salesOrder.createdAt,
      updatedAt: salesOrder.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedOrder,
    });
  } catch (error) {
    console.error('获取销售订单信息错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取销售订单信息失败',
      },
      { status: 500 }
    );
  }
}

// 更新销售订单状态
export async function PUT(
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

    const body = await request.json();

    // 验证输入数据
    const validationResult = salesOrderUpdateSchema.safeParse({
      id,
      ...body,
    });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { status, remarks } = validationResult.data;

    // 检查订单是否存在
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '销售订单不存在' },
        { status: 404 }
      );
    }

    // 验证状态流转规则
    const validStatusTransitions: Record<string, string[]> = {
      draft: ['confirmed', 'cancelled'],
      confirmed: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [], // 已完成的订单不能再变更状态
      cancelled: [], // 已取消的订单不能再变更状态
    };

    if (status && status !== existingOrder.status) {
      const allowedStatuses =
        validStatusTransitions[existingOrder.status] || [];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `订单状态不能从 ${existingOrder.status} 变更为 ${status}`,
          },
          { status: 400 }
        );
      }
    }

    // 如果状态变更为已发货或已完成，需要更新库存
    const shouldUpdateInventory =
      status &&
      ['shipped', 'completed'].includes(status) &&
      existingOrder.status === 'confirmed';

    let _updatedOrder;
    if (shouldUpdateInventory) {
      // 使用事务处理库存更新
      _updatedOrder = await withTransaction(async tx => {
        // 更新订单状态
        const order = await tx.salesOrder.update({
          where: { id },
          data: {
            ...(status && { status }),
            ...(remarks !== undefined && { remarks }),
          },
        });

        // 更新库存（减少可用库存）
        for (const item of existingOrder.items) {
          // 查找对应的库存记录
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              colorCode: item.colorCode,
              productionDate: item.productionDate
                ? new Date(item.productionDate)
                : null,
            },
          });

          if (inventory) {
            // 检查库存是否足够
            const availableQuantity =
              inventory.quantity - inventory.reservedQuantity;
            if (availableQuantity < item.quantity) {
              throw new Error(
                `产品 ${item.product.name} (色号: ${item.colorCode || '无'}) 库存不足`
              );
            }

            // 减少库存
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: inventory.quantity - item.quantity,
              },
            });
          } else {
            throw new Error(
              `产品 ${item.product.name} (色号: ${item.colorCode || '无'}) 库存记录不存在`
            );
          }
        }

        return order;
      });
    } else {
      // 普通状态更新，不涉及库存
      _updatedOrder = await prisma.salesOrder.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(remarks !== undefined && { remarks }),
        },
      });
    }

    // 获取更新后的完整订单信息
    const fullOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        totalAmount: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    // 转换数据格式
    if (!fullOrder) {
      return NextResponse.json(
        { success: false, error: '订单更新失败' },
        { status: 500 }
      );
    }

    const formattedOrder = {
      id: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      customerId: fullOrder.customerId,
      userId: fullOrder.userId,
      status: fullOrder.status,
      totalAmount: fullOrder.totalAmount,
      remarks: fullOrder.remarks,
      customer: fullOrder.customer,
      user: fullOrder.user,
      items: fullOrder.items.map(item => ({
        id: item.id,
        productId: item.productId,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        product: item.product,
      })),
      createdAt: fullOrder.createdAt,
      updatedAt: fullOrder.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedOrder,
      message: '销售订单更新成功',
    });
  } catch (error) {
    console.error('更新销售订单错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新销售订单失败',
      },
      { status: 500 }
    );
  }
}
