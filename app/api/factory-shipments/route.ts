// 厂家发货订单 API 路由
// 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式

import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import {
  buildDateTimeRangeFromDates,
  parseDateRangeFromSearchParams,
} from '@/lib/api/date-range';
import {
  ensureCustomersExistByIds,
  ensureProductsExistFromItems,
  ensureSuppliersExistByIds,
} from '@/lib/api/entity-existence';
import { ApiError } from '@/lib/api/errors';
import {
  buildTemporaryProductDataFromOrderItem,
  findOrCreateTemporaryProduct,
} from '@/lib/api/handlers/sales-orders/temporary-products';
import { parseOffsetPagination } from '@/lib/api/pagination';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { env, paginationConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  ensureCompanyExpenses,
  type CompanyFeeItemLike,
} from '@/lib/services/expense-service';
import { enrichFactoryShipmentOrders } from '@/lib/services/factory-shipment-enrichment';
import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';
import {
  createFactoryShipmentOrderSchema,
  factoryShipmentOrderListParamsSchema,
  type FactoryShipmentOrderItemData,
} from '@/lib/validations/factory-shipment';

// =============== Helpers (keep handlers short and testable) ===============

type ListParams = {
  page: number;
  limit: number;
  status?: FactoryShipmentStatus;
  customerId?: string;
  search?: string;
  containerNumber?: string;
  orderNumber?: string;
  startDate?: Date;
  endDate?: Date;
};

function parseAndValidateListParams(request: NextRequest): ListParams {
  const { searchParams } = request.nextUrl;
  const { page, limit } = parseOffsetPagination(searchParams);
  const { startDate, endDate } = parseDateRangeFromSearchParams(searchParams);
  const raw = {
    page,
    limit,
    status: searchParams.get('status') || undefined,
    customerId: searchParams.get('customerId') || undefined,
    search: searchParams.get('search') || undefined,
    containerNumber: searchParams.get('containerNumber') || undefined,
    orderNumber: searchParams.get('orderNumber') || undefined,
    startDate,
    endDate,
  };

  const parsed = factoryShipmentOrderListParamsSchema.parse(raw);
  return {
    page: parsed.page ?? 1,
    limit: parsed.limit ?? paginationConfig.defaultPageSize,
    status: parsed.status as FactoryShipmentStatus | undefined,
    customerId: parsed.customerId,
    search: parsed.search,
    containerNumber: parsed.containerNumber,
    orderNumber: parsed.orderNumber,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
  };
}

function buildWhere(params: ListParams): Prisma.FactoryShipmentOrderWhereInput {
  const where: Prisma.FactoryShipmentOrderWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.customerId) where.customerId = params.customerId;

  // ✅ 搜索逻辑：优先使用统一 search 参数
  if (params.search) {
    where.OR = [
      { containerNumber: { contains: params.search } },
      { orderNumber: { contains: params.search } },
    ];
  } else if (params.containerNumber && params.orderNumber) {
    where.OR = [
      { containerNumber: { contains: params.containerNumber } },
      { orderNumber: { contains: params.orderNumber } },
    ];
  } else if (params.containerNumber) {
    where.containerNumber = { contains: params.containerNumber };
  } else if (params.orderNumber) {
    where.orderNumber = { contains: params.orderNumber };
  }

  const createdAt = buildDateTimeRangeFromDates(
    params.startDate,
    params.endDate
  );
  if (createdAt) {
    where.createdAt = createdAt;
  }
  return where;
}

const orderListSelect = {
  id: true,
  orderNumber: true,
  containerNumber: true,
  shippingCompany: true,
  customerId: true,
  userId: true,
  status: true,
  lastShippingQueryAt: true,
  shippingQueryStatus: true,
  shippingQueryError: true,
  preferredSiteId: true,
  plan_date: true,
  shipmentDate: true,
  estimatedArrival: true,
  arrivalDate: true,
  deliveryDate: true,
  completionDate: true,
  totalAmount: true,
  receivableAmount: true,
  depositAmount: true,
  costAmount: true,
  expenseAmount: true,
  profitAmount: true,
  customerProfit: true,
  selfCostAmount: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, phone: true, address: true } },
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
      profitAmount: true,
      profitMargin: true,
      ownership: true,
      ownershipRemarks: true,
      customerDeliveryStatus: true,
      selfInboundStatus: true,
      deliveryConfirmedAt: true,
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
    },
  },
} satisfies Prisma.FactoryShipmentOrderSelect;

