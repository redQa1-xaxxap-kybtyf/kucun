import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@/lib/db';
import { salesOrderConfig } from '@/lib/env';
import type { SalesOrderQueryParams as StandardSalesOrderQueryParams } from '@/lib/types/sales-order';
import {
  salesOrderCreateSchema,
  salesOrderQuerySchema as standardSalesOrderQuerySchema,
} from '@/lib/validations/sales-order';

/**
 * 使用标准的销售订单查询参数验证
 * 统一使用 lib/validations/sales-order.ts 中的定义
 */
export const salesOrderQuerySchema = standardSalesOrderQuerySchema;
export type SalesOrderQueryParams = StandardSalesOrderQueryParams;

/**
 * 获取销售订单列表
 */
export async function getSalesOrders(params: SalesOrderQueryParams) {
  const {
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    status,
    customerId,
    startDate,
    endDate,
  } = params;

  const skip = (page - 1) * limit;

  // 构建查询条件
  const where: Prisma.SalesOrderWhereInput = {};

  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { remarks: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  // 构建排序条件
  const orderBy: Prisma.SalesOrderOrderByWithRelationInput = {};
  if (sortBy === 'customerName') {
    orderBy.customer = { name: sortOrder };
  } else if (sortBy === 'totalAmount') {
    orderBy.totalAmount = sortOrder;
  } else {
    orderBy[sortBy as keyof Prisma.SalesOrderOrderByWithRelationInput] =
      sortOrder;
  }

  // 执行查询
  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
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
        supplier: {
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
                unit: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return {
    orders: orders.map(formatSalesOrder),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 根据ID获取销售订单详情
 */
export async function getSalesOrderById(id: string) {
  const order = await prisma.salesOrder.findUnique({
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
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
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
          createdAt: 'asc',
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  return formatSalesOrder(order);
}

/**
 * 格式化销售订单数据
 */
function formatSalesOrder(order: any): SalesOrderWithDetails {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    userId: order.userId,
    supplierId: order.supplierId,
    status: order.status,
    orderType: order.orderType,
    costAmount: order.costAmount,
    profitAmount: order.profitAmount,
    totalAmount: order.totalAmount,
    remarks: order.remarks,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customer: order.customer
      ? {
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          address: order.customer.address,
        }
      : undefined,
    user: order.user
      ? {
          id: order.user.id,
          name: order.user.name,
        }
      : undefined,
    supplier: order.supplier
      ? {
          id: order.supplier.id,
          name: order.supplier.name,
          phone: order.supplier.phone,
          address: order.supplier.address,
        }
      : undefined,
    items:
      order.items?.map((item: any) => ({
        id: item.id,
        salesOrderId: item.salesOrderId,
        productId: item.productId,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal || item.totalPrice, // 兼容旧字段名
        unitCost: item.unitCost || item.costPrice, // 兼容旧字段名
        costSubtotal: item.costSubtotal || item.costPrice * item.quantity,
        profitAmount: item.profitAmount,
        isManualProduct: item.isManualProduct,
        manualProductName: item.manualProductName,
        manualSpecification: item.manualSpecification,
        manualWeight: item.manualWeight,
        manualUnit: item.manualUnit,
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              code: item.product.code,
              unit: item.product.unit,
              specification: item.product.specification,
            }
          : undefined,
      })) || [],
    itemCount: order._count?.items || order.items?.length || 0,
  };
}

/**
 * 创建销售订单
 */
export async function createSalesOrder(
  data: z.infer<typeof salesOrderCreateSchema>,
  userId: string
) {
  // 验证数据
  const validatedData = salesOrderCreateSchema.parse(data);

  // 生成订单号
  const orderNumber = await generateOrderNumber();

  // 计算订单金额
  let totalAmount = 0;
  let costAmount = 0;
  let profitAmount = 0;

  for (const item of validatedData.items) {
    totalAmount += item.subtotal || 0;
    costAmount += (item.unitCost || 0) * item.quantity;
    profitAmount += item.profitAmount || 0;
  }

  // 创建订单
  const order = await prisma.salesOrder.create({
    data: {
      orderNumber,
      customerId: validatedData.customerId,
      userId,
      supplierId: validatedData.supplierId,
      status: validatedData.status || 'draft',
      orderType: validatedData.orderType,
      costAmount,
      profitAmount,
      totalAmount,
      remarks: validatedData.remarks,
      items: {
        create: validatedData.items.map(item => ({
          productId: item.productId,
          colorCode: item.colorCode,
          productionDate: item.productionDate,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          unitCost: item.unitCost,
          costSubtotal: item.costSubtotal,
          profitAmount: item.profitAmount,
          isManualProduct: item.isManualProduct,
          manualProductName: item.manualProductName,
          manualSpecification: item.manualSpecification,
          manualWeight: item.manualWeight,
          manualUnit: item.manualUnit,
        })),
      },
    },
    include: {
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
      supplier: {
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
              unit: true,
            },
          },
        },
      },
    },
  });

  return formatSalesOrder(order);
}

/**
 * 生成订单号
 */
async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // 查找今天的最后一个订单号
  const lastOrder = await prisma.salesOrder.findFirst({
    where: {
      orderNumber: {
        startsWith: `${salesOrderConfig.orderPrefix}${dateStr}`,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(
      lastOrder.orderNumber.slice(-salesOrderConfig.numberLength)
    );
    sequence = lastSequence + 1;
  }

  return `${salesOrderConfig.orderPrefix}${dateStr}${sequence.toString().padStart(salesOrderConfig.numberLength, '0')}`;
}
