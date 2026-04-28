import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/utils/number';

export interface ProductFlowTrackingQuery {
  startDate?: string;
  endDate?: string;
  customerId?: string;
}

export interface ProductFlowTrackingResult {
  product: {
    id: string;
    code: string;
    name: string;
    specification?: string | null;
    unit: string;
    piecesPerUnit?: number | null;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    currentQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    totalInboundQuantity: number;
    totalOutboundQuantity: number;
    totalWarehouseOutboundQuantity: number;
    totalFactoryShipmentQuantity: number;
    outboundCustomerCount: number;
    outboundOrderCount: number;
    outboundRecordCount: number;
    factoryShipmentOrderCount: number;
    factoryShipmentRecordCount: number;
    flowRecordCount: number;
  };
  monthlyCustomerFlows: Array<{
    month: string;
    customerId?: string;
    customerName: string;
    quantity: number;
    outboundRecordCount: number;
    salesOrderCount: number;
    lastOutboundAt: string;
  }>;
  outboundRecords: Array<{
    id: string;
    recordNumber: string;
    createdAt: string;
    quantity: number;
    reason: string;
    batchNumber?: string | null;
    customerId?: string | null;
    customerName: string;
    salesOrderId?: string | null;
    salesOrderNumber?: string | null;
    salesOrderStatus?: string | null;
    variantName?: string | null;
    location?: string | null;
    operatorName?: string | null;
  }>;
  factoryShipmentRecords: Array<{
    id: string;
    orderId: string;
    orderNumber: string;
    status: string;
    flowDate: string;
    quantity: number;
    batchNumber?: string | null;
    customerId?: string | null;
    customerName: string;
    supplierName?: string | null;
    variantName?: string | null;
  }>;
  inboundRecords: Array<{
    id: string;
    recordNumber: string;
    createdAt: string;
    quantity: number;
    reason: string;
    batchNumber?: string | null;
    supplierName?: string | null;
    purchaseOrderNumber?: string | null;
    variantName?: string | null;
    operatorName?: string | null;
  }>;
}

const toDateInputValue = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const parseStartDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseEndDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const resolveDateRange = (query: ProductFlowTrackingQuery) => {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startDate = parseStartDate(query.startDate) ?? defaultStart;
  const endDate = parseEndDate(query.endDate) ?? now;
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    startDateInput: toDateInputValue(startDate),
    endDateInput: toDateInputValue(endDate),
  };
};

const formatMonth = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const formatVariantName = (
  variant?: { colorCode: string; colorName: string | null } | null
) => {
  if (!variant) return null;
  return variant.colorName
    ? `${variant.colorCode} / ${variant.colorName}`
    : variant.colorCode;
};

const FACTORY_SHIPMENT_FLOW_STATUSES = [
  'shipped',
  'in_transit',
  'arrived',
  'delivered',
  'completed',
] as const;

const isWithinDateRange = (date: Date, startDate: Date, endDate: Date) =>
  date >= startDate && date <= endDate;

const pickFactoryShipmentFlowDate = (
  dates: Array<Date | null | undefined>,
  startDate: Date,
  endDate: Date
) => {
  const candidates = dates.filter(
    (date): date is Date =>
      date instanceof Date && !Number.isNaN(date.getTime())
  );

  return (
    candidates.find(date => isWithinDateRange(date, startDate, endDate)) ??
    candidates[0] ??
    new Date()
  );
};

