/**
 * 厂家发货订单服务端 API
 * 用于 Server Components 中的数据获取
 * 遵循 Next.js 15 官方最佳实践：使用 React.cache() 避免重复查询
 */

import { type Prisma } from '@prisma/client';
import { cache } from 'react';

import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { enrichFactoryShipmentOrders } from '@/lib/services/factory-shipment-enrichment';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';
import type { FactoryShipmentOrderListParams } from '@/lib/validations/factory-shipment';

const factoryShipmentItemSelect = {
  id: true,
  factoryShipmentOrderId: true,
  productId: true,
  supplierId: true,
  productCode: true,
  batchNumber: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
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
  unitCost: true,
  allocatedExpense: true,
  profitAmount: true,
  profitMargin: true,
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
} satisfies Prisma.FactoryShipmentOrderItemSelect;

const factoryShipmentOrderListSelect = {
  id: true,
  orderNumber: true,
  containerNumber: true,
  customerId: true,
  userId: true,
  status: true,
  totalAmount: true,
  receivableAmount: true,
  depositAmount: true,
  paidAmount: true,
  remarks: true,
  plan_date: true,
  shipmentDate: true,
  estimatedArrival: true,
  arrivalDate: true,
  deliveryDate: true,
  completionDate: true,
  createdAt: true,
  updatedAt: true,
  shippingCompany: true,
  lastShippingQueryAt: true,
  shippingQueryStatus: true,
  shippingQueryError: true,
  preferredSiteId: true,
  costAmount: true,
  expenseAmount: true,
  profitAmount: true,
  customerProfit: true,
  selfCostAmount: true,
  customer: {
    select: { id: true, name: true, phone: true, address: true },
  },
  user: {
    select: { id: true, name: true, email: true },
  },
  items: {
    select: factoryShipmentItemSelect,
  },
} satisfies Prisma.FactoryShipmentOrderSelect;

/**
 * 服务端获取厂家发货订单列表
 * 使用 React.cache() 包装确保同一渲染周期内不会重复查询
 */
export const getFactoryShipmentOrdersServer = cache(
  async (
    params: FactoryShipmentOrderListParams
  ): Promise<{
    data: FactoryShipmentOrder[];
    total: number;
    page: number;
    limit: number;
  }> => {
    const {
      page = 1,
      limit = paginationConfig.defaultPageSize,
      status,
      customerId,
      search,
      containerNumber,
      orderNumber,
      startDate,
      endDate,
    } = params;

    // 构建查询条件
    const where: Prisma.FactoryShipmentOrderWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }

    // ✅ 搜索逻辑：与客户端 API 保持一致
    // 如果提供了 search 参数，使用 OR 逻辑同时匹配 containerNumber 和 orderNumber
    if (search) {
      where.OR = [
        { containerNumber: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } },
      ];
    } else {
      // 如果没有 search 参数，保留独立的 containerNumber 和 orderNumber 筛选
      if (containerNumber) {
        where.containerNumber = { contains: containerNumber };
      }
      if (orderNumber) {
        where.orderNumber = { contains: orderNumber };
      }
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

    // 查询订单列表
    const [orders, totalCount] = await Promise.all([
      prisma.factoryShipmentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: factoryShipmentOrderListSelect,
      }),
      prisma.factoryShipmentOrder.count({ where }),
    ]);

    // ✅ P1修复: 调用字段增强逻辑，添加运输状态和金额摘要
    // 修复前：SSR 只返回 Prisma 原始记录，缺少 latestShippingStatus 和 fulfillmentSummary
    // 修复后：SSR 和 API 路由使用相同的增强逻辑，首屏显示完整数据
    const enrichedOrders = await enrichFactoryShipmentOrders(
      orders as unknown as FactoryShipmentOrder[]
    );

    return {
      data: enrichedOrders,
      total: totalCount,
      page,
      limit,
    };
  }
);

/**
 * 服务端获取单个厂家发货订单详情
 * 使用 React.cache() 包装确保同一渲染周期内不会重复查询
 */
export const getFactoryShipmentOrderServer = cache(
  async (id: string): Promise<FactoryShipmentOrder | null> => {
    const order = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      select: factoryShipmentOrderListSelect,
    });

    return order as unknown as FactoryShipmentOrder | null;
  }
);
