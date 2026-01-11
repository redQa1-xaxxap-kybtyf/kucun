'use server';

import type {
  Prisma,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { calculatePurchaseOrderExecution } from '@/lib/api/purchase-orders/fulfillment';
import { revalidateProducts } from '@/lib/cache';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  allocatePurchaseOrderExpensesByQuantity,
  type PurchaseOrderExpenseAllocationResult,
} from '@/lib/services/purchase-order-cost-service';
import type { ExpenseRecord as ExpenseRecordType } from '@/lib/types/expense';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { toNumber } from '@/lib/utils/number';
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
  applyStatusUpdateTransaction,
  calculateOrderTotal,
  createPurchaseOrderInternal,
  fetchOrderForStatusChange,
  getAuthorizedUserId,
  normalizeStatusPayload,
  parseJsonPayload,
  unauthorizedActionResult,
  updatePurchaseOrderInternal,
  type ActionResult,
} from './purchase-orders.utils';

const MAX_EXPENSE_RECORDS_PER_ORDER = 5000;

const EXPENSE_RECORD_SELECT = {
  id: true,
  expenseNumber: true,
  expenseType: true,
  expenseName: true,
  expenseAmount: true,
  expenseDate: true,
  relatedType: true,
  relatedId: true,
  relatedNumber: true,
  remarks: true,
  attachments: true,
  status: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  approvedById: true,
  approvedAt: true,
  cancelReason: true,
} satisfies Prisma.ExpenseRecordSelect;

type ExpenseRecordRow = Prisma.ExpenseRecordGetPayload<{
  select: typeof EXPENSE_RECORD_SELECT;
}>;

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
    const rawData = parseJsonPayload<unknown>(formData, 'data');
    const data = updatePurchaseOrderSchema.parse(
      rawData
    ) as UpdatePurchaseOrderFormData;
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
 * 确认采购订单，计算并写入费用分摊结果
 */