// ✅ P1修复: enrichOrders 函数已移至 lib/services/factory-shipment-enrichment.ts
// 作为共享服务函数，确保 SSR 和 API 路由使用相同的字段增强逻辑

// ----- POST helpers -----

function computeAmountSummary(
  items: Array<{
    quantity: number;
    unitPrice: number;
    ownership?: 'customer' | 'self';
  }>
) {
  return items.reduce(
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
  );
}

function ensureProductCode(code?: string | null) {
  const normalized = code?.trim();
  if (!normalized) {
    throw new Error('产品编码不能为空');
  }
  return normalized;
}

async function ensureCustomerExists(customerId: string) {
  await ensureCustomersExistByIds(prisma, [customerId]);
}

// eslint-disable-next-line max-lines-per-function -- Helper kept in-route for now; can be moved to service layer
async function createOrderInTransaction(
  tx: Prisma.TransactionClient,
  args: {
    orderNumber: string;
    containerNumber: string;
    customerId: string;
    userId: string;
    status?: FactoryShipmentStatus;
    finalTotalAmount: number;
    finalReceivableAmount: number;
    depositAmount?: number;
    remarks?: string;
    items: FactoryShipmentOrderItemData[];
    feeItems?: CompanyFeeItemLike[];
    supplierId?: string | null;
  }
) {
  const {
    orderNumber,
    containerNumber,
    customerId,
    userId,
    status,
    finalTotalAmount,
    finalReceivableAmount,
    depositAmount,
    remarks,
    items,
    feeItems,
    supplierId,
  } = args;

  // 与调货销售保持一致：为手动输入的产品创建/复用临时产品记录
  const temporaryProductIds = new Map<number, string>();

  if (supplierId) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const tempProductData = buildTemporaryProductDataFromOrderItem(
        {
          isManualProduct: item.isManualProduct,
          productCode: item.productCode,
          manualProductName: item.manualProductName,
          manualSpecification: item.manualSpecification,
          manualWeight: item.manualWeight,
          manualUnit: item.manualUnit,
          piecesPerUnit: item.piecesPerUnit,
        },
        supplierId,
        userId
      );

      if (tempProductData) {
        const tempProduct = await findOrCreateTemporaryProduct(
          // 该 helper 只依赖 PrismaClient 公开方法，这里直接传入事务客户端
          tx as unknown as any,
          tempProductData
        );
        temporaryProductIds.set(index, tempProduct.id);
      }
    }
  }

  const newOrder = await tx.factoryShipmentOrder.create({
    data: {
      orderNumber,
      containerNumber,
      customerId,
      userId,
      status: status ?? FACTORY_SHIPMENT_STATUS.DRAFT,
      totalAmount: finalTotalAmount,
      receivableAmount: finalReceivableAmount,
      depositAmount: depositAmount || 0,
      remarks,
      items: {
        create: items.map((item, index) => ({
          productId: item.isManualProduct ? null : item.productId,
          supplierId: item.supplierId,
          productCode: ensureProductCode(item.productCode),
          batchNumber: item.batchNumber?.trim() || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost ?? null,
          totalPrice: item.quantity * item.unitPrice,
          ownership: item.ownership ?? FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER,
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
          displayName: item.displayName || '',
          specification: item.specification,
          unit: item.unit,
          piecesPerUnit: item.piecesPerUnit ?? null,
          weight: item.weight,
          remarks: item.remarks,
          // 为手动产品记录临时产品关联，便于后续复用和诊断
          temporaryProductId: temporaryProductIds.get(index) ?? null,
        })) as Prisma.FactoryShipmentOrderItemUncheckedCreateWithoutFactoryShipmentOrderInput[],
      },
      // ✅ 同步保存费用明细到 factory_shipment_order_fee_items，便于编辑页面恢复
      feeItems:
        feeItems && feeItems.length > 0
          ? {
              create: feeItems.map(fee => ({
                feeType: fee.feeType,
                feeName: fee.feeName,
                feeAmount: fee.feeAmount,
                paidBy: fee.paidBy ?? 'customer',
                supplierId: fee.supplierId ?? null,
                remarks: fee.remarks ?? null,
              })),
            }
          : undefined,
    },
    include: {
      customer: {
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

  const targetStatus = status ?? FACTORY_SHIPMENT_STATUS.DRAFT;
  if (
    targetStatus !== FACTORY_SHIPMENT_STATUS.DRAFT &&
    targetStatus !== FACTORY_SHIPMENT_STATUS.CANCELLED &&
    finalReceivableAmount > 0
  ) {
    await createInitialReceivableForShipment(tx, {
      orderId: newOrder.id,
      orderNumber,
      customerId,
      userId,
      receivableAmount: finalReceivableAmount,
    });
  }

  // 价格历史（客户）
  const customerPriceData = items.reduce<
    Array<{
      customerId: string;
      productId: string;
      priceType: 'FACTORY';
      unitPrice: number;
      orderId: string;
      orderType: 'FACTORY_SHIPMENT';
    }>
  >((acc, item) => {
    if (item.isManualProduct || !item.productId || item.unitPrice === undefined)
      return acc;
    acc.push({
      customerId,
      productId: item.productId,
      priceType: 'FACTORY',
      unitPrice: item.unitPrice,
      orderId: newOrder.id,
      orderType: 'FACTORY_SHIPMENT',
    });
    return acc;
  }, []);
  if (customerPriceData.length > 0) {
    await tx.customerProductPrice.createMany({ data: customerPriceData });
  }

  // 价格历史（供应商）
  const supplierPriceData = items.reduce<
    Array<{
      supplierId: string;
      productId: string;
      unitPrice: number;
      orderId: string;
    }>
  >((acc, item) => {
    if (
      item.isManualProduct ||
      !item.productId ||
      !item.supplierId ||
      item.unitPrice === undefined
    )
      return acc;
    acc.push({
      supplierId: item.supplierId,
      productId: item.productId,
      unitPrice: item.unitPrice,
      orderId: newOrder.id,
    });
    return acc;
  }, []);
  if (supplierPriceData.length > 0) {
    await tx.supplierProductPrice.createMany({ data: supplierPriceData });
  }

  // 阶段2：自动创建公司承担费用的 ExpenseRecord（幂等，必须成功）
  if (env.EXPENSE_AUTO_CREATE && feeItems && feeItems.length > 0) {
    try {
      await ensureCompanyExpenses({
        tx,
        sourceType: 'factory_shipment',
        sourceId: newOrder.id,
        sourceNumber: orderNumber,
        userId,
        supplierId: supplierId ?? null,
        feeItems,
      });
    } catch (e) {
      logger.error(
        'factory-shipments',
        '自动创建费用记录失败，将回滚厂家发货订单事务',
        e,
        {
          orderId: newOrder.id,
          orderNumber,
        }
      );
      // 与销售订单保持一致：费用台账写入失败时整体事务回滚，避免利润数据与费用台账脱节
      throw e;
    }
  }

  return newOrder;
}

async function createInitialReceivableForShipment(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    userId: string;
    receivableAmount: number;
  }
) {
  const { orderId, orderNumber, customerId, userId, receivableAmount } = params;
  if (receivableAmount <= 0) return;

  const existing = await tx.paymentRecord.findFirst({
    where: { factoryShipmentOrderId: orderId },
    select: { id: true },
  });
  if (existing) return;

  const paymentNumber = await generatePaymentNumber(tx);
  await tx.paymentRecord.create({
    data: {
      paymentNumber,
      factoryShipmentOrderId: orderId,
      salesOrderId: null,
      customerId,
      userId,
      paymentType: 'order_payment',
      paymentMethod: 'other',
      paymentAmount: receivableAmount,
      actualPaymentAmount: receivableAmount,
      roundingAmount: 0,
      appliedAmount: 0,
      paymentDate: new Date(),
      status: 'pending',
      remarks: `系统自动生成应收（厂家直发）：订单 ${orderNumber}`,
    },
  });
}

// 获取厂家发货订单列表
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const params = parseAndValidateListParams(request);
    const where = buildWhere(params);
    const skip = (params.page - 1) * params.limit;

    // ✅ 优化关联查询,只查询必要字段,减少数据传输量
    // 从查询所有字段改为 select 指定字段
    const [orders, totalCount] = await Promise.all([
      prisma.factoryShipmentOrder.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: orderListSelect,
      }),
      prisma.factoryShipmentOrder.count({ where }),
    ]);

    // ✅ P1修复: 使用共享的字段增强函数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedOrders = await enrichFactoryShipmentOrders(orders as any);

    return NextResponse.json({
      data: enrichedOrders,
      total: totalCount,
      page: params.page,
      limit: params.limit,
    });
  } catch (error) {
    logger.error('factory-shipments', '获取厂家发货订单列表失败', error, {
      userId: user.id,
      url: request.url,
    });
    return NextResponse.json(
      { success: false, error: '获取订单列表失败' },
      { status: 500 }
    );
  }
});

