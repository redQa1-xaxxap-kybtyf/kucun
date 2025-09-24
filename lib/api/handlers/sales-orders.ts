import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import type { SalesOrderWithDetails } from '@/lib/types/sales-order';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';

/**
 * 销售订单查询参数验证
 */
export const salesOrderQuerySchema = z.object({
  page: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? parseInt(val) : 1))
    .refine(val => val > 0, '页码必须大于0'),
  limit: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? parseInt(val) : 20))
    .refine(val => val > 0 && val <= 100, '每页数量必须在1-100之间'),
  search: z
    .string()
    .nullable()
    .optional()
    .transform(val => val?.trim() || undefined),
  sortBy: z.string().nullable().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).nullable().optional().default('desc'),
  status: z
    .enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
    .nullable()
    .optional(),
  customerId: z.string().nullable().optional(),
  startDate: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
});

export type SalesOrderQueryParams = z.infer<typeof salesOrderQuerySchema>;

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
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        costPrice: item.costPrice,
        profitAmount: item.profitAmount,
        remarks: item.remarks,
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
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null
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
    totalAmount += item.totalPrice;
    costAmount += item.costPrice * item.quantity;
    profitAmount += item.profitAmount;
  }

  // 创建订单
  const order = await prisma.salesOrder.create({
    data: {
      orderNumber,
      customerId: validatedData.customerId,
      userId,
      supplierId: validatedData.supplierId,
      status: validatedData.status || 'pending',
      orderType: validatedData.orderType,
      costAmount,
      profitAmount,
      totalAmount,
      remarks: validatedData.remarks,
      items: {
        create: validatedData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          costPrice: item.costPrice,
          profitAmount: item.profitAmount,
          remarks: item.remarks,
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

  // 记录销售订单创建日志
  try {
    await logBusinessOperation(
      'create_sales_order',
      `创建销售订单：${order.orderNumber} - 客户：${order.customer?.name || '未知'} - 金额：¥${totalAmount.toFixed(2)}`,
      userId,
      ipAddress,
      userAgent,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customer?.name,
        totalAmount,
        itemCount: validatedData.items.length,
        status: order.status,
      }
    );
  } catch (logError) {
    console.error('记录销售订单创建日志失败:', logError);
    // 不影响主要业务流程
  }

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
        startsWith: `SO${dateStr}`,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `SO${dateStr}${sequence.toString().padStart(4, '0')}`;
}
