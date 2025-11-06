'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';

import {
  executeMinimalInboundTransaction,
  type MinimalInboundTransactionResult,
} from '@/lib/api/minimal-inbound-transaction';
import {
  calculatePurchaseOrderExecution,
  refreshPurchaseOrderFulfillment,
} from '@/lib/api/purchase-orders/fulfillment';
import { authOptions } from '@/lib/auth';
import { revalidateProducts } from '@/lib/cache';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { generatePurchaseOrderNumber } from '@/lib/services/simple-order-number-generator';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { generatePayableNumber } from '@/lib/utils/payment-number-generator';

import {
  createPurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  type PurchaseOrderFormData,
} from './purchase-orders.schemas';

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function parseJsonPayload<T>(formData: FormData, key: string): T {
  const jsonStr = formData.get(key);
  if (typeof jsonStr !== 'string') {
    throw new Error(`Missing or invalid ${key} field`);
  }
  return JSON.parse(jsonStr) as T;
}

/**
 * 创建采购订单
 */
export async function createPurchaseOrder(
  formData: FormData
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = parseJsonPayload<PurchaseOrderFormData>(formData, 'data');
    const data = createPurchaseOrderSchema.parse(rawData);

    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    const result = await prisma.$transaction(async tx => {
      const orderNumber = await generatePurchaseOrderNumber();
      const status: PurchaseOrderStatus =
        (data.status as PurchaseOrderStatus | undefined) ??
        PURCHASE_ORDER_STATUS.DRAFT;
      const trimmedContainer = data.containerNumber?.trim();

      const order = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          containerNumber:
            trimmedContainer && trimmedContainer.length > 0
              ? trimmedContainer
              : null,
          supplierId: data.supplierId,
          status,
          totalAmount,
          orderDate: data.orderDate ? new Date(data.orderDate) : undefined,
          shipmentDate: data.shipmentDate
            ? new Date(data.shipmentDate)
            : undefined,
          remarks: data.remarks?.trim() || undefined,
          userId: session.user.id,
          items: {
            create: data.items.map(item => ({
              productId: item.productId?.trim() || null,
              supplierId: item.supplierId,
              productCode: item.productCode,
              displayName: item.displayName,
              specification: item.specification?.trim() || null,
              unit: item.unit || 'piece',
              weight: item.weight,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              isManualProduct: item.isManualProduct || false,
              manualProductName: item.manualProductName?.trim() || null,
              manualSpecification: item.manualSpecification?.trim() || null,
              manualWeight: item.manualWeight,
              manualUnit: item.manualUnit?.trim() || null,
              remarks: item.remarks?.trim() || null,
            })),
          },
        },
      });

      if (data.feeItems && data.feeItems.length > 0) {
        const expenseRecords = data.feeItems.map(feeItem => ({
          expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          expenseType: feeItem.feeType,
          expenseName: feeItem.feeName,
          expenseAmount: feeItem.feeAmount,
          expenseDate: new Date(),
          relatedType: 'purchase_order',
          relatedId: order.id,
          relatedNumber: order.orderNumber,
          remarks: feeItem.remarks || undefined,
          userId: session.user.id,
        }));

        await tx.expenseRecord.createMany({
          data: expenseRecords,
        });
      }

      if (status === PURCHASE_ORDER_STATUS.ORDERED && totalAmount > 0) {
        const payableNumber = await generatePayableNumber(tx);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await tx.payableRecord.create({
          data: {
            payableNumber,
            supplierId: data.supplierId,
            userId: session.user.id,
            sourceType: 'purchase_order',
            sourceId: order.id,
            sourceNumber: order.orderNumber,
            payableAmount: totalAmount,
            paidAmount: 0,
            remainingAmount: totalAmount,
            dueDate,
            status: 'pending',
            paymentTerms: '30天',
            remarks: `系统自动生成：采购订单 ${order.orderNumber} 确认应付`,
          },
        });
      }

      return order;
    });

    revalidatePath('/purchase-orders');
    revalidatePath('/finance/expenses');

    return {
      success: true,
      data: { id: result.id, orderNumber: result.orderNumber },
    };
  } catch (error) {
    logger.error('actions:purchase-orders', '创建采购订单失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建采购订单失败',
    };
  }
}

