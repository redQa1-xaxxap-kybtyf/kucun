import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { calculatePurchaseOrderExecution } from '@/lib/api/purchase-orders/fulfillment';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  ensurePurchaseOrderPayable,
  shouldCreatePayable,
} from '@/lib/services/purchase-order-payable';
import { generatePurchaseOrderNumber } from '@/lib/services/simple-order-number-generator';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import {
  createPurchaseOrderSchema,
  purchaseOrderListParamsSchema,
} from '@/lib/validations/purchase-order';

type ListParams = {
  page: number;
  limit: number;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  containerNumber?: string;
  orderNumber?: string;
  startDate?: Date;
  endDate?: Date;
  fulfillment?: 'none' | 'partial' | 'complete';
};

function parseAndValidateListParams(request: NextRequest): ListParams {
  const { searchParams } = new URL(request.url);
  const raw = {
    page: searchParams.get('page')
      ? parseInt(searchParams.get('page') || '1')
      : 1,
    limit: searchParams.get('limit')
      ? parseInt(
          searchParams.get('limit') ||
            paginationConfig.defaultPageSize.toString()
        )
      : paginationConfig.defaultPageSize,
    status: searchParams.get('status') || undefined,
    supplierId: searchParams.get('supplierId') || undefined,
    containerNumber: searchParams.get('containerNumber') || undefined,
    orderNumber: searchParams.get('orderNumber') || undefined,
    startDate: searchParams.get('startDate')
      ? new Date(searchParams.get('startDate') || '')
      : undefined,
    endDate: searchParams.get('endDate')
      ? new Date(searchParams.get('endDate') || '')
      : undefined,
    fulfillment: searchParams.get('fulfillment') || undefined,
  };

  const parsed = purchaseOrderListParamsSchema.parse(raw);
  return {
    page: parsed.page ?? 1,
    limit: parsed.limit ?? paginationConfig.defaultPageSize,
    status: parsed.status as PurchaseOrderStatus | undefined,
    supplierId: parsed.supplierId,
    containerNumber: parsed.containerNumber,
    orderNumber: parsed.orderNumber,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    fulfillment: parsed.fulfillment as
      | 'none'
      | 'partial'
      | 'complete'
      | undefined,
  };
}

function buildWhere(params: ListParams): Prisma.PurchaseOrderWhereInput {
  const where: Prisma.PurchaseOrderWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;
  if (params.containerNumber)
    where.containerNumber = { contains: params.containerNumber };
  if (params.orderNumber) where.orderNumber = { contains: params.orderNumber };
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }
  return where;
}

