// 退货订单API路由
// 遵循Next.js 15.4 App Router架构和全局约定规范

import { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import type { SalesOrderStatus } from '@/lib/types/sales-order';
import {
  createReturnOrderSchema,
  returnOrderQuerySchema,
} from '@/lib/validations/return-order';

const RETURN_ALLOWED_SALES_ORDER_STATUSES: ReadonlyArray<SalesOrderStatus> = [
  'shipped',
  'completed',
];

const SALES_ORDER_WITH_ITEMS_INCLUDE = {
  items: true,
  customer: true,
} satisfies Prisma.SalesOrderInclude;

type SalesOrderWithItems = Prisma.SalesOrderGetPayload<{
  include: typeof SALES_ORDER_WITH_ITEMS_INCLUDE;
}>;

type SalesOrderItemWithProduct = SalesOrderWithItems['items'][number];

/**
 * GET /api/return-orders - 获取退货订单列表
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = returnOrderQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      page = 1,
      limit = paginationConfig.defaultPageSize,
      search,
      customerId,
      salesOrderId,
      status,
      type,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validationResult.data;

    // 构建查询条件
    type WhereClause = {
      OR?: Array<{
        returnNumber?: { contains: string };
        reason?: { contains: string };
        customer?: { name: { contains: string } };
        salesOrder?: { orderNumber: { contains: string } };
      }>;
      customerId?: string;
      salesOrderId?: string;
      status?: string;
      type?: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    };

    const where: WhereClause = {};

    if (search) {
      where.OR = [
        { returnNumber: { contains: search } },
        { reason: { contains: search } },
        { customer: { name: { contains: search } } },
        {
          salesOrder: {
            orderNumber: { contains: search },
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
              address: true,
            },
          },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          items: true,
          refunds: {
            select: {
              id: true,
              refundAmount: true,
              refundDate: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.returnOrder.count({ where }),
    ]);

    // 手动获取产品信息
    const productIds = returnOrders
      .flatMap(order => order.items.map(item => item.productId))
      .filter(Boolean) as string[];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        code: true,
        unit: true,
      },
    });

    const productsMap = new Map(products.map(p => [p.id, p]));

    // 合并产品信息到退货订单
    const enrichedReturnOrders = returnOrders.map(order => ({
      ...order,
      items: order.items.map(item => ({
        ...item,
        product: item.productId
          ? productsMap.get(item.productId) || null
          : null,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        returnOrders: enrichedReturnOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  },
  { permissions: ['returns:view'] }
);

/**
 * POST /api/return-orders - 创建退货订单
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const userId = user.id;

    try {
      // 解析请求体
      const body = await request.json();
      const validationResult = createReturnOrderSchema.safeParse(body);

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

      // 根据退货模式进行不同的验证逻辑
      let salesOrder: SalesOrderWithItems | null = null;
      const salesOrderItemsMap = new Map<string, SalesOrderItemWithProduct>();

      if (data.returnMode === 'single_order') {
        // 单订单模式：验证指定的销售订单
        if (!data.salesOrderId || data.salesOrderId.trim() === '') {
          return NextResponse.json(
            { success: false, error: '单订单模式下销售订单ID不能为空' },
            { status: 400 }
          );
        }

        salesOrder = await prisma.salesOrder.findUnique({
          where: { id: data.salesOrderId.trim() },
          include: SALES_ORDER_WITH_ITEMS_INCLUDE,
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
        const orderStatus = salesOrder.status as SalesOrderStatus;
        if (!RETURN_ALLOWED_SALES_ORDER_STATUSES.includes(orderStatus)) {
          return NextResponse.json(
            {
              success: false,
              error: `销售订单尚未发货，无法退货（当前状态：${salesOrder.status}）`,
            },
            { status: 400 }
          );
        }

        // 构建 salesOrderItemsMap
        salesOrder.items.forEach(item => {
          salesOrderItemsMap.set(item.id, item);
        });
      } else {
        // 多订单模式：需要查询每个退货明细对应的销售订单明细
        const salesOrderItemIds = data.items.map(item => item.salesOrderItemId);

        const salesOrderItems = await prisma.salesOrderItem.findMany({
          where: {
            id: { in: salesOrderItemIds },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            salesOrder: {
              include: {
                customer: true,
              },
            },
          },
        });

        // 验证所有产品都找到了
        if (salesOrderItems.length !== data.items.length) {
          return NextResponse.json(
            { success: false, error: '部分销售订单明细不存在' },
            { status: 404 }
          );
        }

        // 验证所有产品都属于同一个客户
        const customerIds = new Set(
          salesOrderItems.map(item => item.salesOrder.customerId)
        );
        if (customerIds.size > 1) {
          return NextResponse.json(
            { success: false, error: '退货产品必须属于同一个客户' },
            { status: 400 }
          );
        }

        // 验证客户ID是否匹配
        const firstCustomerId = salesOrderItems[0].salesOrder.customerId;
        if (firstCustomerId !== data.customerId) {
          return NextResponse.json(
            { success: false, error: '客户信息不匹配' },
            { status: 400 }
          );
        }

        // 检查所有订单状态是否允许退货
        for (const item of salesOrderItems) {
          const itemStatus = item.salesOrder.status as SalesOrderStatus;
          if (!RETURN_ALLOWED_SALES_ORDER_STATUSES.includes(itemStatus)) {
            return NextResponse.json(
              {
                success: false,
                error: `订单 ${item.salesOrder.orderNumber} 尚未发货，无法退货（当前状态：${item.salesOrder.status}）`,
              },
              { status: 400 }
            );
          }
        }

        // 构建 salesOrderItemsMap
        salesOrderItems.forEach(item => {
          salesOrderItemsMap.set(item.id, item);
        });
      }

      // 生成退货单号 - 使用安全的订单号生成服务
      const { generateReturnOrderNumber } = await import(
        '@/lib/services/simple-order-number-generator'
      );
      const returnNumber = await generateReturnOrderNumber();

      // 服务器端重新计算并验证金额
      const calculatedTotalAmount = data.items.reduce((sum, item) => {
        // 重新计算每个明细的小计：
        // 应计价数量 = 退货数量 - 破损数量（破损不退款，数量下限为 0）
        const damagedQuantity = item.damagedQuantity ?? 0;
        const effectiveQuantity = Math.max(
          item.returnQuantity - damagedQuantity,
          0
        );
        const calculatedSubtotal =
          Math.round(effectiveQuantity * item.unitPrice * 100) / 100;

        // 验证前端传入的小计是否正确
        if (Math.abs(item.subtotal - calculatedSubtotal) > 0.01) {
          throw new Error(
            `退货明细金额计算错误。产品ID: ${item.productId}, 前端: ${item.subtotal}, 服务器: ${calculatedSubtotal}`
          );
        }

        return sum + calculatedSubtotal;
      }, 0);

      // ✅ 使用 Serializable 事务防止并发退货导致超额退货
      const returnOrder = await prisma.$transaction(
        async tx => {
          // 在事务内批量查询已退货数量
          const salesOrderItemIds = data.items.map(
            item => item.salesOrderItemId
          );
          const existingReturnsMap = await tx.returnOrderItem.groupBy({
            by: ['salesOrderItemId'],
            where: {
              salesOrderItemId: { in: salesOrderItemIds },
              returnOrder: {
                status: {
                  notIn: ['cancelled', 'rejected'],
                },
              },
            },
            _sum: {
              returnQuantity: true,
            },
          });

          // 转换为 Map 快速查找
          const returnsMap = new Map(
            existingReturnsMap.map(r => [
              r.salesOrderItemId,
              r._sum.returnQuantity || 0,
            ])
          );

          // 验证每个退货明细
          for (const returnItem of data.items) {
            const salesOrderItem = salesOrderItemsMap.get(
              returnItem.salesOrderItemId
            );

            if (!salesOrderItem) {
              throw new Error(
                `销售订单明细不存在: ${returnItem.salesOrderItemId}`
              );
            }

            // ✅ 修复：校验前端传来的单价是否与数据库中的真实单价一致
            const dbUnitPrice = salesOrderItem.unitPrice;
            if (Math.abs(returnItem.unitPrice - dbUnitPrice) > 0.01) {
              const productName =
                (
                  salesOrderItem as {
                    product?: { name?: string | null };
                  }
                ).product?.name || '未知产品';
              throw new Error(
                `产品 ${productName} 退货单价与销售订单单价不一致。` +
                  `销售单价: ${dbUnitPrice}, 退货单价: ${returnItem.unitPrice}`
              );
            }

            const alreadyReturnedQuantity: number =
              returnsMap.get(returnItem.salesOrderItemId) || 0;
            const remainingQuantity: number =
              salesOrderItem.quantity - alreadyReturnedQuantity;

            // 验证退货数量
            if (returnItem.returnQuantity > remainingQuantity) {
              const productName =
                (
                  salesOrderItem as {
                    product?: { name?: string | null };
                  }
                ).product?.name || '未知产品';
              throw new Error(
                `产品 ${productName} 退货数量超过可退数量。` +
                  `已购买: ${salesOrderItem.quantity}, 已退货: ${alreadyReturnedQuantity}, ` +
                  `可退: ${remainingQuantity}, 本次退货: ${returnItem.returnQuantity}`
              );
            }
          }
          // 使用服务器计算的金额
          const totalAmount = calculatedTotalAmount;
          const refundAmount = calculatedTotalAmount;

          // 创建退货订单
          const newReturnOrder = await tx.returnOrder.create({
            data: {
              returnNumber,
              returnMode: data.returnMode || 'single_order',
              salesOrderId: data.salesOrderId || null,
              customerId: data.customerId,
              userId,
              type: data.type,
              processType: data.processType,
              status: 'draft',
              reason: data.reason || null,
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
              damagedQuantity: item.damagedQuantity || 0,
              originalQuantity: item.originalQuantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              reason: item.reason,
            })),
          });

          return newReturnOrder;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000, // 15秒超时
        }
      );

      // 获取完整的退货订单信息
      const fullReturnOrder = await prisma.returnOrder.findUnique({
        where: { id: returnOrder.id },
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
            },
          },
          items: true,
          refunds: {
            select: {
              id: true,
              refundAmount: true,
              refundDate: true,
            },
          },
        },
      });

      if (!fullReturnOrder) {
        return NextResponse.json(
          { success: false, error: '退货订单创建失败' },
          { status: 500 }
        );
      }

      // 手动获取产品信息
      const productIds = fullReturnOrder.items
        .map(item => item.productId)
        .filter(Boolean) as string[];

      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
        },
      });

      const productsMap = new Map(products.map(p => [p.id, p]));

      // 合并产品信息到退货订单
      const enrichedReturnOrder = {
        ...fullReturnOrder,
        items: fullReturnOrder.items.map(item => ({
          ...item,
          product: item.productId
            ? productsMap.get(item.productId) || null
            : null,
        })),
      };

      return NextResponse.json({
        success: true,
        data: enrichedReturnOrder,
        message: '退货订单创建成功',
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : '创建退货订单时发生错误';
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['returns:create'] }
);
