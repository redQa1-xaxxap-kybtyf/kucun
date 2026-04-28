import { NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import {
  getAffectedProductIds,
  updateSalesOrderStatus,
} from '@/lib/api/handlers/sales-order-status';
import { getSalesOrderDetailWithPayments } from '@/lib/api/handlers/sales-orders/detail';
import { updateSalesOrderDraft } from '@/lib/api/handlers/sales-orders/update-draft';
import type { ApiHandler } from '@/lib/auth/api-helpers';
import { invalidateSalesOrderAndReceivables } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import {
  calculateSalesOrderRemainingAmount,
  calculateSalesOrderSettledAmount,
} from '@/lib/services/sales-order-settlement';
import {
  createTransferPayableRecord,
  validateStatusTransition,
} from '@/lib/services/sales-order-service';
import { withIdempotency } from '@/lib/utils/idempotency';
import { toNumber } from '@/lib/utils/number';
import { getSalesOrderReceivableTotal } from '@/lib/utils/sample-order';
import { updateOrderStatusSchema } from '@/lib/validations/sales-order';

async function resolveId(
  params?: Promise<Record<string, string>> | Record<string, string>
): Promise<string> {
  const bag = params ? await Promise.resolve(params) : {};
  const id = (bag as Record<string, string>).id;
  if (!id) throw ApiError.badRequest('缺少参数 id');
  return id;
}

// GET /api/sales-orders/[id]
export const getSalesOrderRoute: ApiHandler = async (_request, { params }) => {
  const id = await resolveId(params);
  const data = await getSalesOrderDetailWithPayments(id);
  if (!data) throw ApiError.notFound('销售订单');
  return NextResponse.json({ success: true, data });
};

// PUT /api/sales-orders/[id] — 更新状态
// eslint-disable-next-line max-lines-per-function -- Complex order status update logic requires comprehensive validation and transaction handling
export const putSalesOrderRoute: ApiHandler = async (
  request,
  { user, params }
) => {
  const id = await resolveId(params);
  const userId = user.id;
  const body = await request.json();

  const parsed = updateOrderStatusSchema.safeParse({ id, ...body });
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: '输入数据格式不正确',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const { idempotencyKey, status, remarks } = parsed.data;

  const existingOrder = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderType: true,
      supplierId: true,
      costAmount: true,
      items: {
        select: {
          productId: true,
        },
      },
    },
  });
  if (!existingOrder) {
    return NextResponse.json(
      { success: false, error: '销售订单不存在' },
      { status: 404 }
    );
  }

  const transition = validateStatusTransition(existingOrder.status, status);
  if (!transition.valid) {
    return NextResponse.json(
      { success: false, error: transition.error },
      { status: 400 }
    );
  }

  // 如果直接标记完成，校验收款是否完成
  if (status === 'completed') {
    const o = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        totalAmount: true,
        roundingAdjustment: true,
        isSampleOrder: true,
        sampleSettlementType: true,
        payments: {
          where: { status: { in: ['confirmed', 'applied'] } },
          select: {
            status: true,
            paymentAmount: true,
            actualPaymentAmount: true,
            roundingAmount: true,
            remarks: true,
          },
        },
        prepaymentUsages: {
          select: { appliedAmount: true },
        },
      },
    });
    if (o) {
      const actualTotal = getSalesOrderReceivableTotal({
        isSampleOrder: o.isSampleOrder,
        sampleSettlementType: o.sampleSettlementType,
        totalAmount: o.totalAmount,
        roundingAdjustment: o.roundingAdjustment,
      });
      const remaining = calculateSalesOrderRemainingAmount({
        receivableTotal: actualTotal,
        payments: o.payments,
        prepaymentUsages: o.prepaymentUsages,
      });
      if (remaining > 0.01) {
        return NextResponse.json(
          {
            success: false,
            error: `订单尚未全部收款，还有 ${remaining.toFixed(2)} 元待收款，无法标记为完成`,
          },
          { status: 400 }
        );
      }
    }
  }

  // 幂等包装状态更新
  const result = await withIdempotency(
    idempotencyKey,
    'sales_order_status_change',
    existingOrder.id,
    userId,
    { status, remarks },
    async () =>
      await updateSalesOrderStatus(
        id,
        status,
        existingOrder.status,
        remarks,
        userId
      )
  );

  // 库存相关缓存失效
  if (result.inventoryUpdated || result.reservedInventoryReleased) {
    const { invalidateInventoryCache } = await import(
      '@/lib/cache/inventory-cache'
    );
    const productIds = await getAffectedProductIds(id);
    for (const productId of productIds) {
      await invalidateInventoryCache(productId);
    }
  }

  // 调货单确认后创建应付款
  if (
    status === 'confirmed' &&
    existingOrder.orderType === 'TRANSFER' &&
    existingOrder.supplierId &&
    toNumber(existingOrder.costAmount, 0) > 0
  ) {
    const transferCostAmount = toNumber(existingOrder.costAmount, 0);
    await createTransferPayableRecord(
      existingOrder.id,
      existingOrder.orderNumber,
      existingOrder.supplierId,
      transferCostAmount,
      userId
    );
  }

  // 发货后如已全额收款则自动完成
  if (status === 'shipped') {
    await maybeAutoCompleteAfterShipped(id, existingOrder.orderNumber);
  }

  // 统一响应：返回最新详情
  const data = await getSalesOrderDetailWithPayments(id);

  // 草稿->确认：补齐往来账台账（与“创建即确认”保持一致）
  if (existingOrder.status === 'draft' && status === 'confirmed' && data) {
    const totalAmount = toNumber(
      (data as { totalAmount?: unknown }).totalAmount,
      0
    );
    const roundingAdjustment = toNumber(
      (data as { roundingAdjustment?: unknown }).roundingAdjustment,
      0
    );
    const due = getSalesOrderReceivableTotal({
      isSampleOrder: data.isSampleOrder,
      sampleSettlementType: data.sampleSettlementType,
      totalAmount,
      roundingAdjustment,
    });

    if (due > 0) {
      recordPartnerTransaction({
        partnerId: data.customerId,
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: due,
        referenceId: data.id,
        referenceNumber: data.orderNumber,
        description: `销售订单 ${data.orderNumber} 确认应收`,
        userId,
        occurredAt: data.orderDate ? new Date(data.orderDate) : new Date(),
        metadata: {
          status: data.status,
          triggeredBy: 'order:confirm',
        },
      }).catch(error => {
        logger.error('sales-orders', '记录往来账失败', error, {
          orderId: data.id,
          orderNumber: data.orderNumber,
        });
      });
    }
  }

  const message =
    existingOrder.status === 'confirmed' && status === 'draft'
      ? '销售订单已撤回为草稿'
      : status === 'confirmed'
        ? '销售订单已确认'
        : status === 'shipped'
          ? '销售订单已发货'
          : status === 'completed'
            ? '销售订单已完成'
            : status === 'cancelled'
              ? '销售订单已取消'
              : '销售订单更新成功';

  // ✅ P0修复：销售订单状态更新后，失效销售订单和应收款缓存
  invalidateSalesOrderAndReceivables(id).catch(error => {
    logger.error('sales-orders', '销售订单和应收款缓存失效失败', error, {
      orderId: id,
      operation: 'cache_invalidation',
    });
  });

  return NextResponse.json({ success: true, data, message });
};

