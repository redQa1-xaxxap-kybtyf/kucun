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
import {
  createTransferPayableRecord,
  validateStatusTransition,
} from '@/lib/services/sales-order-service';
import { withIdempotency } from '@/lib/utils/idempotency';
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
        payments: {
          where: { status: 'confirmed' },
          select: { actualPaymentAmount: true, roundingAmount: true },
        },
      },
    });
    if (o) {
      const paid = o.payments.reduce(
        (s, r) =>
          s + Number(r.actualPaymentAmount) + Number(r.roundingAmount || 0),
        0
      );
      const actualTotal =
        Number(o.totalAmount) + Number(o.roundingAdjustment || 0);
      const remaining = actualTotal - paid;
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
    id,
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
    (existingOrder.costAmount || 0) > 0
  ) {
    await createTransferPayableRecord(
      existingOrder.id,
      existingOrder.orderNumber,
      existingOrder.supplierId,
      existingOrder.costAmount || 0,
      userId
    );
  }

  // 发货后如已全额收款则自动完成
  if (status === 'shipped') {
    await maybeAutoCompleteAfterShipped(id, existingOrder.orderNumber);
  }

  // 统一响应：返回最新详情
  const data = await getSalesOrderDetailWithPayments(id);
  const message =
    status === 'confirmed'
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

  const existingOrder = (await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      orderType: true,
      transferMode: true,
      supplierId: true,
    },
  })) as {
    id: string;
    status: string;
    orderNumber: string;
    orderType: 'NORMAL' | 'TRANSFER' | null;
    transferMode: 'SUPPLIER_ONLY' | 'MIXED' | null;
    supplierId: string | null;
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
      payments: {
        where: { status: 'confirmed' },
        select: { actualPaymentAmount: true, roundingAmount: true },
      },
    },
  });
  if (!o) return;
  const paid = o.payments.reduce(
    (s, r) => s + Number(r.actualPaymentAmount) + Number(r.roundingAmount || 0),
    0
  );
  const actualTotal = Number(o.totalAmount) + Number(o.roundingAdjustment || 0);
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
        totalAmount: o.totalAmount,
        roundingAdjustment: o.roundingAdjustment,
        paidAmount: paid,
        remainingAmount: remaining,
      }
    );
  }
}
