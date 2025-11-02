// 单个厂家发货订单 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import type { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withIdempotency } from '@/lib/utils/idempotency';
import {
  updateFactoryShipmentOrderSchema,
  type FactoryShipmentOrderItemData,
  type UpdateFactoryShipmentOrderData,
} from '@/lib/validations/factory-shipment';
 

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// 统一的 include 配置（避免重复定义，减少 PUT 体积）
const fullOrderInclude = {
  customer: { select: { id: true, name: true, phone: true, address: true } },
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
      supplier: { select: { id: true, name: true, phone: true, address: true } },
    },
  },
} as const;

function fulfillmentSummary(items: Array<{ ownership: string; totalPrice: number }>) {
  return {
    customerOwnedAmount: items
      .filter(item => item.ownership === 'customer')
      .reduce((sum, item) => sum + item.totalPrice, 0),
    selfOwnedAmount: items
      .filter(item => item.ownership === 'self')
      .reduce((sum, item) => sum + item.totalPrice, 0),
  };
}

function computeAmountSummary(items?: Array<{ quantity: number; unitPrice: number; ownership?: 'customer' | 'self' }>) {
  if (!items) return undefined;
  return items.reduce(
    (acc, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      acc.total += lineTotal;
      if ((item.ownership || 'customer') === 'customer') acc.customer += lineTotal;
      else acc.self += lineTotal;
      return acc;
    },
    { total: 0, customer: 0, self: 0 }
  );
}

async function validateEntities({
  items,
  customerId,
}: {
  items?: Array<{ isManualProduct?: boolean; productId?: string | null; supplierId: string }>;
  customerId?: string;
}) {
  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { code: 400 as const, message: '客户不存在' };
  }

  if (items && items.length > 0) {
    const inventoryItems = items.filter(item => !item.isManualProduct && item.productId);
    if (inventoryItems.length > 0) {
      const productIds = inventoryItems.map(i => i.productId || '');
      const existingProducts = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
      const existingSet = new Set(existingProducts.map(p => p.id));
      const missing = productIds.filter(id => !existingSet.has(id));
      if (missing.length > 0) return { code: 400 as const, message: `商品不存在: ${missing.join(', ')}` };
    }

    const supplierIds = [...new Set(items.map(i => i.supplierId))];
    const existingSuppliers = await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true } });
    const existingSupplierSet = new Set(existingSuppliers.map(s => s.id));
    const missingSuppliers = supplierIds.filter(id => !existingSupplierSet.has(id));
    if (missingSuppliers.length > 0) return { code: 400 as const, message: `供应商不存在: ${missingSuppliers.join(', ')}` };
  }

  return null;
}

function mapItemCreate(item: FactoryShipmentOrderItemData) {
  return {
    productId: item.isManualProduct ? null : item.productId,
    supplierId: item.supplierId,
    productCode: item.productCode,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.quantity * item.unitPrice,
    ownership: item.ownership || 'customer',
    ownershipRemarks: item.ownershipRemarks || null,
    customerDeliveryStatus:
      item.ownership === 'customer' ? (item.customerDeliveryStatus ?? 'pending') : null,
    selfInboundStatus: item.ownership === 'self' ? (item.selfInboundStatus ?? 'pending') : null,
    deliveryConfirmedAt: null,
    inboundReceivedAt: null,
    isManualProduct: item.isManualProduct || false,
    manualProductName: item.manualProductName,
    manualSpecification: item.manualSpecification,
    manualWeight: item.manualWeight,
    manualUnit: item.manualUnit,
    displayName: item.displayName || '',
    specification: item.specification,
    unit: item.unit,
    weight: item.weight,
    remarks: item.remarks,
  };
}

function buildUpdateData(
  validatedData: UpdateFactoryShipmentOrderData,
  calculatedTotalAmount?: number
): Partial<Prisma.FactoryShipmentOrderUncheckedUpdateInput> {
  const {
    containerNumber,
    customerId,
    status,
    totalAmount,
    receivableAmount,
    depositAmount,
    paidAmount,
    remarks,
    shipmentDate,
    arrivalDate,
    deliveryDate,
    completionDate,
    items,
  } = validatedData;

  const data: Partial<Prisma.FactoryShipmentOrderUncheckedUpdateInput> = {};
  if (containerNumber) data.containerNumber = containerNumber;
  if (customerId) data.customerId = customerId;
  if (status) data.status = status;
  if (totalAmount !== undefined) data.totalAmount = totalAmount;
  if (receivableAmount !== undefined) data.receivableAmount = receivableAmount;
  if (depositAmount !== undefined) data.depositAmount = depositAmount;
  if (paidAmount !== undefined) data.paidAmount = paidAmount;
  if (remarks !== undefined) data.remarks = remarks;
  if (shipmentDate !== undefined) data.shipmentDate = shipmentDate;
  if (arrivalDate !== undefined) data.arrivalDate = arrivalDate;
  if (deliveryDate !== undefined) data.deliveryDate = deliveryDate;
  if (completionDate !== undefined) data.completionDate = completionDate;
  if (calculatedTotalAmount !== undefined) data.totalAmount = calculatedTotalAmount;
  if (items) {
    data.items = { deleteMany: {}, create: items.map(mapItemCreate) };
    // 如果未显式提供 receivableAmount，按客户归属总额覆盖
    if (receivableAmount === undefined) {
      const summary = computeAmountSummary(items);
      data.receivableAmount = summary ? summary.customer : undefined;
    }
  }
  return data;
}

