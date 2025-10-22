/**
 * 退货订单服务端 API
 * 用于 Server Components 直接查询数据库
 * 避免在服务端使用 fetch 调用 API
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import type {
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

  return {
    success: true,
    data: {
      returnOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  };
}
