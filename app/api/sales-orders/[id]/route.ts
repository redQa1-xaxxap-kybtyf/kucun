import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { publishOrderStatus } from '@/lib/events';
import {
  createTransferPayableRecord,
  validateStatusTransition,
} from '@/lib/services/sales-order-service';
import { withIdempotency } from '@/lib/utils/idempotency';
import { updateOrderStatusSchema } from '@/lib/validations/sales-order';

/**
 * 格式化销售订单数据
 */
function formatSalesOrder(salesOrder: {
  id: string;
  orderNumber: string;
  customerId: string;
  totalAmount: number;
  status: string;
  remarks?: string | null;
  customer: unknown;
  user: unknown;
  items: Array<{
    id: string;
    productId: string;
    colorCode?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    remarks?: string | null;
  }>;
}) {
  return {
    id: salesOrder.id,
    orderNumber: salesOrder.orderNumber,
    customerId: salesOrder.customerId,
    userId: salesOrder.userId,
    status: salesOrder.status,
    totalAmount: salesOrder.totalAmount,
    remarks: salesOrder.remarks,
    customer: salesOrder.customer,
    user: salesOrder.user,
    items: salesOrder.items.map(item => ({
      id: item.id,
      productId: item.productId,
      colorCode: item.colorCode,
      productionDate: item.productionDate,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      product: item.product,
    })),
    createdAt: salesOrder.createdAt,
    updatedAt: salesOrder.updatedAt,
  };
}

// 获取单个销售订单信息
export const GET = withAuth(
  async (request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        orderType: true,
        supplierId: true,
        costAmount: true,
        profitAmount: true,
        totalAmount: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
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
            email: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                specification: true,
                unit: true,
                piecesPerUnit: true,
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
      throw ApiError.notFound('销售订单');
    }

    // 转换数据格式
    const formattedOrder = formatSalesOrder(salesOrder);

    return NextResponse.json({
      success: true,
      data: formattedOrder,
    });
  },
  { permissions: ['orders:view'] }
);

// 更新销售订单状态
export const PUT = withAuth(
  async (request: NextRequest, { user, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    const userId = user.id;

    const body = await request.json();

    // 验证输入数据 - 使用状态更新专用schema
    const validationResult = updateOrderStatusSchema.safeParse({
      id,
      ...body,
    });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { idempotencyKey, status, remarks } = validationResult.data;

    // 检查订单是否存在
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

    // 验证状态流转规则(使用服务层函数)
    const validation = validateStatusTransition(existingOrder.status, status);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // 使用幂等性包装器执行状态更新
    const { updateSalesOrderStatus, getAffectedProductIds } = await import(
      '@/lib/api/handlers/sales-order-status'
    );

    const result = await withIdempotency(
      idempotencyKey,
      'sales_order_status_change',
      id,
      userId,
      { status, remarks },
      async () =>
        await updateSalesOrderStatus(id, status, existingOrder.status, remarks)
    );

    // 如果涉及库存变更,清除缓存
    if (result.inventoryUpdated || result.reservedInventoryReleased) {
      const { invalidateInventoryCache } = await import(
        '@/lib/cache/inventory-cache'
      );
      const productIds = await getAffectedProductIds(id);
      for (const productId of productIds) {
        await invalidateInventoryCache(productId);
      }
    }

    // 如果是调货销售且状态变更为confirmed,创建应付款记录(使用服务层函数)
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

    // 获取更新后的完整订单信息
    const fullOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        totalAmount: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
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
        items: {
          select: {
            id: true,
            productId: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    // 转换数据格式
    if (!fullOrder) {
      return NextResponse.json(
        { success: false, error: '订单更新失败' },
        { status: 500 }
      );
    }

    const formattedOrder = {
      id: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      customerId: fullOrder.customerId,
      userId: fullOrder.userId,
      status: fullOrder.status,
      totalAmount: fullOrder.totalAmount,
      remarks: fullOrder.remarks,
      customer: fullOrder.customer,
      user: fullOrder.user,
      items: fullOrder.items.map(item => ({
        id: item.id,
        productId: item.productId,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        product: item.product,
      })),
      createdAt: fullOrder.createdAt,
      updatedAt: fullOrder.updatedAt,
    };

    // 发布订单状态变更事件
    await publishOrderStatus({
      orderType: 'sales',
      orderId: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      oldStatus: existingOrder.status,
      newStatus: fullOrder.status,
      customerId: fullOrder.customerId,
      customerName: fullOrder.customer.name,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: formattedOrder,
      message: '销售订单更新成功',
    });
  },
  { permissions: ['orders:edit'] }
);
