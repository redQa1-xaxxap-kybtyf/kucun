'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { calculatePurchaseOrderExecution } from '@/lib/api/purchase-orders/fulfillment';
import { revalidateProducts } from '@/lib/cache';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import type { ValidationIssue } from '@/lib/types/validation';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  type PurchaseOrderFormData,
  type UpdatePurchaseOrderFormData,
  type UpdatePurchaseOrderStatusFormData,
} from '@/lib/validations/purchase-order-form';

import {
  enhancePurchaseOrders,
  fetchPurchaseOrderPageData,
  filterOrdersByFulfillment,
  resolvePagination,
} from './purchase-orders.pagination';
import {
  type ActionResult,
  applyStatusUpdateTransaction,
  calculateOrderTotal,
  createPurchaseOrderInternal,
  fetchOrderForStatusChange,
  getAuthorizedUserId,
  normalizeStatusPayload,
  parseJsonPayload,
  unauthorizedActionResult,
  updatePurchaseOrderInternal,
} from './purchase-orders.utils';

const mapZodIssues = (issues: z.ZodIssue[]): ValidationIssue[] =>
  issues.map(issue => ({
    path: issue.path.length > 0 ? issue.path.join('.') : undefined,
    message: issue.message,
    code: issue.code,
  }));

const validationErrorResult = (issues: z.ZodIssue[]): ActionResult<never> =>
  ({
    success: false,
    error: '参数验证失败，请检查表单输入',
    validationErrors: mapZodIssues(issues),
  }) as ActionResult<never>;

/**
 * 创建采购订单
 */
export async function createPurchaseOrder(
  formData: FormData
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const userId = await getAuthorizedUserId();
    if (!userId) {
      return unauthorizedActionResult('创建采购订单');
    }

    const rawData = parseJsonPayload<PurchaseOrderFormData>(formData, 'data');
    const data = createPurchaseOrderSchema.parse(rawData);
    const totalAmount = calculateOrderTotal(data.items);
    const result = await createPurchaseOrderInternal(data, userId, totalAmount);

    revalidatePath('/purchase-orders');
    revalidatePath('/finance/expenses');

    return {
      success: true,
      data: { id: result.id, orderNumber: result.orderNumber },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('actions:purchase-orders', '创建采购订单参数验证失败', {
        issues: JSON.stringify(error.issues),
      });
      return validationErrorResult(error.issues);
    }
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
    const userId = await getAuthorizedUserId();
    if (!userId) {
      return unauthorizedActionResult('更新采购订单');
    }

    const orderId = formData.get('orderId') as string;
    const rawData = parseJsonPayload<UpdatePurchaseOrderFormData>(
      formData,
      'data'
    );
    const data = updatePurchaseOrderSchema.parse(rawData);
    const updatedItems = data.items ?? [];
    const totalAmount = calculateOrderTotal(updatedItems);
    const updateResult = await updatePurchaseOrderInternal({
      orderId,
      data,
      items: updatedItems,
      totalAmount,
      userId,
    });

    if (!updateResult.success) {
      return updateResult;
    }

    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${orderId}`);

    return { success: true, data: { id: orderId } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('actions:purchase-orders', '更新采购订单参数验证失败', {
        issues: JSON.stringify(error.issues),
      });
      return validationErrorResult(error.issues);
    }
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
    const userId = await getAuthorizedUserId();
    if (!userId) {
      return unauthorizedActionResult('更新采购订单状态');
    }

    const rawData = parseJsonPayload<UpdatePurchaseOrderStatusFormData>(
      formData,
      'data'
    );
    const parsed = updatePurchaseOrderStatusSchema.parse(rawData);
    const normalized = normalizeStatusPayload(parsed);
    const order = await fetchOrderForStatusChange(normalized.orderId);

    if (!order) {
      return { success: false, error: '采购订单不存在' };
    }

    const statusResult = await applyStatusUpdateTransaction(
      order,
      normalized,
      userId
    );

    if (statusResult.inboundResults.length > 0) {
      const productIds = Array.from(
        new Set(statusResult.inboundResults.map(record => record.productId))
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
    revalidatePath(`/purchase-orders/${normalized.orderId}`);

    return { success: true, data: { id: normalized.orderId } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('actions:purchase-orders', '更新订单状态参数验证失败', {
        issues: JSON.stringify(error.issues),
      });
      return validationErrorResult(error.issues);
    }
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
    const userId = await getAuthorizedUserId();
    if (!userId) {
      return unauthorizedActionResult('删除采购订单');
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
    const pagination = resolvePagination(params);
    const { orders, total } = await fetchPurchaseOrderPageData(
      params,
      pagination
    );
    const enhancedOrders = await enhancePurchaseOrders(orders);
    const filteredOrders = filterOrdersByFulfillment(
      enhancedOrders,
      params?.fulfillment
    );
    const effectiveTotal = params?.fulfillment ? filteredOrders.length : total;

    return {
      data: {
        orders: filteredOrders,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: effectiveTotal,
          totalPages: Math.ceil(effectiveTotal / pagination.limit),
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
