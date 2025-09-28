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
        orderType: true,
        supplierId: true,
        costAmount: true,
        profitAmount: true,
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
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
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

    // 如果状态变更为已取消，需要释放预留库存
    const shouldReleaseReservedInventory =
      status &&
      status === 'cancelled' &&
      ['confirmed'].includes(existingOrder.status);

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
          // 修复：使用正确的字段查找库存记录
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
              batchNumber: item.batchNumber || null,
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

            // 修复：减少库存时同步减少预留量
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: inventory.quantity - item.quantity,
                // 同步减少预留量，确保预留量不超过实际库存
                reservedQuantity: Math.max(
                  0,
                  Math.min(
                    inventory.reservedQuantity,
                    inventory.quantity - item.quantity
                  )
                ),
              },
            });
          } else {
            throw new Error(
              `产品 ${item.product.name} (变体: ${item.variantId || '无'}, 批次: ${item.batchNumber || '无'}) 库存记录不存在`
            );
          }
        }

        return order;
      });

      // 修复：库存变更后清除缓存
      const { invalidateInventoryCache } = await import(
        '@/lib/cache/inventory-cache'
      );
      for (const item of existingOrder.items) {
        await invalidateInventoryCache(item.productId);
      }
    } else if (shouldReleaseReservedInventory) {
      // 订单取消时释放预留库存
      _updatedOrder = await withTransaction(async tx => {
        // 更新订单状态
        const order = await tx.salesOrder.update({
          where: { id },
          data: {
            ...(status && { status }),
            ...(remarks !== undefined && { remarks }),
          },
        });

        // 释放预留库存
        for (const item of existingOrder.items) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
              batchNumber: item.batchNumber || null,
            },
          });

          if (inventory && inventory.reservedQuantity > 0) {
            // 释放预留量，但不能超过当前预留量
            const releaseQuantity = Math.min(
              item.quantity,
              inventory.reservedQuantity
            );

            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reservedQuantity: inventory.reservedQuantity - releaseQuantity,
              },
            });
          }
        }

        return order;
      });

      // 修复：预留库存释放后清除缓存
      const { invalidateInventoryCache } = await import(
        '@/lib/cache/inventory-cache'
      );
      for (const item of existingOrder.items) {
        await invalidateInventoryCache(item.productId);
      }
    } else {
      // 普通状态更新，不涉及库存
      // 但需要检查是否需要创建应付款记录
      _updatedOrder = await prisma.$transaction(async tx => {
        // 更新订单状态
        const updatedOrder = await tx.salesOrder.update({
          where: { id },
          data: {
            ...(status && { status }),
            ...(remarks !== undefined && { remarks }),
          },
        });

        // 如果是调货销售且状态变更为confirmed，检查是否需要创建应付款记录
        if (
          status === 'confirmed' &&
          existingOrder.orderType === 'TRANSFER' &&
          existingOrder.supplierId &&
          existingOrder.costAmount > 0
        ) {
          // 检查是否已经存在应付款记录
          const existingPayable = await tx.payableRecord.findFirst({
            where: {
              sourceType: 'sales_order',
              sourceId: existingOrder.id,
            },
          });

          // 如果不存在应付款记录，则创建
          if (!existingPayable) {
            // 生成应付款单号
            const payableNumber = `PAY-${Date.now()}-${existingOrder.id.slice(-6)}`;

            // 计算应付款到期日期（默认30天后）
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);

            // 创建应付款记录
            await tx.payableRecord.create({
              data: {
                payableNumber,
                supplierId: existingOrder.supplierId,
                userId: existingOrder.userId,
                sourceType: 'sales_order',
                sourceId: existingOrder.id,
                sourceNumber: existingOrder.orderNumber,
                payableAmount: existingOrder.costAmount,
                remainingAmount: existingOrder.costAmount,
                dueDate,
                status: 'pending',
                paymentTerms: '30天',
                description: `调货销售订单 ${existingOrder.orderNumber} 确认后自动生成应付款`,
                remarks: `关联销售订单：${existingOrder.orderNumber}，成本金额：¥${existingOrder.costAmount.toFixed(2)}`,
              },
            });
          }
        }

        return updatedOrder;
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