async function applyStatusChangeAndFetchFullOrder(
  id: string,
  existingStatus: string,
  operationUserId: string,
  validatedData: UpdateFactoryShipmentOrderData,
  newStatus: NonNullable<UpdateFactoryShipmentOrderData['status']>
) {
  const { idempotencyKey, containerNumber, shippingCompany, estimatedArrival, remarks, shipmentDate, arrivalDate, deliveryDate, completionDate } = validatedData;
  const { updateFactoryShipmentStatus } = await import('@/lib/api/handlers/factory-shipment-status');
  const result = await withIdempotency(
    idempotencyKey,
    'factory_shipment_status_change',
    id,
    operationUserId,
    {
      containerNumber,
      shippingCompany,
      estimatedArrival,
      remarks,
      shipmentDate,
      arrivalDate,
      deliveryDate,
      completionDate,
    },
    async () =>
      await updateFactoryShipmentStatus(id, newStatus, existingStatus, {
        containerNumber,
        shippingCompany,
        estimatedArrival,
        remarks,
        shipmentDate,
        arrivalDate,
        deliveryDate,
        completionDate,
      })
  );

  const fullOrder = await prisma.factoryShipmentOrder.findUnique({
    where: { id },
    include: fullOrderInclude,
  });

  return { result, fullOrder };
}

// 获取单个厂家发货订单详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    // 查询订单详情
    const order = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, address: true },
        },
        user: {
          select: { id: true, name: true, email: true },
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
              select: { id: true, name: true, phone: true, address: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    const responsePayload = {
      ...order,
      fulfillmentSummary: {
        customerOwnedAmount: order.items
          .filter(item => item.ownership === 'customer')
          .reduce((sum, item) => sum + item.totalPrice, 0),
        selfOwnedAmount: order.items
          .filter(item => item.ownership === 'self')
          .reduce((sum, item) => sum + item.totalPrice, 0),
      },
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    logger.error('factory-shipments', '获取厂家发货订单详情失败', error, {
      orderId: id,
    });
    return NextResponse.json({ error: '获取订单详情失败' }, { status: 500 });
  }
}

// 更新厂家发货订单
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    // 检查订单是否存在
    const existingOrder = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = updateFactoryShipmentOrderSchema.parse(body);
    const { customerId, status, items } = validatedData;

    // 如果有状态变更,使用幂等性包装器
    const operationUserId = existingOrder.userId;
    if (status && status !== existingOrder.status) {
      const { result, fullOrder } = await applyStatusChangeAndFetchFullOrder(
        id,
        existingOrder.status,
        operationUserId,
        validatedData,
        status
      );
      return NextResponse.json({ ...fullOrder, receivableCreated: result.receivableCreated });
    }

    // 验证实体存在性
    const validationError = await validateEntities({ items, customerId });
    if (validationError) {
      return NextResponse.json({ error: validationError.message }, { status: validationError.code });
    }

    // 计算订单金额与归属汇总（如果更新了商品明细）
    const amountSummary = computeAmountSummary(items);
    const calculatedTotalAmount = amountSummary?.total;

    // 更新厂家发货订单
    await prisma.factoryShipmentOrder.update({ where: { id }, data: buildUpdateData(validatedData, calculatedTotalAmount) });

    // 重新查询更新后的订单（包含关联数据）
    const updatedOrder = await prisma.factoryShipmentOrder.findUnique({ where: { id }, include: fullOrderInclude });

    if (!updatedOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    return NextResponse.json({
      ...updatedOrder,
      fulfillmentSummary: fulfillmentSummary(
        updatedOrder.items as Array<{ ownership: string; totalPrice: number }>
      ),
    });
  } catch (error) {
    logger.error('factory-shipments', '更新厂家发货订单失败', error, {
      orderId: id,
    });

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: '集装箱号码已存在' }, { status: 400 });
    }

    return NextResponse.json({ error: '更新订单失败' }, { status: 500 });
  }
}

// 删除厂家发货订单
// 权限规则：只允许删除草稿和已取消的订单
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    // 检查订单是否存在
    const existingOrder = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 验证订单状态是否允许删除
    const allowedStatuses = ['draft', 'cancelled'];
    if (!allowedStatuses.includes(existingOrder.status)) {
      return NextResponse.json(
        {
          error: '只能删除草稿或已取消的订单',
          currentStatus: existingOrder.status,
        },
        { status: 400 }
      );
    }

    // 删除订单（级联删除订单明细）
    await prisma.factoryShipmentOrder.delete({
      where: { id },
    });

    logger.info('factory-shipments', '删除厂家发货订单成功', {
      orderId: id,
      orderNumber: existingOrder.orderNumber,
      status: existingOrder.status,
    });

    return NextResponse.json({ message: '订单删除成功' });
  } catch (error) {
    logger.error('factory-shipments', '删除厂家发货订单失败', error, {
      orderId: id,
    });
    return NextResponse.json({ error: '删除订单失败' }, { status: 500 });
  }
}
