import type { Prisma } from '@prisma/client';

import { applyCompletionEffects } from '@/app/actions/return-orders.utils';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { toNumber } from '@/lib/utils/number';

const roundCurrency = (value: number): number =>
  Math.round(Number(value || 0) * 100) / 100;

type ReturnOrderCompletionContext = {
  id: string;
  customerId: string;
  processType: string;
  refundAmount: number | Prisma.Decimal | null;
  returnNumber: string;
  salesOrderId: string | null;
  totalAmount: number | Prisma.Decimal | null;
};

export interface ReturnOrderCompletionResult {
  affectedProductIds: string[];
  refundCreated: boolean;
  refundRecordId?: string;
}

async function adjustSalesOrderProfitOnReturn(
  tx: Prisma.TransactionClient,
  params: { salesOrderId: string; refundAmount: number }
): Promise<void> {
  const refundAmount = roundCurrency(
    Math.max(0, Number(params.refundAmount || 0))
  );

  if (refundAmount <= 0) {
    return;
  }

  const salesOrder = await tx.salesOrder.findUnique({
    where: { id: params.salesOrderId },
    select: {
      costAmount: true,
      itemsAmount: true,
      profitAmount: true,
    },
  });

  if (!salesOrder) {
    return;
  }

  const itemsAmount = roundCurrency(Number(salesOrder.itemsAmount || 0));
  const costAmount = roundCurrency(Number(salesOrder.costAmount || 0));
  const currentProfit = roundCurrency(Number(salesOrder.profitAmount || 0));

  if (itemsAmount <= 0) {
    await tx.salesOrder.update({
      where: { id: params.salesOrderId },
      data: {
        profitAmount: roundCurrency(currentProfit - refundAmount),
      },
    });
    return;
  }

  const effectiveRefund = Math.min(refundAmount, itemsAmount);
  const refundRatio = effectiveRefund / itemsAmount;
  const returnCost = roundCurrency(costAmount * refundRatio);
  const profitDelta = roundCurrency(effectiveRefund - returnCost);

  if (profitDelta === 0) {
    return;
  }

  await tx.salesOrder.update({
    where: { id: params.salesOrderId },
    data: {
      profitAmount: roundCurrency(currentProfit - profitDelta),
    },
  });
}

async function resolveRefundAmount(
  tx: Prisma.TransactionClient,
  order: ReturnOrderCompletionContext,
  overrideRefundAmount?: number
): Promise<number> {
  let computedRefundAmount =
    overrideRefundAmount ??
    (typeof order.refundAmount === 'number'
      ? order.refundAmount
      : Number(order.refundAmount ?? 0));

  if (!Number.isFinite(computedRefundAmount) || computedRefundAmount <= 0) {
    const aggregated = await tx.returnOrderItem.aggregate({
      where: { returnOrderId: order.id },
      _sum: { subtotal: true },
    });
    const aggregatedAmount = Number(aggregated._sum.subtotal ?? 0);
    if (aggregatedAmount > 0) {
      computedRefundAmount = aggregatedAmount;
    } else {
      const orderTotalAmount = toNumber(order.totalAmount, 0);
      if (orderTotalAmount > 0) {
        computedRefundAmount = orderTotalAmount;
      }
    }
  }

  return roundCurrency(Math.max(0, computedRefundAmount));
}

async function createRefundRecord(
  tx: Prisma.TransactionClient,
  order: ReturnOrderCompletionContext,
  userId: string,
  refundAmount: number
): Promise<{ id: string; created: true }> {
  const { generateRefundNumber } = await import(
    '@/lib/services/simple-order-number-generator'
  );

  if (!order.salesOrderId) {
    throw new Error(
      `退货订单 ${order.returnNumber} 缺少关联的销售订单，无法生成退款记录`
    );
  }

  const created = await tx.refundRecord.create({
    data: {
      customerId: order.customerId,
      processedAmount: 0,
      reason: `退货订单 ${order.returnNumber} 自动生成退款`,
      refundAmount,
      refundDate: new Date(),
      refundMethod: 'original_payment',
      refundNumber: await generateRefundNumber(),
      refundType: 'full_refund',
      remarks: `系统自动创建,关联退货订单：${order.returnNumber}`,
      remainingAmount: refundAmount,
      returnOrderId: order.id,
      returnOrderNumber: order.returnNumber,
      salesOrderId: order.salesOrderId,
      status: 'pending',
      userId,
    },
    select: {
      id: true,
    },
  });

  return {
    id: created.id,
    created: true,
  };
}