/**
 * 更新采购订单
 */
export async function updatePurchaseOrder(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const orderId = formData.get('orderId') as string;
    const rawData = parseJsonPayload<PurchaseOrderFormData>(formData, 'data');
    const data = updatePurchaseOrderSchema.parse(rawData);

    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existingOrder) {
      return { success: false, error: '采购订单不存在' };
    }

    if (existingOrder.status !== PURCHASE_ORDER_STATUS.DRAFT) {
      return { success: false, error: '只能编辑草稿状态的订单' };
    }

    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    await prisma.$transaction(async tx => {
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: orderId },
      });

      await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          supplierId: data.supplierId,
          containerNumber: data.containerNumber?.trim() || null,
          remarks: data.remarks?.trim() || null,
          totalAmount,
          items: {
            create: data.items.map(item => ({
              productId: item.productId || null,
              supplierId: item.supplierId,
              productCode: item.productCode.trim(),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              unitCost: item.unitPrice,
              manualProductName: item.isManualProduct
                ? item.displayName.trim()
                : null,
              manualUnit: item.isManualProduct ? item.unit : null,
              displayName: item.displayName.trim(),
              specification: item.specification?.trim() || null,
              unit: item.unit,
              weight: item.weight || null,
              remarks: item.remarks?.trim() || null,
            })),
          },
        },
      });

      if (data.feeItems && data.feeItems.length > 0) {
        await tx.expenseRecord.deleteMany({
          where: {
            relatedType: 'purchase_order',
            relatedId: orderId,
          },
        });

        const orderNumber = existingOrder.orderNumber;
        for (const feeItem of data.feeItems) {
          const expenseNumber = await generatePurchaseOrderNumber('EXP');
          await tx.expenseRecord.create({
            data: {
              expenseNumber,
              expenseType: feeItem.expenseType,
              expenseName: feeItem.expenseName.trim(),
              expenseAmount: feeItem.expenseAmount,
              remarks: feeItem.remarks?.trim() || null,
              relatedType: 'purchase_order',
              relatedId: orderId,
              relatedNumber: orderNumber,
            },
          });
        }
      }
    });

    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${orderId}`);

    return { success: true, data: { id: orderId } };
  } catch (error) {
    logger.error('actions:purchase-orders', '更新采购订单失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新采购订单失败',
    };
  }
}

/**
 * 更新采购订单状态
 */
export async function updatePurchaseOrderStatus(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = parseJsonPayload<{
      orderId: string;
      status: PurchaseOrderStatus;
    }>(formData, 'data');
    const data = updatePurchaseOrderStatusSchema.parse(rawData);

    const order = await prisma.purchaseOrder.findUnique({
      where: { id: data.orderId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            batchNumber: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: '采购订单不存在' };
    }

    const now = new Date();

    const { inboundResults } = await prisma.$transaction(async tx => {
      const updateData: Record<string, unknown> = {
        status: data.status,
      };

      if (data.status === PURCHASE_ORDER_STATUS.SHIPPED) {
        updateData.shipmentDate = now;
      } else if (data.status === PURCHASE_ORDER_STATUS.ARRIVED) {
        updateData.arrivalDate = now;
      }

      await tx.purchaseOrder.update({
        where: { id: data.orderId },
        data: updateData,
      });

      const createdInboundRecords: MinimalInboundTransactionResult[] = [];

      if (data.status === PURCHASE_ORDER_STATUS.ARRIVED) {
        const itemIds = order.items.map(item => item.id);
        const inboundTotals = itemIds.length
          ? await tx.inboundRecord.groupBy({
              by: ['purchaseOrderItemId'],
              where: {
                purchaseOrderId: order.id,
                purchaseOrderItemId: { in: itemIds, not: null },
              },
              _sum: { quantity: true },
            })
          : [];

        const receivedMap = new Map<string, number>();
        for (const record of inboundTotals) {
          if (record.purchaseOrderItemId) {
            receivedMap.set(
              record.purchaseOrderItemId,
              record._sum.quantity ?? 0
            );
          }
        }

        for (const item of order.items) {
          if (!item.productId) {
            continue;
          }

          const alreadyReceived = receivedMap.get(item.id) ?? 0;
          const remainingQuantity = Math.max(
            0,
            (item.quantity ?? 0) - alreadyReceived
          );

          if (remainingQuantity <= 0) {
            continue;
          }

          const inbound = await executeMinimalInboundTransaction(
            {
              productId: item.productId,
              variantId: undefined,
              quantity: remainingQuantity,
              unitCost: item.unitPrice ?? 0,
              reason: 'purchase',
              remarks: `采购订单${order.orderNumber}到货`,
              batchNumber: item.batchNumber ?? '',
              userId: session.user.id,
              purchaseOrderId: order.id,
              purchaseOrderItemId: item.id,
            },
            { tx }
          );

          createdInboundRecords.push(inbound);
        }

        await refreshPurchaseOrderFulfillment(tx, order.id);
      }

      return { inboundResults: createdInboundRecords };
    });

    if (inboundResults.length > 0) {
      const productIds = Array.from(
        new Set(inboundResults.map(record => record.productId))
      );
      try {
        await Promise.all([
          ...productIds.map(id => invalidateInventoryCache(id)),
          ...productIds.map(id => revalidateProducts(id)),
        ]);
      } catch (cacheError) {
        logger.error('actions:purchase-orders', '库存缓存刷新失败', cacheError);
      }
    }

    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${data.orderId}`);

    return { success: true, data: { id: data.orderId } };
  } catch (error) {
    logger.error('actions:purchase-orders', '更新订单状态失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新订单状态失败',
    };
  }
}

