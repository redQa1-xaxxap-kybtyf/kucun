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

// 订单状态更新数据类型
export interface UpdateOrderStatusData {
  status: string;
  remarks?: string;
}

// 订单状态更新结果类型
export interface UpdateOrderStatusResult {
  order: {
    id: string;
    orderNumber: string;
    customerId: string;
    userId: string;
    status: string;
    totalAmount: number;
    remarks: string | null;
    customer: {
      id: string;
      name: string;
      phone: string | null;
    };
    user: {
      id: string;
      name: string;
    };
    items: Array<{
      id: string;
      productId: string;
      colorCode: string | null;
      productionDate: string | null;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      product: {
        id: string;
        code: string;
        name: string;
        unit: string;
      };
    }>;
    createdAt: Date;
    updatedAt: Date;
  };
  inventoryUpdated: boolean;
  reservedInventoryReleased: boolean;
}

/**
 * 验证订单状态流转规则
 * @param currentStatus 当前状态
 * @param newStatus 新状态
 * @returns 是否允许流转
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: string } {
  const validStatusTransitions: Record<string, string[]> = {
    draft: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['completed'],
    completed: [], // 已完成的订单不能再变更状态
    cancelled: [], // 已取消的订单不能再变更状态
  };

  if (newStatus === currentStatus) {
    return { valid: true };
  }

  const allowedStatuses = validStatusTransitions[currentStatus] || [];
  if (!allowedStatuses.includes(newStatus)) {
    return {
      valid: false,
      error: `订单状态不能从 ${currentStatus} 变更为 ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * 创建调货销售的应付款记录
 * @param orderId 订单ID
 * @param orderNumber 订单号
 * @param supplierId 供应商ID
 * @param costAmount 成本金额
 * @param userId 用户ID
 */
export async function createTransferPayableRecord(
  orderId: string,
  orderNumber: string,
  supplierId: string,
  costAmount: number,
  userId: string
): Promise<void> {
  await prisma.$transaction(async tx => {
    // 检查是否已经存在应付款记录
    const existingPayable = await tx.payableRecord.findFirst({
      where: {
        sourceType: 'sales_order',
        sourceId: orderId,
      },
    });

    // 如果不存在应付款记录,则创建
    if (!existingPayable) {
      // 生成应付款单号
      const payableNumber = `PAY-${Date.now()}-${orderId.slice(-6)}`;

      // 计算应付款到期日期(默认30天后)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // 创建应付款记录
      await tx.payableRecord.create({
        data: {
          payableNumber,
          supplierId,
          userId,
          sourceType: 'sales_order',
          sourceId: orderId,
          sourceNumber: orderNumber,
          payableAmount: costAmount,
          remainingAmount: costAmount,
          dueDate,
          status: 'pending',
          paymentTerms: '30天',
          description: `调货销售订单 ${orderNumber} 确认后自动生成应付款`,
          remarks: `关联销售订单：${orderNumber}，成本金额：¥${costAmount.toFixed(2)}`,
        },
      });
    }
  });
}
