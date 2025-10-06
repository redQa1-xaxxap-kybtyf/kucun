// 厂家发货订单 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import type { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';
import {
  createFactoryShipmentOrderSchema,
  factoryShipmentOrderListParamsSchema,
} from '@/lib/validations/factory-shipment';

// 获取厂家发货订单列表
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = {
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
      page = 1,
      limit = paginationConfig.defaultPageSize,
      status,
      customerId,
      containerNumber,
      orderNumber,
      startDate,
      endDate,
    } = validatedParams;

    // 构建查询条件
    const where: Prisma.FactoryShipmentOrderWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (containerNumber) {
      where.containerNumber = { contains: containerNumber };
    }
    if (orderNumber) {
      where.orderNumber = { contains: orderNumber };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // 分页计算
    const skip = (page - 1) * limit;

    // ✅ 优化关联查询,只查询必要字段,减少数据传输量
    // 从查询所有字段改为 select 指定字段
    const [orders, totalCount] = await Promise.all([
      prisma.factoryShipmentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          containerNumber: true,
          customerId: true,
          userId: true,
          status: true,
          totalAmount: true,
          receivableAmount: true,
          depositAmount: true,
          remarks: true,
          planDate: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: { id: true, name: true, phone: true, address: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
          items: {
            select: {
              id: true,
              productId: true,
              supplierId: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
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
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('获取厂家发货订单列表失败:', error);
    return NextResponse.json({ error: '获取订单列表失败' }, { status: 500 });
  }
});

// 创建厂家发货订单
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const userId = user.id;

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

    // 生成订单编号 - 使用安全的订单号生成服务
    const { generateFactoryShipmentNumber } = await import(
      '@/lib/services/simple-order-number-generator'
    );
    const orderNumber = await generateFactoryShipmentNumber();

    // 计算订单总金额
    const calculatedTotalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // 验证前端传入的金额是否正确
    if (totalAmount && Math.abs(totalAmount - calculatedTotalAmount) > 0.01) {
      return NextResponse.json(
        {
          error: `订单总金额计算错误。前端: ${totalAmount}, 服务器: ${calculatedTotalAmount}`,
        },
        { status: 400 }
      );
    }

    // 使用服务器计算的金额
    const finalTotalAmount = calculatedTotalAmount;
    const finalReceivableAmount = receivableAmount || calculatedTotalAmount;

    // 使用事务创建订单并记录价格历史
    const order = await prisma.$transaction(async tx => {
      // 创建厂家发货订单
      const newOrder = await tx.factoryShipmentOrder.create({
        data: {
          orderNumber,
          containerNumber,
          customerId,
          userId,
          status: status || FACTORY_SHIPMENT_STATUS.DRAFT,
          totalAmount: finalTotalAmount,
          receivableAmount: finalReceivableAmount,
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

      // ✅ 使用批量创建优化性能 (从 20 次数据库往返降至 2 次)
      // 记录客户产品价格历史（厂家发货价格类型）
      const customerPriceData = items
        .filter(
          item => !item.isManualProduct && item.productId && item.unitPrice
        )
        .map(item => ({
          customerId,
          productId: item.productId!,
          priceType: 'FACTORY' as const,
          unitPrice: item.unitPrice,
          orderId: newOrder.id,
          orderType: 'FACTORY_SHIPMENT' as const,
        }));

      if (customerPriceData.length > 0) {
        await tx.customerProductPrice.createMany({
          data: customerPriceData,
        });
      }

      // 记录供应商产品价格历史
      const supplierPriceData = items
        .filter(
          item =>
            !item.isManualProduct &&
            item.productId &&
            item.supplierId &&
            item.unitPrice
        )
        .map(item => ({
          supplierId: item.supplierId!,
          productId: item.productId!,
          unitPrice: item.unitPrice,
          orderId: newOrder.id,
        }));

      if (supplierPriceData.length > 0) {
        await tx.supplierProductPrice.createMany({
          data: supplierPriceData,
        });
      }

      return newOrder;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('创建厂家发货订单失败:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: '集装箱号码已存在' }, { status: 400 });
    }

    return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
  }
});
