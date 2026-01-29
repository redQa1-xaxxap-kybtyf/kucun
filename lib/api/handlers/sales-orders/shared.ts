import type { Prisma } from '@prisma/client';

import type {
  SalesOrderStatus,
  SalesOrderType,
  TransferFulfillmentMode,
} from '@/lib/types/sales-order';

export const salesOrderItemSelect = {
  id: true,
  salesOrderId: true,
  productId: true,
  variantId: true,
  displayUnit: true,
  displayQuantity: true,
  piecesPerUnit: true,
  specification: true,
  remarks: true,
  batchNumber: true,
  colorCode: true,
  productionDate: true,
  quantity: true,
  unitPrice: true,
  subtotal: true,
  unitCost: true,
  localQuantity: true,
  transferQuantity: true,
  profitAmount: true,
  isManualProduct: true,
  manualProductName: true,
  manualSpecification: true,
  manualWeight: true,
  manualUnit: true,
  productCode: true,
  costSubtotal: true,
  temporaryProductId: true,
} as const;

export type SalesOrderItemResult = Prisma.SalesOrderItemGetPayload<{
  select: typeof salesOrderItemSelect;
}>;

export const salesOrderRelations = {
  customer: {
    select: {
      id: true,
      name: true,
      address: true,
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
    select: salesOrderItemSelect,
  },
  _count: {
    select: {
      items: true,
    },
  },
} as const;

type DateLike = Date | string | null | undefined;

const toISOString = (value: DateLike) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

export function mapSalesOrderItem(
  item: SalesOrderItemResult,
  product?: {
    id: string;
    name: string;
    code: string;
    unit: string;
    specification: string | null;
    piecesPerUnit: number;
    weight: number | null;
  }
) {
  // ✅ 将 Decimal 类型字段转换为 number，避免序列化到客户端时报错
  const toNumber = (value: unknown) =>
    value !== null && value !== undefined ? Number(value) : undefined;

  return {
    ...item,
    // Decimal 字段转换
    displayQuantity: toNumber(item.displayQuantity),
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    subtotal: toNumber(item.subtotal),
    unitCost: toNumber(item.unitCost),
    profitAmount: toNumber(item.profitAmount),
    costSubtotal: toNumber(item.costSubtotal),
    localQuantity: toNumber(item.localQuantity),
    transferQuantity: toNumber(item.transferQuantity),
    piecesPerUnit:
      toNumber(item.piecesPerUnit) ?? product?.piecesPerUnit ?? undefined,
    manualWeight: toNumber(item.manualWeight),
    // 其他字段
    batchNumber: item.batchNumber ?? undefined,
    productionDate: toISOString(item.productionDate),
    displayUnit: item.displayUnit || undefined,
    specification:
      item.specification ||
      (item.isManualProduct
        ? item.manualSpecification || undefined
        : product?.specification || undefined),
    remarks: item.remarks ?? undefined,
    product: product ? { ...product } : undefined,
  };
}

export function mapOrderBaseFields<
  T extends {
    status: Prisma.SalesOrderUpdateInput['status'];
    orderType: Prisma.SalesOrderCreateInput['orderType'];
    transferMode: unknown;
    customer?: {
      id: string;
      name: string;
      phone: string | null;
      address: string | null;
    } | null;
    supplierId: string | null;
    costAmount: Prisma.Decimal | number | null;
    expenseAmount: Prisma.Decimal | number | null;
    profitAmount: Prisma.Decimal | number | null;
    itemsAmount?: Prisma.Decimal | number | null;
    additionalFees?: Prisma.Decimal | number | null;
    totalAmount?: Prisma.Decimal | number | null;
    paidAmount?: Prisma.Decimal | number | null;
    roundingAdjustment?: Prisma.Decimal | number | null;
    prepaymentAmount?: Prisma.Decimal | number | null;
    remarks: string | null;
    shippedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(order: T) {
  // ✅ 将所有 Decimal 类型字段转换为 number，避免序列化到客户端时报错
  const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    value !== null && value !== undefined ? Number(value) : undefined;

  return {
    ...order,
    status: order.status as SalesOrderStatus,
    orderType: order.orderType as SalesOrderType,
    transferMode: order.transferMode as TransferFulfillmentMode,
    customer: order.customer
      ? {
          ...order.customer,
          phone: order.customer.phone ?? undefined,
          address: order.customer.address ?? undefined,
        }
      : undefined,
    supplierId: order.supplierId ?? undefined,
    // 金额字段转换
    costAmount: toNumber(order.costAmount),
    expenseAmount: toNumber(order.expenseAmount),
    profitAmount: toNumber(order.profitAmount),
    itemsAmount: toNumber(order.itemsAmount),
    additionalFees: toNumber(order.additionalFees),
    totalAmount: toNumber(order.totalAmount),
    paidAmount: toNumber(order.paidAmount),
    roundingAdjustment: toNumber(order.roundingAdjustment),
    prepaymentAmount: toNumber(order.prepaymentAmount),
    // 其他字段
    remarks: order.remarks ?? undefined,
    shippedAt: toISOString(order.shippedAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
