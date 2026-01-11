import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';

import {
  executeMinimalInboundTransaction,
  type MinimalInboundTransactionResult,
} from '@/lib/api/minimal-inbound-transaction';
import { refreshPurchaseOrderFulfillment } from '@/lib/api/purchase-orders/fulfillment';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  createPurchaseOrderExpenses,
  replacePurchaseOrderExpenses,
} from '@/lib/services/purchase-expense-service';
import { resolveInboundUnitCost } from '@/lib/services/purchase-order-cost-service';
import {
  ensurePurchaseOrderPayable,
  shouldCreatePayable,
} from '@/lib/services/purchase-order-payable';
import { generatePurchaseOrderNumber } from '@/lib/services/simple-order-number-generator';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import type { ValidationIssue } from '@/lib/types/validation';
import { toNumber } from '@/lib/utils/number';
import { generatePayableNumber } from '@/lib/utils/payment-number-generator';
import type {
  PurchaseOrderFormData,
  PurchaseOrderItemInput,
  UpdatePurchaseOrderFormData,
  UpdatePurchaseOrderStatusFormData,
} from '@/lib/validations/purchase-order-form';

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; validationErrors?: ValidationIssue[] };
type PrismaTransaction = Prisma.TransactionClient;

interface UpdatePurchaseOrderInternalOptions {
  orderId: string;
  data: UpdatePurchaseOrderFormData;
  items: PurchaseOrderItemInput[];
  totalAmount: number;
  userId: string;
}

export interface NormalizedStatusPayload {
  orderId: string;
  status: PurchaseOrderStatus;
  containerNumber?: string | null;
  shippingCompany?: string | null;
  estimatedArrival?: Date;
  shipmentDate?: Date;
}

export function parseJsonPayload<T>(formData: FormData, key: string): T {
  const jsonStr = formData.get(key);
  if (typeof jsonStr !== 'string') {
    throw new Error(`Missing or invalid ${key} field`);
  }
  return JSON.parse(jsonStr) as T;
}

export async function getAuthorizedUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export function unauthorizedActionResult<T>(action: string): ActionResult<T> {
  logger.warn('actions:purchase-orders', `${action}失败：未授权`);
  return { success: false, error: '未授权操作' };
}

export function calculateOrderTotal(items: PurchaseOrderItemInput[]): number {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
}

