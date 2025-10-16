// 单个厂家发货订单 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withIdempotency } from '@/lib/utils/idempotency';
import { updateFactoryShipmentOrderSchema } from '@/lib/validations/factory-shipment';

interface RouteParams {
  params: {
    id: string;
  };
}

// 获取单个厂家发货订单详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
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
  const { id } = params;
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
    const {
      idempotencyKey,
      containerNumber,
      customerId,
      status,
      totalAmount,
      receivableAmount,
      depositAmount,
      paidAmount,
      remarks,
      planDate,
      shipmentDate,
      arrivalDate,
      deliveryDate,
      completionDate,
      items,
    } = validatedData;

    // 如果有状态变更,使用幂等性包装器
    const operationUserId = existingOrder.userId;

    if (status && status !== existingOrder.status) {
      const { updateFactoryShipmentStatus } = await import(
        '@/lib/api/handlers/factory-shipment-status'
      );

      const result = await withIdempotency(
        idempotencyKey,
        'factory_shipment_status_change',
        id,
        operationUserId,
        {
          status,
          remarks,
          shipmentDate,
          arrivalDate,
          deliveryDate,
          completionDate,
        },
        async () =>
          await updateFactoryShipmentStatus(id, status, existingOrder.status, {
            remarks,
            shipmentDate,
            arrivalDate,
            deliveryDate,
            completionDate,
          })
      );

      // 获取更新后的完整订单信息
      const fullOrder = await prisma.factoryShipmentOrder.findUnique({
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

      return NextResponse.json({
        ...fullOrder,
        receivableCreated: result.receivableCreated,
      });
    }

    // 验证客户是否存在（如果提供了customerId）
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        return NextResponse.json({ error: '客户不存在' }, { status: 400 });
      }
    }

    // 如果更新了商品明细，需要验证商品和供应商
    if (items) {
      // 验证库存商品是否存在（排除手动输入的商品）
      const inventoryItems = items.filter(
        item => !item.isManualProduct && item.productId
      );
      if (inventoryItems.length > 0) {
        const productIds = inventoryItems.map(item => item.productId || '');
        const existingProducts = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true },
        });

        const existingProductIds = existingProducts.map(p => p.id);
        const missingProductIds = productIds.filter(
          id => !existingProductIds.includes(id)
        );

        if (missingProductIds.length > 0) {
          return NextResponse.json(
            { error: `商品不存在: ${missingProductIds.join(', ')}` },
            { status: 400 }
          );
        }
      }

      // 验证供应商是否存在
      const supplierIds = [...new Set(items.map(item => item.supplierId))];
      const existingSuppliers = await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true },
      });

      const existingSupplierIds = existingSuppliers.map(s => s.id);
      const missingSupplierIds = supplierIds.filter(
        id => !existingSupplierIds.includes(id)
      );

      if (missingSupplierIds.length > 0) {
        return NextResponse.json(
          { error: `供应商不存在: ${missingSupplierIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // 计算订单金额与归属汇总（如果更新了商品明细）
    const amountSummary = items
      ? items.reduce(
          (acc, item) => {
            const lineTotal = item.quantity * item.unitPrice;
            acc.total += lineTotal;
            if ((item.ownership || 'customer') === 'customer') {
              acc.customer += lineTotal;
            } else {
              acc.self += lineTotal;
            }
            return acc;
          },
          { total: 0, customer: 0, self: 0 }
        )
      : undefined;
    const calculatedTotalAmount = amountSummary?.total;

    // 更新厂家发货订单
    const updatedOrder = await prisma.factoryShipmentOrder.update({
      where: { id },
      data: {
        ...(containerNumber && { containerNumber }),
        ...(customerId && { customerId }),
        ...(status && { status }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(receivableAmount !== undefined
          ? { receivableAmount }
          : amountSummary && { receivableAmount: amountSummary.customer }),
        ...(depositAmount !== undefined && { depositAmount }),
        ...(paidAmount !== undefined && { paidAmount }),
        ...(remarks !== undefined && { remarks }),
        ...(planDate !== undefined && { planDate }),
        ...(shipmentDate !== undefined && { shipmentDate }),
        ...(arrivalDate !== undefined && { arrivalDate }),
        ...(deliveryDate !== undefined && { deliveryDate }),
        ...(completionDate !== undefined && { completionDate }),
        ...(calculatedTotalAmount !== undefined && {
          totalAmount: calculatedTotalAmount,
        }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map(item => ({
              productId: item.isManualProduct ? null : item.productId,
              supplierId: item.supplierId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              ownership: item.ownership || 'customer',
              ownershipRemarks: item.ownershipRemarks || null,
              customerDeliveryStatus:
                item.ownership === 'customer'
                  ? (item.customerDeliveryStatus ?? 'pending')
                  : null,
              selfInboundStatus:
                item.ownership === 'self'
                  ? (item.selfInboundStatus ?? 'pending')
                  : null,
              deliveryConfirmedAt: null,
              inboundReceivedAt: null,
              isManualProduct: item.isManualProduct || false,
              manualProductName: item.manualProductName,
              manualSpecification: item.manualSpecification,
              manualWeight: item.manualWeight,
              manualUnit: item.manualUnit,
              displayName: item.displayName,
              specification: item.specification,
              unit: item.unit,
              weight: item.weight,
              remarks: item.remarks,
            })),
          },
        }),
      },
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

    const responsePayload = {
      ...updatedOrder,
      fulfillmentSummary: {
        customerOwnedAmount: updatedOrder.items
          .filter(item => item.ownership === 'customer')
          .reduce((sum, item) => sum + item.totalPrice, 0),
        selfOwnedAmount: updatedOrder.items
          .filter(item => item.ownership === 'self')
          .reduce((sum, item) => sum + item.totalPrice, 0),
      },
    };

    return NextResponse.json(responsePayload);
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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    // 检查订单是否存在
    const existingOrder = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 删除订单（级联删除订单明细）
    await prisma.factoryShipmentOrder.delete({
      where: { id },
    });

    return NextResponse.json({ message: '订单删除成功' });
  } catch (error) {
    logger.error('factory-shipments', '删除厂家发货订单失败', error, {
      orderId: id,
    });
    return NextResponse.json({ error: '删除订单失败' }, { status: 500 });
  }
}
