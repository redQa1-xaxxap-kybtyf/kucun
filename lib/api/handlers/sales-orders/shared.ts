import type { Prisma } from '@prisma/client';

import type { SalesOrderStatus, SalesOrderType } from '@/lib/types/sales-order';

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
  product: {
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      specification: true,
      piecesPerUnit: true,
      weight: true,
    },
  },
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
  supplier: {
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

export function mapSalesOrderItem(item: SalesOrderItemResult) {
  return {
    ...item,
    batchNumber: item.batchNumber ?? undefined,
    productionDate: toISOString(item.productionDate),
    displayUnit: item.displayUnit || undefined,
    displayQuantity: item.displayQuantity ?? undefined,
    piecesPerUnit:
      item.piecesPerUnit ?? item.product?.piecesPerUnit ?? undefined,
    specification:
      item.specification ||
      (item.isManualProduct
        ? item.manualSpecification || undefined
        : item.product?.specification || undefined),
    remarks: item.remarks ?? undefined,
    // localQuantity 和 transferQuantity 在数据库中有 @default(0)，所以始终是数字
    localQuantity: item.localQuantity,
    transferQuantity: item.transferQuantity,
    product: item.product ? { ...item.product } : undefined,
  };
}

export function mapOrderBaseFields<
  T extends {
    status: Prisma.SalesOrderUpdateInput['status'];
    orderType: Prisma.SalesOrderCreateInput['orderType'];
    supplierId: string | null;
    costAmount: Prisma.Decimal | number | null;
    profitAmount: Prisma.Decimal | number | null;
    remarks: string | null;
    shippedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(order: T) {
  return {
    ...order,
    status: order.status as SalesOrderStatus,
    orderType: order.orderType as SalesOrderType,
    supplierId: order.supplierId ?? undefined,
    costAmount: order.costAmount ?? undefined,
    profitAmount: order.profitAmount ?? undefined,
    remarks: order.remarks ?? undefined,
    shippedAt: toISOString(order.shippedAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