export async function createPurchaseOrderInternal(
  data: PurchaseOrderFormData,
  userId: string,
  totalAmount: number
) {
  return prisma.$transaction(async tx => {
    const orderNumber = await generatePurchaseOrderNumber();
    const status: PurchaseOrderStatus =
      (data.status as PurchaseOrderStatus | undefined) ??
      PURCHASE_ORDER_STATUS.DRAFT;
    const primarySupplierId = data.items[0]?.supplierId;
    if (!primarySupplierId) {
      throw new Error('采购订单必须选择供应商');
    }
    const order = await tx.purchaseOrder.create({
      data: {
        orderNumber,
        containerNumber: data.containerNumber?.trim() || null,
        shippingCompany:
          normalizeOptionalString(data.shippingCompany) ?? null,
        status,
        totalAmount,
        orderDate: data.orderDate ? new Date(data.orderDate) : null,
        shipmentDate: data.shipmentDate ? new Date(data.shipmentDate) : null,
        remarks: data.remarks?.trim() ?? null,
        supplierId: primarySupplierId,
        userId,
        items: {
          create: data.items.map(item => ({
            productId: item.productId?.trim() || null,
            supplierId: item.supplierId,
            productCode: item.productCode,
            batchNumber: item.batchNumber?.trim() || null,
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

    // ✅ P1修复：使用统一的费用创建服务（带幂等性）
    await createPurchaseOrderExpenses({
      tx,
      orderId: order.id,
      orderNumber: order.orderNumber,
      supplierId: primarySupplierId,
      userId,
      feeItems: data.feeItems ?? [],
    });

    // 按供应商分组创建应付账款
    if (shouldAutoCreatePayable(status, totalAmount)) {
      const supplierAmounts = new Map<string, number>();

      // 统计每个供应商的采购金额
      for (const item of data.items) {
        const currentAmount = supplierAmounts.get(item.supplierId) || 0;
        supplierAmounts.set(item.supplierId, currentAmount + item.totalPrice);
      }

      // 为每个供应商创建应付记录
      for (const [supplierId, amount] of supplierAmounts.entries()) {
        const payableNumber = await generatePayableNumber(tx);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await tx.payableRecord.create({
          data: {
            payableNumber,
            supplierId,
            userId,
            sourceType: 'purchase_order',
            sourceId: order.id,
            sourceNumber: order.orderNumber,
            payableAmount: amount,
            paidAmount: 0,
            remainingAmount: amount,
            dueDate,
            status: 'pending',
            paymentTerms: '30天',
            remarks: `系统自动生成：采购订单 ${order.orderNumber} 确认应付`,
          },
        });
      }
    }

    return order;
  });
}

function shouldAutoCreatePayable(
  status: PurchaseOrderStatus,
  totalAmount: number
): boolean {
  return status === PURCHASE_ORDER_STATUS.ORDERED && totalAmount > 0;
}

export async function updatePurchaseOrderInternal({
  orderId,
  data,
  items,
  totalAmount,
  userId,
}: UpdatePurchaseOrderInternalOptions): Promise<ActionResult<null>> {
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

  await prisma.$transaction(async tx => {
    await tx.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: orderId },
    });

    // ✅ P1修复：使用统一的费用创建服务（带幂等性）
    const expenseResult = await replacePurchaseOrderExpenses({
      tx,
      orderId,
      orderNumber: existingOrder.orderNumber,
      supplierId: existingOrder.supplierId,
      userId,
      feeItems: data.feeItems ?? [],
    });
    const expenseAmount = expenseResult.totalAmount;

    // ✅ 修复：更新订单时同步更新 expenseAmount
    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: {
        containerNumber:
          data.containerNumber !== undefined
            ? data.containerNumber.trim() || null
            : existingOrder.containerNumber,
        shippingCompany:
          data.shippingCompany !== undefined
            ? normalizeOptionalString(data.shippingCompany) ?? null
            : existingOrder.shippingCompany,
        remarks: data.remarks?.trim() ?? existingOrder.remarks ?? null,
        totalAmount,
        expenseAmount, // ✅ 新增：同步更新费用总额
        items: {
          create: items.map(item => ({
            productId: item.productId || null,
            supplierId: item.supplierId,
            productCode: item.productCode.trim(),
            batchNumber: item.batchNumber?.trim() || null,
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
            piecesPerUnit: item.piecesPerUnit ?? null,
            weight: item.weight || null,
            remarks: item.remarks?.trim() || null,
          })),
        },
      },
    });
  });

  return { success: true, data: null };
}

export function normalizeStatusPayload(
  data: UpdatePurchaseOrderStatusFormData
): NormalizedStatusPayload {
  return {
    orderId: data.orderId,
    status: data.status,
    containerNumber: normalizeOptionalString(data.containerNumber) ?? undefined,
    shippingCompany: normalizeOptionalString(data.shippingCompany) ?? undefined,
    estimatedArrival: normalizeOptionalDate(data.estimatedArrival),
    shipmentDate: normalizeOptionalDate(data.shipmentDate),
  };
}

function normalizeOptionalString(
  value?: string | null
): string | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalDate(value?: string | null): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? new Date(trimmed) : undefined;
}

export async function fetchOrderForStatusChange(orderId: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      supplierId: true,
      userId: true,
      totalAmount: true,
      expenseAmount: true,
      containerNumber: true,
      shippingCompany: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          unitCostWithExpense: true,
          batchNumber: true,
        },
      },
    },
  });
}