async function syncRefundRecord(
  tx: Prisma.TransactionClient,
  order: ReturnOrderCompletionContext,
  userId: string,
  refundAmount: number
): Promise<{ id: string; created: boolean } | null> {
  if (refundAmount <= 0) {
    return null;
  }

  const existingRefund = await tx.refundRecord.findFirst({
    where: {
      returnOrderId: order.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      processedAmount: true,
      refundAmount: true,
      remainingAmount: true,
      status: true,
    },
  });

  if (!existingRefund) {
    return createRefundRecord(tx, order, userId, refundAmount);
  }

  if (
    existingRefund.status === 'rejected' ||
    existingRefund.status === 'cancelled'
  ) {
    return createRefundRecord(tx, order, userId, refundAmount);
  }

  const processedAmount = toNumber(existingRefund.processedAmount, 0);
  const remainingAmount = Math.max(
    Number((refundAmount - processedAmount).toFixed(6)),
    0
  );
  const resolvedStatus =
    processedAmount >= refundAmount
      ? 'completed'
      : processedAmount > 0
        ? 'processing'
        : 'pending';

  const updatedRefund = await tx.refundRecord.update({
    where: { id: existingRefund.id },
    data: {
      refundAmount,
      remainingAmount,
      status: resolvedStatus,
    },
    select: {
      id: true,
    },
  });

  return {
    id: updatedRefund.id,
    created: false,
  };
}

async function getCompletionItems(
  tx: Prisma.TransactionClient,
  orderId: string,
  salesOrderId: string | null
) {
  const order = await tx.returnOrder.findUnique({
    where: { id: orderId },
    select: {
      items: {
        select: {
          damagedQuantity: true,
          productId: true,
          returnQuantity: true,
          salesOrderItemId: true,
        },
      },
      returnNumber: true,
      salesOrderId: true,
    },
  });

  if (!order) {
    throw new Error('退货订单不存在，无法执行完成退货入库');
  }

  let batchBySalesItemId = new Map<string, string | null>();
  if (salesOrderId && order.items.length > 0) {
    const salesOrderItems = await tx.salesOrderItem.findMany({
      where: {
        id: {
          in: order.items.map(item => item.salesOrderItemId),
        },
        salesOrderId,
      },
      select: {
        batchNumber: true,
        id: true,
      },
      take: order.items.length,
    });

    batchBySalesItemId = new Map(
      salesOrderItems.map(item => [item.id, item.batchNumber ?? null])
    );
  }

  return {
    items: order.items.map(item => ({
      batchNumber: batchBySalesItemId.get(item.salesOrderItemId) ?? null,
      damagedQuantity: item.damagedQuantity,
      productId: item.productId,
      returnQuantity: item.returnQuantity,
    })),
    returnNumber: order.returnNumber,
    salesOrderId: order.salesOrderId,
  };
}