const orderListSelect = {
  id: true,
  orderNumber: true,
  containerNumber: true,
  shippingCompany: true,
  supplierId: true,
  userId: true,
  status: true,
  totalAmount: true,
  expenseAmount: true,
  costAmount: true,
  orderDate: true,
  shipmentDate: true,
  estimatedArrival: true,
  arrivalDate: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
  supplier: { select: { id: true, name: true, phone: true, address: true } },
  user: { select: { id: true, name: true, email: true } },
  items: {
    select: {
      id: true,
      productId: true,
      supplierId: true,
      productCode: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      unitCost: true,
      allocatedExpense: true,
      inboundStatus: true,
      inboundReceivedAt: true,
      isManualProduct: true,
      manualProductName: true,
      manualSpecification: true,
      manualWeight: true,
      manualUnit: true,
      displayName: true,
      specification: true,
      unit: true,
      weight: true,
      remarks: true,
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.PurchaseOrderSelect;

async function ensureSupplierExists(supplierId: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });
  if (!supplier) {
    throw new NextResponse(JSON.stringify({ error: '供应商不存在' }), {
      status: 400,
    }) as unknown as Error;
  }
}

async function ensureProductsExist(
  items: Array<{ isManualProduct?: boolean; productId?: string | null }>
) {
  const inventoryItems = items.filter(
    item => !item.isManualProduct && item.productId
  );
  if (inventoryItems.length === 0) return;
  const productIds = inventoryItems.map(item => item.productId || '');
  const existing = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map(p => p.id));
  const missing = productIds.filter(id => !existingIds.has(id));
  if (missing.length > 0) {
    throw new NextResponse(
      JSON.stringify({ error: `产品不存在: ${missing.join(', ')}` }),
      { status: 400 }
    ) as unknown as Error;
  }
}

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const params = parseAndValidateListParams(request);
    const where = buildWhere(params);
    const skip = (params.page - 1) * params.limit;

    const [orders, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        select: orderListSelect,
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

    const filteredOrders = params.fulfillment
      ? enhancedOrders.filter(
          order =>
            order.executionSummary?.fulfillmentStatus === params.fulfillment
        )
      : enhancedOrders;

    return NextResponse.json({
      data: filteredOrders,
      total: params.fulfillment ? filteredOrders.length : totalCount,
      page: params.page,
      limit: params.limit,
    });
  } catch (error) {
    logger.error('purchase-orders', '获取采购订单列表失败', error, {
      userId: user.id,
      url: request.url,
    });
    return NextResponse.json({ error: '获取订单列表失败' }, { status: 500 });
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const userId = user.id;
    const body = await request.json();
    const parsed = createPurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues.map(issue => ({
        path: issue.path.length > 0 ? issue.path.join('.') : 'root',
        message: issue.message,
        code: issue.code,
      }));

      logger.warn(
        'purchase-orders',
        '创建采购订单参数验证失败',
        { userId },
        { errors: details }
      );

      return NextResponse.json(
        { error: '参数验证失败', details },
        { status: 422 }
      );
    }
    const { containerNumber, supplierId, status, remarks, items, feeItems } =
      parsed.data;

    if (!supplierId || !supplierId.trim()) {
      return NextResponse.json(
        { error: '订单级别供应商不能为空' },
        { status: 400 }
      );
    }
    const normalizedSupplierId = supplierId.trim();
    await ensureSupplierExists(normalizedSupplierId);
    await ensureProductsExist(items);

    const orderNumber = await generatePurchaseOrderNumber();
    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const expenseAmount =
      feeItems?.reduce((sum, fee) => sum + fee.feeAmount, 0) || 0;

    const order = await prisma.$transaction(async tx => {
      const newOrder = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          containerNumber: containerNumber?.trim() || null,
          supplierId: normalizedSupplierId,
          userId,
          status: status ?? PURCHASE_ORDER_STATUS.DRAFT,
          totalAmount,
          expenseAmount,
          remarks: remarks?.trim() || null,
          items: {
            create: items.map(item => ({
              productId: item.isManualProduct ? null : item.productId,
              supplierId: item.supplierId,
              productCode: item.productCode,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              isManualProduct: item.isManualProduct || false,
              manualProductName: item.manualProductName?.trim() || null,
              manualSpecification: item.manualSpecification?.trim() || null,
              manualWeight: item.manualWeight,
              manualUnit: item.manualUnit?.trim() || null,
              displayName: item.displayName,
              specification: item.specification?.trim() || null,
              unit: item.unit || 'piece',
              weight: item.weight,
              remarks: item.remarks?.trim() || null,
            })),
          },
        },
        include: {
          supplier: {
            select: { id: true, name: true, phone: true, address: true },
          },
          user: { select: { id: true, name: true, email: true } },
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
                select: { id: true, name: true, phone: true, address: true },
              },
            },
          },
        },
      });

      if (shouldCreatePayable(newOrder.status as PurchaseOrderStatus)) {
        await ensurePurchaseOrderPayable(tx, {
          id: newOrder.id,
          supplierId: newOrder.supplierId,
          userId,
          orderNumber: newOrder.orderNumber,
          totalAmount,
        });
      }

      if (feeItems && feeItems.length > 0) {
        const expenseRecords = feeItems.map(feeItem => ({
          expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          expenseType: feeItem.feeType,
          expenseName: feeItem.feeName,
          expenseAmount: feeItem.feeAmount,
          expenseDate: new Date(),
          relatedType: 'purchase_order',
          relatedId: newOrder.id,
          relatedNumber: newOrder.orderNumber,
          remarks: feeItem.remarks || undefined,
          userId,
        }));

        await tx.expenseRecord.createMany({
          data: expenseRecords,
        });
      }

      return newOrder;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    logger.error('purchase-orders', '创建采购订单失败', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: '订单号已存在' }, { status: 400 });
    }

    return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
  }
});
