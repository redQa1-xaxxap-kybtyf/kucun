/**
 * 退货订单服务端 API
 * 用于 Server Components 直接查询数据库
 * 避免在服务端使用 fetch 调用 API
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import type { Product } from '@/lib/types/product';
import type {
  ReturnOrder,
  ReturnOrderItem,
  ReturnOrderListResponse,
  ReturnOrderQueryParams,
} from '@/lib/types/return-order';

/**
 * 服务端获取退货订单列表
 * 直接查询数据库，不通过 API 路由
 */
export async function getReturnOrdersServer(
  params: ReturnOrderQueryParams = {}
): Promise<ReturnOrderListResponse> {
  const {
    page = 1,
    limit = paginationConfig.defaultPageSize,
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
  } = params;

  // 构建查询条件
  const where: Prisma.ReturnOrderWhereInput = {};

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

  if (processType) {
    where.processType = processType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(`${startDate}T00:00:00`);
    }
    if (endDate) {
      where.createdAt.lte = new Date(`${endDate}T23:59:59`);
    }
  }

  // 构建排序
  const orderByMap: Record<
    string,
    keyof Prisma.ReturnOrderOrderByWithRelationInput
  > = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    returnNumber: 'returnNumber',
    totalAmount: 'totalAmount',
  };

  const orderByField = orderByMap[sortBy] || 'createdAt';
  const orderBy: Prisma.ReturnOrderOrderByWithRelationInput = {
    [orderByField]: sortOrder,
  };

  // 计算分页
  const skip = (page - 1) * limit;

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
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                unit: true,
              },
            },
          },
        },
        refundRecords: {
          select: {
            id: true,
            refundAmount: true,
            refundDate: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.returnOrder.count({ where }),
  ]);

  // 计算总页数
  const totalPages = Math.ceil(total / limit);

  const formattedReturnOrders: ReturnOrder[] = returnOrders.map(order => {
    const processedAmountValue = (order as {
      processedAmount?: number | null;
    }).processedAmount;
    const remainingAmountValue = (order as {
      remainingAmount?: number | null;
    }).remainingAmount;

    return {
      id: order.id,
      returnNumber: order.returnNumber,
      returnMode: (order.returnMode ??
        'single_order') as ReturnOrder['returnMode'],
      salesOrderId: order.salesOrderId ?? undefined,
      customerId: order.customerId,
      userId: order.userId,
      type: order.type as ReturnOrder['type'],
      processType: order.processType as ReturnOrder['processType'],
      status: order.status as ReturnOrder['status'],
      reason: order.reason ?? '',
      totalAmount: Number(order.totalAmount),
      refundAmount: Number(order.refundAmount),
      processedAmount:
        processedAmountValue === undefined || processedAmountValue === null
          ? undefined
          : Number(processedAmountValue),
      remainingAmount:
        remainingAmountValue === undefined || remainingAmountValue === null
          ? undefined
          : Number(remainingAmountValue),
      remarks: order.remarks ?? undefined,
      submittedAt: order.submittedAt?.toISOString(),
      approvedAt: order.approvedAt?.toISOString(),
      processedAt: order.processedAt?.toISOString(),
      completedAt: order.completedAt?.toISOString(),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      salesOrder: order.salesOrder
        ? {
            id: order.salesOrder.id,
            orderNumber: order.salesOrder.orderNumber,
          }
        : undefined,
      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            phone: order.customer.phone ?? undefined,
            address: order.customer.address ?? undefined,
          }
        : undefined,
      items: order.items.map(item => {
        const conditionValue = (item as {
          condition?: ReturnOrderItem['condition'];
        }).condition;

        return {
          id: item.id,
          returnOrderId: item.returnOrderId,
          salesOrderItemId: item.salesOrderItemId,
          productId: item.productId,
          colorCode: item.colorCode ?? undefined,
          productionDate: item.productionDate ?? undefined,
          returnQuantity: Number(item.returnQuantity),
          damagedQuantity:
            item.damagedQuantity && item.damagedQuantity > 0
              ? Number(item.damagedQuantity)
              : undefined,
          originalQuantity: Number(item.originalQuantity),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
          reason: item.reason ?? undefined,
          condition: (conditionValue ?? 'good') as ReturnOrderItem['condition'],
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                code: item.product.code,
                unit: item.product.unit as Product['unit'],
              }
            : undefined,
        };
      }),
      refundRecords: order.refundRecords.map(record => ({
        id: record.id,
        refundAmount: Number(record.refundAmount),
        refundDate: record.refundDate.toISOString(),
      })),
    };
  });

  return {
    success: true,
    data: {
      returnOrders: formattedReturnOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  };
}
