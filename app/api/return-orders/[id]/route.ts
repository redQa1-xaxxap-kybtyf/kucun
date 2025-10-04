// 退货订单详情API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { updateReturnOrderSchema } from '@/lib/validations/return-order';

/**
 * GET /api/return-orders/[id] - 获取退货订单详情
 */
export const GET = withAuth(
  async (request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    // 查询退货订单详情
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
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
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
            salesOrderItem: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                subtotal: true,
              },
            },
          },
        },
      },
    });

    if (!returnOrder) {
      return NextResponse.json(
        { success: false, error: '退货订单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: returnOrder,
    });
  },
  { permissions: ['returns:view'] }
);

/**
 * PUT /api/return-orders/[id] - 更新退货订单
 */
export const PUT = withAuth(
  async (request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    // 解析请求体
    const body = await request.json();
    const validationResult = updateReturnOrderSchema.safeParse({
      id,
      ...body,
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

    const data = validationResult.data;

    // 检查退货订单是否存在
    const existingReturnOrder = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingReturnOrder) {
      return NextResponse.json(
        { success: false, error: '退货订单不存在' },
        { status: 404 }
      );
    }

    // 检查是否可以编辑
    if (!['draft', 'submitted'].includes(existingReturnOrder.status)) {
      return NextResponse.json(
        { success: false, error: '当前状态下不允许编辑' },
        { status: 400 }
      );
    }

    // 使用事务更新退货订单
    const updatedReturnOrder = await prisma.$transaction(async tx => {
      // 更新退货订单基本信息
      const updateData: {
        updatedAt: Date;
        customerId?: string;
        returnDate?: Date;
        reason?: string;
        remarks?: string;
        status?: string;
      } = {
        updatedAt: new Date(),
      };

      if (data.type) {
        updateData.type = data.type;
      }
      if (data.processType) {
        updateData.processType = data.processType;
      }
      if (data.reason) {
        updateData.reason = data.reason;
      }
      if (data.remarks !== undefined) {
        updateData.remarks = data.remarks;
      }

      // 如果有明细项更新
      if (data.items) {
        // 删除原有明细
        await tx.returnOrderItem.deleteMany({
          where: { returnOrderId: id },
        });

        // 创建新明细
        await tx.returnOrderItem.createMany({
          data: data.items.map(item => ({
            returnOrderId: id,
            salesOrderItemId: item.salesOrderItemId,
            productId: item.productId,
            colorCode: item.colorCode,
            productionDate: item.productionDate,
            returnQuantity: item.returnQuantity,
            originalQuantity: item.originalQuantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            reason: item.reason,
            condition: item.condition,
          })),
        });

        // 重新计算总金额
        const totalAmount = data.items.reduce(
          (sum, item) => sum + item.subtotal,
          0
        );
        updateData.totalAmount = totalAmount;
        updateData.refundAmount = totalAmount;
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
                  code: true,
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
      message: '退货订单更新成功',
    });
  },
  { permissions: ['returns:edit'] }
);

/**
 * DELETE /api/return-orders/[id] - 删除退货订单
 */
export const DELETE = withAuth(
  async (request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    // 检查退货订单是否存在
    const existingReturnOrder = await prisma.returnOrder.findUnique({
      where: { id },
      select: { id: true, status: true, returnNumber: true },
    });

    if (!existingReturnOrder) {
      return NextResponse.json(
        { success: false, error: '退货订单不存在' },
        { status: 404 }
      );
    }

    // 检查是否可以删除
    if (!['draft'].includes(existingReturnOrder.status)) {
      return NextResponse.json(
        { success: false, error: '只有草稿状态的退货订单可以删除' },
        { status: 400 }
      );
    }

    // 使用事务删除退货订单
    await prisma.$transaction(async tx => {
      // 删除退货明细
      await tx.returnOrderItem.deleteMany({
        where: { returnOrderId: id },
      });

      // 删除退货订单
      await tx.returnOrder.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: '退货订单删除成功',
    });
  },
  { permissions: ['returns:delete'] }
);
