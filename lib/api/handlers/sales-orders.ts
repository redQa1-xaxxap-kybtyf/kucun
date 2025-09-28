import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@/lib/db';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';
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
        costSubtotal:
          item.costSubtotal ||
          (item.unitCost || item.costPrice || 0) * item.quantity,
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

  // 生成订单号 - 使用新的安全生成服务
  const orderNumber = await generateSalesOrderNumber();

  // 计算订单金额
  let totalAmount = 0;
  let costAmount = 0;
  let profitAmount = 0;

  for (const item of validatedData.items) {
    totalAmount += item.subtotal || 0;
    costAmount += (item.unitCost || 0) * item.quantity;
    profitAmount += item.profitAmount || 0;
  }

  // 使用事务创建订单，确保数据一致性
  const order = await prisma.$transaction(
    async tx => {
      // 验证客户是否存在
      const customer = await tx.customer.findUnique({
        where: { id: validatedData.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error('指定的客户不存在');
      }

      // 如果有供应商，验证供应商是否存在
      if (validatedData.supplierId) {
        const supplier = await tx.supplier.findUnique({
          where: { id: validatedData.supplierId },
          select: { id: true },
        });
        if (!supplier) {
          throw new Error('指定的供应商不存在');
        }
      }

      // 验证产品是否存在（对于非手动输入的产品）
      for (const item of validatedData.items) {
        if (!item.isManualProduct && item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true },
          });
          if (!product) {
            throw new Error(`产品ID ${item.productId} 不存在`);
          }
        }
      }

      // 创建订单
      const salesOrder = await tx.salesOrder.create({
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

      // 如果是调货销售且状态为confirmed，自动创建应付款记录
      if (
        validatedData.orderType === 'TRANSFER' &&
        validatedData.supplierId &&
        costAmount > 0 &&
        (validatedData.status === 'confirmed' ||
          validatedData.status === 'draft')
      ) {
        // 生成应付款单号
        const payableNumber = `PAY-${Date.now()}-${salesOrder.id.slice(-6)}`;

        // 计算应付款到期日期（默认30天后）
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        // 创建应付款记录
        await tx.payableRecord.create({
          data: {
            payableNumber,
            supplierId: validatedData.supplierId,
            userId,
            sourceType: 'sales_order',
            sourceId: salesOrder.id,
            sourceNumber: salesOrder.orderNumber,
            payableAmount: costAmount,
            remainingAmount: costAmount,
            dueDate,
            status: 'pending',
            paymentTerms: '30天',
            description: `调货销售订单 ${salesOrder.orderNumber} 自动生成应付款`,
            remarks: `关联销售订单：${salesOrder.orderNumber}，成本金额：¥${costAmount.toFixed(2)}`,
          },
        });
      }

      return salesOrder;
    },
    {
      isolationLevel: 'Serializable',
      timeout: 15000, // 15秒超时
    }
  );

  return formatSalesOrder(order);
}

// 订单号生成逻辑已移至 lib/services/order-number-generator.ts
// 使用数据库序列表保证并发安全
