// 退货订单API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import {
  createReturnOrderSchema,
  returnOrderQuerySchema,
} from '@/lib/validations/return-order';

/**
 * GET /api/return-orders - 获取退货订单列表
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = returnOrderQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      page = 1,
      pageSize = paginationConfig.defaultPageSize,
      search,
      customerId,
      salesOrderId,
      status,
      type,
      processType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validationResult.data;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { returnNumber: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        {
          salesOrder: {
            orderNumber: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (salesOrderId) {
      where.salesOrderId = salesOrderId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (processType) {
      where.processType = processType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 查询数据
    const [returnOrders, total] = await Promise.all([
      prisma.returnOrder.findMany({
        where,
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
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.returnOrder.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        returnOrders,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('获取退货订单列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取退货订单列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/return-orders - 创建退货订单
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
    const validationResult = createReturnOrderSchema.safeParse(body);

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

    const data = validationResult.data;

    // 验证销售订单是否存在
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!salesOrder) {
      return NextResponse.json(
        { success: false, error: '销售订单不存在' },
        { status: 404 }
      );
    }

    // 验证客户ID是否匹配
    if (salesOrder.customerId !== data.customerId) {
      return NextResponse.json(
        { success: false, error: '客户信息不匹配' },
        { status: 400 }
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

    // 使用事务创建退货订单
    const returnOrder = await prisma.$transaction(async tx => {
      // 生成退货单号
      const returnNumber = `RT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // 计算退货总金额
      const totalAmount = data.items.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const refundAmount = totalAmount; // 默认退款金额等于退货金额

      // 创建退货订单
      const newReturnOrder = await tx.returnOrder.create({
        data: {
          returnNumber,
          salesOrderId: data.salesOrderId,
          customerId: data.customerId,
          userId: session.user.id,
          type: data.type,
          processType: data.processType,
          status: 'draft',
          reason: data.reason,
          remarks: data.remarks,
          totalAmount,
          refundAmount,
        },
      });

      // 创建退货明细
      await tx.returnOrderItem.createMany({
        data: data.items.map(item => ({
          returnOrderId: newReturnOrder.id,
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

      return newReturnOrder;
    });

    // 获取完整的退货订单信息
    const fullReturnOrder = await prisma.returnOrder.findUnique({
      where: { id: returnOrder.id },
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

    return NextResponse.json({
      success: true,
      data: fullReturnOrder,
      message: '退货订单创建成功',
    });
  } catch (error) {
    console.error('创建退货订单失败:', error);
    return NextResponse.json(
      { success: false, error: '创建退货订单失败' },
      { status: 500 }
    );
  }
}