export async function applyStatusUpdateTransaction(
  order: NonNullable<Awaited<ReturnType<typeof fetchOrderForStatusChange>>>,
  payload: NormalizedStatusPayload,
  userId: string
) {
  const now = new Date();
  return prisma.$transaction(async tx => {
    const updateData: Record<string, unknown> = {
      status: payload.status,
    };

    if (payload.containerNumber !== undefined) {
      updateData.containerNumber = payload.containerNumber;
    }

    if (payload.shippingCompany !== undefined) {
      updateData.shippingCompany = payload.shippingCompany;
    }

    if (payload.estimatedArrival) {
      updateData.estimatedArrival = payload.estimatedArrival;
    }

    if (payload.status === PURCHASE_ORDER_STATUS.SHIPPED) {
      updateData.shipmentDate = payload.shipmentDate ?? now;
    } else if (payload.status === PURCHASE_ORDER_STATUS.ARRIVED) {
      updateData.arrivalDate = payload.estimatedArrival ?? now;
    }

    await tx.purchaseOrder.update({
      where: { id: payload.orderId },
      data: updateData,
    });

    let inboundResults: MinimalInboundTransactionResult[] = [];

    if (payload.status === PURCHASE_ORDER_STATUS.ARRIVED) {
      inboundResults = await createArrivalInboundRecords(tx, order, userId);
      await refreshPurchaseOrderFulfillment(tx, order.id);
    }

    if (shouldCreatePayable(payload.status)) {
      await ensurePurchaseOrderPayable(tx, {
        id: order.id,
        supplierId: order.supplierId,
        userId: order.userId,
        orderNumber: order.orderNumber,
        totalAmount: toNumber(order.totalAmount),
        expenseAmount:
          order.expenseAmount == null ? null : toNumber(order.expenseAmount), // ✅ 修复：传递费用金额
      });
    }

    return { inboundResults };
  });
}

async function createArrivalInboundRecords(
  tx: PrismaTransaction,
  order: NonNullable<Awaited<ReturnType<typeof fetchOrderForStatusChange>>>,
  userId: string
): Promise<MinimalInboundTransactionResult[]> {
  const itemIds = order.items.map(item => item.id);
  if (itemIds.length === 0) {
    return [];
  }

  const inboundTotals = await tx.inboundRecord.groupBy({
    by: ['purchaseOrderItemId'],
    where: {
      purchaseOrderId: order.id,
      purchaseOrderItemId: { in: itemIds, not: null },
    },
    _sum: { quantity: true },
  });

  const receivedMap = new Map<string, number>();
  for (const record of inboundTotals) {
    if (record.purchaseOrderItemId) {
      receivedMap.set(record.purchaseOrderItemId, record._sum.quantity ?? 0);
    }
  }

  const createdInboundRecords: MinimalInboundTransactionResult[] = [];

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

    const inboundUnitCost = resolveInboundUnitCost({
      unitCostWithExpense:
        item.unitCostWithExpense == null
          ? null
          : toNumber(item.unitCostWithExpense),
      unitPrice: item.unitPrice == null ? null : toNumber(item.unitPrice),
      fallback: toNumber(item.unitPrice),
    });

    const inbound = await executeMinimalInboundTransaction(
      {
        productId: item.productId,
        variantId: undefined,
        quantity: remainingQuantity,
        unitCost: inboundUnitCost,
        reason: 'purchase',
        remarks: `采购订单${order.orderNumber}到货`,
        batchNumber: item.batchNumber ?? '',
        userId,
        purchaseOrderId: order.id,
        purchaseOrderItemId: item.id,
        // 使用订单级主供应商，便于后续按供应商维度统计进货
        supplierId: order.supplierId ?? undefined,
      },
      { tx }
    );

    createdInboundRecords.push(inbound);
  }

  return createdInboundRecords;
}