export async function ensureRefundRecordForCompletedReturnOrder(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    refundAmount?: number;
    userId: string;
  }
): Promise<{ created: boolean; refundId?: string }> {
  const order = await tx.returnOrder.findUnique({
    where: { id: params.orderId },
    select: {
      customerId: true,
      id: true,
      processType: true,
      refundAmount: true,
      returnNumber: true,
      salesOrderId: true,
      status: true,
      totalAmount: true,
    },
  });

  if (!order) {
    throw new Error('退货订单不存在');
  }

  if (order.status !== 'completed') {
    throw new Error('只有已完成的退货单才能生成退款处理单');
  }

  if (order.processType !== 'refund') {
    throw new Error('当前退货单不是退款类型，无需生成退款处理单');
  }

  const computedRefundAmount = await resolveRefundAmount(
    tx,
    order,
    params.refundAmount
  );

  if (computedRefundAmount <= 0) {
    throw new Error('当前退货单没有待退款金额，无需生成退款处理单');
  }

  const currentRefundAmount = toNumber(order.refundAmount, 0);
  if (Math.abs(currentRefundAmount - computedRefundAmount) > 0.0001) {
    await tx.returnOrder.update({
      where: { id: order.id },
      data: { refundAmount: computedRefundAmount },
    });
  }

  const refundResult = await syncRefundRecord(
    tx,
    order,
    params.userId,
    computedRefundAmount
  );

  return refundResult
    ? {
        created: refundResult.created,
        refundId: refundResult.id,
      }
    : {
        created: false,
      };
}

export async function completeReturnOrderWorkflow(
  tx: Prisma.TransactionClient,
  params: {
    completedAt: Date;
    orderId: string;
    refundAmount?: number;
    userId: string;
  }
): Promise<ReturnOrderCompletionResult> {
  const order = await tx.returnOrder.findUnique({
    where: { id: params.orderId },
    select: {
      customerId: true,
      id: true,
      processType: true,
      refundAmount: true,
      returnNumber: true,
      salesOrderId: true,
      totalAmount: true,
    },
  });

  if (!order) {
    throw new Error('退货订单不存在');
  }

  const completionItems = await getCompletionItems(
    tx,
    order.id,
    order.salesOrderId
  );
  const inboundResults = await applyCompletionEffects(
    tx as unknown as Parameters<typeof applyCompletionEffects>[0],
    completionItems,
    params.userId
  );
  const affectedProductIds = Array.from(
    new Set(inboundResults.map(record => record.productId))
  );

  let refundCreated = false;
  let refundRecordId: string | undefined;

  if (order.processType === 'refund') {
    const computedRefundAmount = await resolveRefundAmount(
      tx,
      order,
      params.refundAmount
    );
    const currentRefundAmount = toNumber(order.refundAmount, 0);

    if (Math.abs(currentRefundAmount - computedRefundAmount) > 0.0001) {
      await tx.returnOrder.update({
        where: { id: order.id },
        data: {
          refundAmount: computedRefundAmount,
        },
      });
    }

    if (computedRefundAmount > 0) {
      const refundResult = await syncRefundRecord(
        tx,
        order,
        params.userId,
        computedRefundAmount
      );

      refundCreated = refundResult?.created === true;
      refundRecordId = refundResult?.id;

      try {
        await recordPartnerTransaction(
          {
            amount: roundCurrency(computedRefundAmount),
            description: `销售退货 ${order.returnNumber} 入账`,
            entityType: 'customer',
            metadata: {
              processType: order.processType,
              salesOrderId: order.salesOrderId ?? undefined,
              source: 'return_order',
              status: 'completed',
              triggeredBy: 'return_order:completed',
            },
            occurredAt: params.completedAt,
            partnerId: order.customerId,
            partnerRole: 'customer',
            referenceId: order.id,
            referenceNumber: order.returnNumber,
            transactionType: 'sales_return',
            userId: params.userId,
          },
          tx
        );
      } catch (error) {
        logger.error('return-order-orchestrator', '退货完成后同步往来账失败', error, {
          customerId: order.customerId,
          orderId: order.id,
          returnNumber: order.returnNumber,
        });
        throw new Error(
          `退货完成后同步往来账失败: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }

      if (order.salesOrderId) {
        await adjustSalesOrderProfitOnReturn(tx, {
          refundAmount: computedRefundAmount,
          salesOrderId: order.salesOrderId,
        });
      }
    }
  }

  return {
    affectedProductIds,
    refundCreated,
    refundRecordId,
  };
}