export async function confirmPurchaseOrder(
  orderId: string
): Promise<ActionResult<{ id: string }>> {
  const buildErrorResult = (message: string): ActionResult<{ id: string }> => ({
    success: false,
    error: message,
  });

  try {
    const userId = await getAuthorizedUserId();
    if (!userId) {
      return unauthorizedActionResult('确认采购订单');
    }

    if (!orderId) {
      return buildErrorResult('采购订单ID不能为空');
    }

    const result = await prisma.$transaction<ActionResult<{ id: string }>>(
      async tx => {
        const order = await tx.purchaseOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            status: true,
            expenseAmount: true,
            items: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        });

        if (!order) {
          return buildErrorResult('采购订单不存在');
        }

        if (order.status !== PURCHASE_ORDER_STATUS.DRAFT) {
          return buildErrorResult('仅草稿状态的订单可以确认');
        }

        if (!order.items.length) {
          return buildErrorResult('采购订单没有明细项');
        }

        // ✅ 修复：如果 expenseAmount 为 null，从费用记录即时求和
        let actualExpenseAmount = toNumber(order.expenseAmount);
        if (order.expenseAmount === null || order.expenseAmount === undefined) {
          const expenseSum = await tx.expenseRecord.aggregate({
            where: {
              relatedType: 'purchase_order',
              relatedId: orderId,
            },
            _sum: {
              expenseAmount: true,
            },
          });
          actualExpenseAmount = toNumber(expenseSum._sum.expenseAmount);

          // 同步更新订单的 expenseAmount
          await tx.purchaseOrder.update({
            where: { id: orderId },
            data: { expenseAmount: actualExpenseAmount },
          });
        }

        let allocations: PurchaseOrderExpenseAllocationResult[];
        try {
          allocations = allocatePurchaseOrderExpensesByQuantity(
            order.items.map(item => ({
              id: item.id,
              quantity: item.quantity,
              unitPrice: toNumber(item.unitPrice),
            })),
            actualExpenseAmount
          );
        } catch (allocationError) {
          const errorMessage =
            allocationError instanceof Error
              ? allocationError.message
              : '采购费用分摊失败';
          return buildErrorResult(errorMessage);
        }

        for (const allocation of allocations) {
          await tx.purchaseOrderItem.update({
            where: { id: allocation.id },
            data: {
              allocatedExpense: allocation.allocatedExpense,
              unitCostWithExpense: allocation.unitCostWithExpense,
              unitCost: allocation.unitCostWithExpense,
            },
          });
        }

        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: { status: PURCHASE_ORDER_STATUS.ORDERED },
        });

        return { success: true, data: { id: orderId } };
      }
    );

    if (result.success) {
      revalidatePath('/purchase-orders');
      revalidatePath(`/purchase-orders/${orderId}`);
    }

    return result;
  } catch (error) {
    logger.error('actions:purchase-orders', '确认采购订单失败', error, {
      orderId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '确认采购订单失败',
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
        if (toNumber(existingPayable.paidAmount) > 0) {
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
type PurchaseOrderDetailModel = Prisma.PurchaseOrderGetPayload<{
  include: typeof PURCHASE_ORDER_DETAIL_INCLUDE;
}>;

const PURCHASE_ORDER_DETAIL_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          specification: true,
          unit: true,
          weight: true,
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
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

type PurchaseOrderDetailResponse = {
  data: PurchaseOrder | null;
  error: string | null;
};

export async function getPurchaseOrderById(
  orderId: string
): Promise<PurchaseOrderDetailResponse> {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: PURCHASE_ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      return { data: null, error: '采购订单不存在' };
    }

    const expenses = await prisma.expenseRecord.findMany({
      where: {
        relatedType: 'purchase_order',
        relatedId: orderId,
      },
      select: EXPENSE_RECORD_SELECT,
      orderBy: {
        createdAt: 'asc',
      },
      take: MAX_EXPENSE_RECORDS_PER_ORDER,
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

    const mappedItems = order.items.map((item, index) =>
      mapPurchaseOrderItem(
        item,
        items[index]?.receivedQuantity ?? 0,
        items[index]?.executionRate ?? 0
      )
    );

    const normalizedExpenses = expenses.map(mapExpenseRecord);

    const normalizedOrder: PurchaseOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      containerNumber: order.containerNumber,
      userId: order.userId,
      status: order.status as PurchaseOrderStatus,
      totalAmount: Number(order.totalAmount),
      expenseAmount:
        order.expenseAmount === null ? undefined : Number(order.expenseAmount),
      costAmount: order.costAmount === null ? undefined : Number(order.costAmount),
      remarks: order.remarks ?? undefined,
      shippingCompany: order.shippingCompany ?? undefined,
      orderDate: order.orderDate ?? undefined,
      shipmentDate: order.shipmentDate ?? undefined,
      estimatedArrival: order.estimatedArrival ?? undefined,
      arrivalDate: order.arrivalDate ?? undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      executionSummary: summary,
      user: order.user,
      items: mappedItems,
      expenses: normalizedExpenses,
    };

    return {
      data: normalizedOrder,
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

function mapPurchaseOrderItem(
  item: PurchaseOrderDetailModel['items'][number],
  receivedQuantity: number,
  executionRate: number
): PurchaseOrderItem {
  return {
    id: item.id,
    purchaseOrderId: item.purchaseOrderId,
    productId: item.productId ?? undefined,
    supplierId: item.supplierId,
    productCode: item.productCode,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
    inboundStatus: item.inboundStatus
      ? (item.inboundStatus as PurchaseOrderItem['inboundStatus'])
      : undefined,
    inboundReceivedAt: item.inboundReceivedAt ?? undefined,
    isManualProduct: item.isManualProduct ?? undefined,
    manualProductName: item.manualProductName ?? undefined,
    manualSpecification: item.manualSpecification ?? undefined,
    manualWeight:
      item.manualWeight == null ? undefined : toNumber(item.manualWeight),
    manualUnit: item.manualUnit ?? undefined,
    receivedQuantity,
    executionRate,
    displayName: item.displayName,
    specification: item.specification ?? undefined,
    unit: item.unit,
    weight: item.weight == null ? undefined : toNumber(item.weight),
    piecesPerUnit:
      item.piecesPerUnit == null ? undefined : toNumber(item.piecesPerUnit),
    remarks: item.remarks ?? undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    unitCost: item.unitCost == null ? undefined : toNumber(item.unitCost),
    allocatedExpense:
      item.allocatedExpense == null
        ? undefined
        : toNumber(item.allocatedExpense),
    unitCostWithExpense:
      item.unitCostWithExpense == null
        ? undefined
        : toNumber(item.unitCostWithExpense),
    product: item.product
      ? {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
          specification: item.product.specification ?? undefined,
          unit: item.product.unit,
          weight:
            item.product.weight == null ? undefined : toNumber(item.product.weight),
        }
      : undefined,
    supplier: {
      id: item.supplier.id,
      name: item.supplier.name,
      phone: item.supplier.phone ?? undefined,
      address: item.supplier.address ?? undefined,
    },
  };
}

function mapExpenseRecord(expense: ExpenseRecordRow): ExpenseRecordType {
  return {
    id: expense.id,
    expenseNumber: expense.expenseNumber,
    expenseType: expense.expenseType as ExpenseRecordType['expenseType'],
    expenseName: expense.expenseName,
    expenseAmount: Number(expense.expenseAmount),
    expenseDate: expense.expenseDate.toISOString(),
    relatedType: expense.relatedType as ExpenseRecordType['relatedType'],
    relatedId: expense.relatedId ?? undefined,
    relatedNumber: expense.relatedNumber ?? undefined,
    remarks: expense.remarks ?? undefined,
    attachments: expense.attachments ?? undefined,
    status: expense.status as ExpenseRecordType['status'],
    userId: expense.userId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    approvedById: expense.approvedById ?? undefined,
    approvedAt: expense.approvedAt
      ? expense.approvedAt.toISOString()
      : undefined,
    cancelReason: expense.cancelReason ?? undefined,
  };
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
