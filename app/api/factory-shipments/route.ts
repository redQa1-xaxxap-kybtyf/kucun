// 厂家发货订单 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createFactoryShipmentOrderSchema,
  factoryShipmentOrderListParamsSchema,
} from '@/lib/schemas/factory-shipment';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

// 获取厂家发货订单列表
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get('page')
        ? parseInt(searchParams.get('page') || '1')
        : 1,
      pageSize: searchParams.get('pageSize')
        ? parseInt(searchParams.get('pageSize') || '20')
        : 20,
      status: searchParams.get('status') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      containerNumber: searchParams.get('containerNumber') || undefined,
      orderNumber: searchParams.get('orderNumber') || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate') || '')
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate') || '')
        : undefined,
    };

    // 验证查询参数
    const validatedParams =
      factoryShipmentOrderListParamsSchema.parse(queryParams);
    const {
      page,
      pageSize,
      status,
      customerId,
      containerNumber,
      orderNumber,
      startDate,
      endDate,
    } = validatedParams;

    // 构建查询条件
    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (containerNumber) where.containerNumber = { contains: containerNumber };
    if (orderNumber) where.orderNumber = { contains: orderNumber };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // 分页计算
    const skip = (page - 1) * pageSize;

    // 查询订单列表
    const [orders, totalCount] = await Promise.all([
      prisma.factoryShipmentOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.factoryShipmentOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error('获取厂家发货订单列表失败:', error);
    return NextResponse.json({ error: '获取订单列表失败' }, { status: 500 });
  }
}

// 创建厂家发货订单
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = createFactoryShipmentOrderSchema.parse(body);
    const {
      containerNumber,
      customerId,
      status,
      totalAmount,
      receivableAmount,
      depositAmount,
      remarks,
      planDate,
      items,
    } = validatedData;

    // 验证客户是否存在
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: '客户不存在' }, { status: 400 });
    }

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

    // 生成订单编号
    const orderNumber = `FS${Date.now()}`;

    // 计算订单总金额
    const calculatedTotalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // 创建厂家发货订单
    const order = await prisma.factoryShipmentOrder.create({
      data: {
        orderNumber,
        containerNumber,
        customerId,
        userId: session.user.id || '',
        status: status || FACTORY_SHIPMENT_STATUS.DRAFT,
        totalAmount: totalAmount || calculatedTotalAmount,
        receivableAmount: receivableAmount || calculatedTotalAmount,
        depositAmount: depositAmount || 0,
        remarks,
        planDate,
        items: {
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

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('创建厂家发货订单失败:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: '集装箱号码已存在' }, { status: 400 });
    }

    return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
  }
}