// PATCH /api/sales-orders/[id] — 更新草稿
export const patchSalesOrderRoute: ApiHandler = async (
  request,
  { user, params }
) => {
  const id = await resolveId(params);
  const body = await request.json();

  const { salesOrderUpdateSchema } = await import(
    '@/lib/validations/sales-order'
  );
  const parsed = salesOrderUpdateSchema.safeParse({ id, ...body });
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: '输入数据格式不正确',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  // 草稿更新接口仅允许编辑草稿内容，不允许通过 PATCH 修改状态（避免绕过库存预留/台账逻辑）。
  if (parsed.data.status !== undefined && parsed.data.status !== 'draft') {
    return NextResponse.json(
      {
        success: false,
        error:
          '草稿更新不允许修改订单状态，请使用“更新状态”接口进行确认/发货/取消。',
      },
      { status: 400 }
    );
  }

  const existingOrder = (await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      orderType: true,
      transferMode: true,
      supplierId: true,
      updatedAt: true,
    },
  })) as {
    id: string;
    status: string;
    orderNumber: string;
    orderType: 'NORMAL' | 'TRANSFER' | null;
    transferMode: 'SUPPLIER_ONLY' | 'MIXED' | null;
    supplierId: string | null;
    updatedAt: Date;
  } | null;
  if (!existingOrder) {
    return NextResponse.json(
      { success: false, error: '销售订单不存在' },
      { status: 404 }
    );
  }
  if (existingOrder.status !== 'draft') {
    return NextResponse.json(
      { success: false, error: '只能更新草稿状态的订单' },
      { status: 400 }
    );
  }

  const data = await updateSalesOrderDraft(
    id,
    parsed.data,
    existingOrder,
    user.id
  );

  // ✅ P0修复：销售订单草稿更新后，失效销售订单和应收款缓存
  invalidateSalesOrderAndReceivables(id).catch(error => {
    logger.error('sales-orders', '销售订单和应收款缓存失效失败', error, {
      orderId: id,
      operation: 'cache_invalidation_draft',
    });
  });

  return NextResponse.json({
    success: true,
    data,
    message: '销售订单更新成功',
  });
};