// 创建厂家发货订单
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const userId = user.id;

    // 解析请求体
    const body = await request.json();

    const parsed = createFactoryShipmentOrderSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues.map(issue => ({
        path: issue.path.length > 0 ? issue.path.join('.') : 'root',
        message: issue.message,
        code: issue.code,
      }));

      logger.warn(
        'factory-shipments',
        '创建厂家发货订单参数验证失败',
        { userId },
        { errors: details }
      );

      return NextResponse.json(
        {
          success: false,
          error: '参数验证失败',
          details,
        },
        { status: 422 }
      );
    }

    // 验证输入数据
    const validatedData = parsed.data;
    const {
      containerNumber,
      customerId,
      status,
      totalAmount,
      receivableAmount: _receivableAmount,
      depositAmount,
      remarks,
      items,
      feeItems,
    } = validatedData;

    // 验证客户是否存在
    await ensureCustomerExists(customerId);

    // 验证库存产品是否存在（排除手动输入的产品）
    await ensureProductsExistFromItems(prisma, items);

    // 验证供应商是否存在
    await ensureSuppliersExistByIds(
      prisma,
      items.map(item => item.supplierId)
    );

    // 生成订单编号 - 使用安全的订单号生成服务
    const { generateFactoryShipmentNumber } = await import(
      '@/lib/services/simple-order-number-generator'
    );
    const orderNumber = await generateFactoryShipmentNumber();

    // 计算订单金额与归属汇总
    const amountSummary = computeAmountSummary(items);
    const calculatedTotalAmount = amountSummary.total;

    // 验证前端传入的金额是否正确
    if (totalAmount && Math.abs(totalAmount - calculatedTotalAmount) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: `订单总金额计算错误。前端: ${totalAmount}, 服务器: ${calculatedTotalAmount}`,
        },
        { status: 400 }
      );
    }

    // 使用服务器计算的金额
    const finalTotalAmount = calculatedTotalAmount;
    const customerAmount = amountSummary.customer;
    const finalDepositAmount = depositAmount || 0;

    // ✅ 修复：计算客户承担的费用总额
    const customerFees = (feeItems || [])
      .filter(fee => fee.paidBy === 'customer')
      .reduce((sum, fee) => sum + fee.feeAmount, 0);

    // ✅ 修复：应收金额 = 客户货总金额 + 客户承担的费用 - 定金
    const finalReceivableAmount = Math.max(
      0,
      customerAmount + customerFees - finalDepositAmount
    );

    // 尝试从items中提取第一个非空supplierId用于费用记录
    const firstSupplierId =
      items.find(item => item.supplierId)?.supplierId ?? null;

    const order = await prisma.$transaction(tx =>
      createOrderInTransaction(tx, {
        orderNumber,
        containerNumber: containerNumber ?? '',
        customerId,
        userId,
        status,
        finalTotalAmount,
        finalReceivableAmount,
        depositAmount: finalDepositAmount,
        remarks,
        items,
        feeItems,
        supplierId: firstSupplierId,
      })
    );

    const responsePayload = {
      ...order,
      fulfillmentSummary: {
        customerOwnedAmount: amountSummary.customer,
        selfOwnedAmount: amountSummary.self,
      },
    };

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    logger.error('factory-shipments', '创建厂家发货订单失败', error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.type,
          errorId: error.errorId,
          ...(env.NODE_ENV === 'development' && error.details !== undefined
            ? {
                details: Array.isArray(error.details)
                  ? error.details
                  : [error.details],
              }
            : {}),
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: '集装箱号码已存在' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '创建订单失败' },
      { status: 500 }
    );
  }
});