/**
 * 删除采购订单
 */
export async function deletePurchaseOrder(
  orderId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { success: false, error: '采购订单不存在' };
    }

    if (order.status !== PURCHASE_ORDER_STATUS.DRAFT) {
      return { success: false, error: '只能删除草稿状态的订单' };
    }

    await prisma.$transaction(async tx => {
      await tx.expenseRecord.deleteMany({
        where: {
          relatedType: 'purchase_order',
          relatedId: orderId,
        },
      });

      const existingPayable = await tx.payableRecord.findFirst({
        where: {
          sourceType: 'purchase_order',
          sourceId: orderId,
        },
      });

      if (existingPayable) {
        if (existingPayable.paidAmount > 0) {
          throw new Error('已有付款记录的采购订单不能删除');
        }

        await tx.payableRecord.delete({
          where: { id: existingPayable.id },
        });
      }

      await tx.purchaseOrder.delete({
        where: { id: orderId },
      });
    });

    revalidatePath('/purchase-orders');

    return { success: true, data: { id: orderId } };
  } catch (error) {
    logger.error('actions:purchase-orders', '删除采购订单失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除采购订单失败',
    };
  }
}

/**
 * 获取采购订单详情
 */
export async function getPurchaseOrderById(orderId: string) {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        supplier: true,
        user: true,
        items: {
          include: {
            product: true,
            supplier: true,
          },
        },
      },
    });

    if (!order) {
      return { data: null, error: '采购订单不存在' };
    }

    const expenses = await prisma.expenseRecord.findMany({
      where: {
        relatedType: 'purchase_order',
        relatedId: orderId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const inboundByOrder = new Map<string, number>();
    const inboundByItem = new Map<string, number>();

    const orderInbound = await prisma.inboundRecord.groupBy({
      by: ['purchaseOrderId'],
      where: {
        purchaseOrderId: order.id,
      },
      _sum: { quantity: true },
    });

    for (const row of orderInbound) {
      if (row.purchaseOrderId) {
        inboundByOrder.set(row.purchaseOrderId, row._sum.quantity ?? 0);
      }
    }

    const itemInbound = await prisma.inboundRecord.groupBy({
      by: ['purchaseOrderItemId'],
      where: {
        purchaseOrderId: order.id,
        purchaseOrderItemId: { not: null },
      },
      _sum: { quantity: true },
    });

    for (const row of itemInbound) {
      if (row.purchaseOrderItemId) {
        inboundByItem.set(row.purchaseOrderItemId, row._sum.quantity ?? 0);
      }
    }

    const { summary, items } = calculatePurchaseOrderExecution(
      order,
      inboundByOrder,
      inboundByItem
    );

    const mappedItems = order.items.map((item, index) => ({
      ...item,
      receivedQuantity: items[index]?.receivedQuantity ?? 0,
      executionRate: items[index]?.executionRate ?? 0,
    }));

    return {
      data: {
        ...order,
        items: mappedItems,
        executionSummary: summary,
        expenses,
      },
      error: null,
    };
  } catch (error) {
    logger.error('actions:purchase-orders', '获取订单详情失败', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : '获取订单详情失败',
    };
  }
}

/**
 * 获取采购订单列表
 */
export async function getPurchaseOrderList(params?: {
  page?: number;
  limit?: number;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  fulfillment?: 'none' | 'partial' | 'complete';
}) {
  try {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(params?.status && { status: params.status }),
      ...(params?.supplierId && { supplierId: params.supplierId }),
    };

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          user: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    const orderIds = orders.map(order => order.id);
    const itemIds = orders.flatMap(order => order.items.map(item => item.id));

    const inboundByOrder = new Map<string, number>();
    const inboundByItem = new Map<string, number>();

    if (orderIds.length > 0) {
      const orderInbound = await prisma.inboundRecord.groupBy({
        by: ['purchaseOrderId'],
        where: {
          purchaseOrderId: { in: orderIds, not: null },
        },
        _sum: { quantity: true },
      });

      for (const row of orderInbound) {
        if (row.purchaseOrderId) {
          inboundByOrder.set(row.purchaseOrderId, row._sum.quantity ?? 0);
        }
      }
    }

    if (itemIds.length > 0) {
      const itemInbound = await prisma.inboundRecord.groupBy({
        by: ['purchaseOrderItemId'],
        where: {
          purchaseOrderItemId: { in: itemIds, not: null },
        },
        _sum: { quantity: true },
      });

      for (const row of itemInbound) {
        if (row.purchaseOrderItemId) {
          inboundByItem.set(row.purchaseOrderItemId, row._sum.quantity ?? 0);
        }
      }
    }

    const enhancedOrders = orders.map(order => {
      const { summary, items } = calculatePurchaseOrderExecution(
        order,
        inboundByOrder,
        inboundByItem
      );

      const mappedItems = order.items.map((item, index) => ({
        ...item,
        receivedQuantity: items[index]?.receivedQuantity ?? 0,
        executionRate: items[index]?.executionRate ?? 0,
      }));

      return {
        ...order,
        items: mappedItems,
        executionSummary: summary,
      };
    });

    const filteredOrders = params?.fulfillment
      ? enhancedOrders.filter(
          order =>
            order.executionSummary.fulfillmentStatus === params.fulfillment
        )
      : enhancedOrders;

    const effectiveTotal = params?.fulfillment ? filteredOrders.length : total;

    return {
      data: {
        orders: filteredOrders,
        pagination: {
          page,
          limit,
          total: effectiveTotal,
          totalPages: Math.ceil(effectiveTotal / limit),
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('actions:purchase-orders', '获取订单列表失败', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : '获取订单列表失败',
    };
  }
}