// DELETE /api/sales-orders/[id]
export const deleteSalesOrderRoute: ApiHandler = async (
  _request,
  { params }
) => {
  const id = await resolveId(params);
  const existingOrder = await prisma.salesOrder.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, status: true },
  });
  if (!existingOrder) {
    return NextResponse.json(
      { success: false, error: '销售订单不存在' },
      { status: 404 }
    );
  }
  if (existingOrder.status !== 'cancelled') {
    return NextResponse.json(
      { success: false, error: '只有已取消的销售订单才能删除' },
      { status: 400 }
    );
  }
  await prisma.$transaction(async tx => {
    await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
    await tx.salesOrderFeeItem.deleteMany({ where: { salesOrderId: id } });
    await tx.salesOrder.delete({ where: { id } });
  });

  // ✅ P0修复：销售订单删除后，失效销售订单和应收款缓存
  invalidateSalesOrderAndReceivables(id).catch(error => {
    logger.error('sales-orders', '销售订单和应收款缓存失效失败', error, {
      orderId: id,
      operation: 'cache_invalidation_delete',
    });
  });

  return NextResponse.json({
    success: true,
    data: { id },
    message: `销售订单 ${existingOrder.orderNumber} 已删除`,
  });
};

async function maybeAutoCompleteAfterShipped(id: string, orderNumber: string) {
  const o = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      totalAmount: true,
      roundingAdjustment: true,
      isSampleOrder: true,
      sampleSettlementType: true,
      payments: {
        where: { status: { in: ['confirmed', 'applied'] } },
        select: {
          status: true,
          paymentAmount: true,
          actualPaymentAmount: true,
          roundingAmount: true,
          remarks: true,
        },
      },
      prepaymentUsages: {
        select: { appliedAmount: true },
      },
    },
  });
  if (!o) return;
  const actualTotal = getSalesOrderReceivableTotal({
    isSampleOrder: o.isSampleOrder,
    sampleSettlementType: o.sampleSettlementType,
    totalAmount: o.totalAmount,
    roundingAdjustment: o.roundingAdjustment,
  });
  const paid = calculateSalesOrderSettledAmount({
    payments: o.payments,
    prepaymentUsages: o.prepaymentUsages,
  });
  const remaining = actualTotal - paid;
  if (remaining <= 0.01) {
    await prisma.salesOrder.update({
      where: { id },
      data: { status: 'completed' },
    });
    logger.info(
      'sales-orders',
      `订单 ${orderNumber} 发货后检测到已全额收款,自动完成订单`,
      {
        orderId: id,
        orderNumber,
        totalAmount: Number(o.totalAmount),
        roundingAdjustment:
          o.roundingAdjustment === null || o.roundingAdjustment === undefined
            ? null
            : Number(o.roundingAdjustment),
        paidAmount: paid,
        remainingAmount: remaining,
      }
    );
  }
}