export async function getProductFlowTracking(
  productId: string,
  query: ProductFlowTrackingQuery = {}
): Promise<ProductFlowTrackingResult | null> {
  const range = resolveDateRange(query);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      unit: true,
      piecesPerUnit: true,
    },
  });

  if (!product) {
    return null;
  }

  const dateWhere = {
    gte: range.startDate,
    lte: range.endDate,
  };
  const outboundWhere = {
    productId,
    createdAt: dateWhere,
    ...(query.customerId ? { customerId: query.customerId } : {}),
  };

  const [
    inventorySummary,
    inboundSummary,
    outbounds,
    factoryShipmentItems,
    inbounds,
  ] = await Promise.all([
    prisma.inventory.aggregate({
      where: { productId },
      _sum: { quantity: true, reservedQuantity: true },
    }),
    prisma.inboundRecord.aggregate({
      where: { productId, createdAt: dateWhere },
      _sum: { quantity: true },
    }),
    prisma.outboundRecord.findMany({
      where: outboundWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        recordNumber: true,
        createdAt: true,
        quantity: true,
        reason: true,
        batchNumber: true,
        customerId: true,
        salesOrderId: true,
        customer: { select: { id: true, name: true } },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
        variant: { select: { colorCode: true, colorName: true } },
        inventory: { select: { location: true } },
        operator: { select: { name: true } },
      },
    }),
    prisma.factoryShipmentOrderItem.findMany({
      where: {
        productId,
        factoryShipmentOrder: {
          ...(query.customerId ? { customerId: query.customerId } : {}),
          voidedAt: null,
          status: { in: [...FACTORY_SHIPMENT_FLOW_STATUSES] },
        },
        OR: [
          { deliveryConfirmedAt: dateWhere },
          { createdAt: dateWhere },
          { factoryShipmentOrder: { shipmentDate: dateWhere } },
          { factoryShipmentOrder: { deliveryDate: dateWhere } },
          { factoryShipmentOrder: { completionDate: dateWhere } },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        quantity: true,
        batchNumber: true,
        deliveryConfirmedAt: true,
        createdAt: true,
        updatedAt: true,
        supplier: { select: { name: true } },
        product: { select: { code: true, name: true } },
        factoryShipmentOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            customerId: true,
            shipmentDate: true,
            deliveryDate: true,
            completionDate: true,
            createdAt: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.inboundRecord.findMany({
      where: { productId, createdAt: dateWhere },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 300,
      select: {
        id: true,
        recordNumber: true,
        createdAt: true,
        quantity: true,
        reason: true,
        batchNumber: true,
        supplier: { select: { name: true } },
        purchaseOrder: { select: { orderNumber: true } },
        variant: { select: { colorCode: true, colorName: true } },
        user: { select: { name: true } },
      },
    }),
  ]);

  const monthlyMap = new Map<
    string,
    {
      month: string;
      customerId?: string;
      customerName: string;
      quantity: number;
      outboundRecordCount: number;
      salesOrderIds: Set<string>;
      lastOutboundAt: Date;
    }
  >();
  const customerIds = new Set<string>();
  const orderIds = new Set<string>();
  const factoryShipmentOrderIds = new Set<string>();

  for (const record of outbounds) {
    const month = formatMonth(record.createdAt);
    const customerKey = record.customerId ?? 'unknown';
    const key = `${month}:${customerKey}`;
    const customerName = record.customer?.name ?? '未关联客户';
    const existing = monthlyMap.get(key);

    if (record.customerId) customerIds.add(record.customerId);
    if (record.salesOrderId) orderIds.add(record.salesOrderId);

    if (!existing) {
      monthlyMap.set(key, {
        month,
        customerId: record.customerId ?? undefined,
        customerName,
        quantity: record.quantity,
        outboundRecordCount: 1,
        salesOrderIds: record.salesOrderId
          ? new Set([record.salesOrderId])
          : new Set(),
        lastOutboundAt: record.createdAt,
      });
      continue;
    }

    existing.quantity += record.quantity;
    existing.outboundRecordCount += 1;
    if (record.salesOrderId) existing.salesOrderIds.add(record.salesOrderId);
    if (record.createdAt > existing.lastOutboundAt) {
      existing.lastOutboundAt = record.createdAt;
    }
  }

  for (const item of factoryShipmentItems) {
    const order = item.factoryShipmentOrder;
    const flowDate = pickFactoryShipmentFlowDate(
      [
        item.deliveryConfirmedAt,
        order.deliveryDate,
        order.shipmentDate,
        order.completionDate,
        item.createdAt,
      ],
      range.startDate,
      range.endDate
    );
    const month = formatMonth(flowDate);
    const customerKey = order.customerId ?? 'unknown';
    const key = `${month}:${customerKey}`;
    const customerName = order.customer?.name ?? '未关联客户';
    const existing = monthlyMap.get(key);

    if (order.customerId) customerIds.add(order.customerId);
    factoryShipmentOrderIds.add(order.id);

    if (!existing) {
      monthlyMap.set(key, {
        month,
        customerId: order.customerId ?? undefined,
        customerName,
        quantity: item.quantity,
        outboundRecordCount: 1,
        salesOrderIds: new Set([`factory:${order.id}`]),
        lastOutboundAt: flowDate,
      });
      continue;
    }

    existing.quantity += item.quantity;
    existing.outboundRecordCount += 1;
    existing.salesOrderIds.add(`factory:${order.id}`);
    if (flowDate > existing.lastOutboundAt) {
      existing.lastOutboundAt = flowDate;
    }
  }

  const currentQuantity = toNumber(inventorySummary._sum.quantity, 0);
  const reservedQuantity = toNumber(inventorySummary._sum.reservedQuantity, 0);
  const totalWarehouseOutboundQuantity = outbounds.reduce(
    (sum, record) => sum + record.quantity,
    0
  );
  const totalFactoryShipmentQuantity = factoryShipmentItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return {
    product: {
      ...product,
      piecesPerUnit: product.piecesPerUnit ?? null,
    },
    dateRange: {
      startDate: range.startDateInput,
      endDate: range.endDateInput,
    },
    summary: {
      currentQuantity,
      reservedQuantity,
      availableQuantity: Math.max(0, currentQuantity - reservedQuantity),
      totalInboundQuantity: toNumber(inboundSummary._sum.quantity, 0),
      totalOutboundQuantity:
        totalWarehouseOutboundQuantity + totalFactoryShipmentQuantity,
      totalWarehouseOutboundQuantity,
      totalFactoryShipmentQuantity,
      outboundCustomerCount: customerIds.size,
      outboundOrderCount: orderIds.size,
      outboundRecordCount: outbounds.length,
      factoryShipmentOrderCount: factoryShipmentOrderIds.size,
      factoryShipmentRecordCount: factoryShipmentItems.length,
      flowRecordCount: outbounds.length + factoryShipmentItems.length,
    },
    monthlyCustomerFlows: Array.from(monthlyMap.values())
      .map(item => ({
        month: item.month,
        customerId: item.customerId,
        customerName: item.customerName,
        quantity: item.quantity,
        outboundRecordCount: item.outboundRecordCount,
        salesOrderCount: item.salesOrderIds.size,
        lastOutboundAt: item.lastOutboundAt.toISOString(),
      }))
      .sort((a, b) =>
        a.month === b.month
          ? b.quantity - a.quantity
          : b.month.localeCompare(a.month)
      ),
    outboundRecords: outbounds.slice(0, 500).map(record => ({
      id: record.id,
      recordNumber: record.recordNumber,
      createdAt: record.createdAt.toISOString(),
      quantity: record.quantity,
      reason: record.reason,
      batchNumber: record.batchNumber,
      customerId: record.customerId,
      customerName: record.customer?.name ?? '未关联客户',
      salesOrderId: record.salesOrderId,
      salesOrderNumber: record.salesOrder?.orderNumber ?? null,
      salesOrderStatus: record.salesOrder?.status ?? null,
      variantName: formatVariantName(record.variant),
      location: record.inventory.location,
      operatorName: record.operator.name,
    })),
    factoryShipmentRecords: factoryShipmentItems.slice(0, 500).map(item => {
      const order = item.factoryShipmentOrder;
      const flowDate = pickFactoryShipmentFlowDate(
        [
          item.deliveryConfirmedAt,
          order.deliveryDate,
          order.shipmentDate,
          order.completionDate,
          item.createdAt,
        ],
        range.startDate,
        range.endDate
      );

      return {
        id: item.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        flowDate: flowDate.toISOString(),
        quantity: item.quantity,
        batchNumber: item.batchNumber,
        customerId: order.customerId,
        customerName: order.customer?.name ?? '未关联客户',
        supplierName: item.supplier?.name ?? null,
        variantName: item.product?.code ?? null,
      };
    }),
    inboundRecords: inbounds.map(record => ({
      id: record.id,
      recordNumber: record.recordNumber,
      createdAt: record.createdAt.toISOString(),
      quantity: record.quantity,
      reason: record.reason,
      batchNumber: record.batchNumber,
      supplierName: record.supplier?.name ?? null,
      purchaseOrderNumber: record.purchaseOrder?.orderNumber ?? null,
      variantName: formatVariantName(record.variant),
      operatorName: record.user.name,
    })),
  };
}
