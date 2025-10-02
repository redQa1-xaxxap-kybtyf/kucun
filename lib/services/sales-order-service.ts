import { prisma } from '@/lib/db';

/**
 * 销售订单服务层
 * 提取复杂的业务逻辑,保持 API 路由简洁
 */

// 可退货明细项类型
export interface ReturnableItem {
  salesOrderItemId: string;
  productId: string;
  product: {
    id: string;
    name: string;
    code: string;
    unit: string;
    specification: string | null;
  };
  originalQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  unitPrice: number;
  maxReturnAmount: number;
  colorCode: string | null;
  productionDate: string | null;
  batchNumber: string | null;
  variantId: string | null;
}

// 可退货明细响应类型
export interface ReturnableItemsResponse {
  salesOrder: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    customer: {
      id: string;
      name: string;
      phone: string | null;
    };
    createdAt: Date;
  };
  returnableItems: ReturnableItem[];
  summary: {
    totalItems: number;
    returnableItems: number;
    maxReturnAmount: number;
  };
}

/**
 * 获取销售订单的可退货明细
 * @param orderId 销售订单ID
 * @returns 可退货明细数据
 */
export async function getReturnableItems(
  orderId: string
): Promise<ReturnableItemsResponse> {
  // 查询销售订单及其明细
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
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
          id: 'asc',
        },
      },
    },
  });

  if (!salesOrder) {
    throw new Error('销售订单不存在');
  }

  // 检查订单状态是否允许退货
  const allowedStatuses = ['confirmed', 'shipped', 'completed'];
  if (!allowedStatuses.includes(salesOrder.status)) {
    throw new Error(`订单状态为 ${salesOrder.status}，不允许退货`);
  }

  // 查询已退货数量
  const existingReturns = await prisma.returnOrderItem.findMany({
    where: {
      returnOrder: {
        salesOrderId: orderId,
        status: {
          not: 'cancelled', // 排除已取消的退货订单
        },
      },
    },
    select: {
      salesOrderItemId: true,
      returnQuantity: true,
    },
  });

  // 计算每个明细项的已退货数量
  const returnedQuantities = existingReturns.reduce(
    (acc, item) => {
      const key = item.salesOrderItemId;
      acc[key] = (acc[key] || 0) + item.returnQuantity;
      return acc;
    },
    {} as Record<string, number>
  );

  // 构建可退货明细
  const returnableItems: ReturnableItem[] = salesOrder.items
    .map(item => {
      const returnedQuantity = returnedQuantities[item.id] || 0;
      const availableQuantity = item.quantity - returnedQuantity;

      return {
        salesOrderItemId: item.id,
        productId: item.productId,
        product: item.product,
        originalQuantity: item.quantity,
        returnedQuantity,
        availableQuantity,
        unitPrice: item.unitPrice,
        maxReturnAmount: availableQuantity * item.unitPrice,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        batchNumber: item.batchNumber,
        variantId: item.variantId,
      };
    })
    .filter(item => item.availableQuantity > 0); // 只返回还可以退货的明细

  return {
    salesOrder: {
      id: salesOrder.id,
      orderNumber: salesOrder.orderNumber,
      status: salesOrder.status,
      totalAmount: salesOrder.totalAmount,
      customer: salesOrder.customer,
      createdAt: salesOrder.createdAt,
    },
    returnableItems,
    summary: {
      totalItems: salesOrder.items.length,
      returnableItems: returnableItems.length,
      maxReturnAmount: returnableItems.reduce(
        (sum, item) => sum + item.maxReturnAmount,
        0
      ),
    },
  };
}

