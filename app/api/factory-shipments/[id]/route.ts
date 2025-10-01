// 单个厂家发货订单 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { updateFactoryShipmentOrderSchema } from '@/lib/schemas/factory-shipment';
import { withIdempotency } from '@/lib/utils/idempotency';

interface RouteParams {
  params: {
    id: string;
  };
}

// 获取单个厂家发货订单详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 身份验证 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: '未授权访问' }, { status: 401 });
      }
    }

    const { id } = params;

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

    return NextResponse.json(order);
  } catch (error) {
    console.error('获取厂家发货订单详情失败:', error);
    return NextResponse.json({ error: '获取订单详情失败' }, { status: 500 });
  }
}

// 更新厂家发货订单
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // 身份验证 (开发模式下绕过)
    let userId: string;
    if (env.NODE_ENV === 'development') {
      const user = await prisma.user.findFirst();
      if (!user) {
        return NextResponse.json(
          { error: '开发环境下未找到可用用户' },
          { status: 500 }
        );
      }
      userId = user.id;
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: '未授权访问' }, { status: 401 });
      }
      userId = session.user.id;
    }

    const { id } = params;

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
    if (status && status !== existingOrder.status) {
      const { updateFactoryShipmentStatus } = await import(
        '@/lib/api/handlers/factory-shipment-status'
      );

      const result = await withIdempotency(
        idempotencyKey,
        'factory_shipment_status_change',
        id,
        userId,
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

    // 计算订单总金额（如果更新了商品明细）
    const calculatedTotalAmount = items
      ? items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      : undefined;

    // 更新厂家发货订单
    const updatedOrder = await prisma.factoryShipmentOrder.update({
      where: { id },
      data: {
        ...(containerNumber && { containerNumber }),
        ...(customerId && { customerId }),
        ...(status && { status }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(receivableAmount !== undefined && { receivableAmount }),
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

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('更新厂家发货订单失败:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: '集装箱号码已存在' }, { status: 400 });
    }

    return NextResponse.json({ error: '更新订单失败' }, { status: 500 });
  }
}

// 删除厂家发货订单
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = params;

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
    console.error('删除厂家发货订单失败:', error);
    return NextResponse.json({ error: '删除订单失败' }, { status: 500 });
  }
}
