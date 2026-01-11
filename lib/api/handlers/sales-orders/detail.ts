import type { Prisma, SalesOrder } from '@prisma/client';

import { prisma } from '@/lib/db';

import {
  mapOrderBaseFields,
  mapSalesOrderItem,
  salesOrderItemSelect,
} from './shared';

const detailInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
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
  feeItems: {
    select: {
      id: true,
      feeType: true,
      feeName: true,
      feeAmount: true,
      paidBy: true,
      remarks: true,
    },
  },
  returnOrders: {
    where: {
      status: { not: 'cancelled' },
    },
    select: {
      id: true,
      returnNumber: true,
      status: true,
      createdAt: true,
      refundAmount: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
} as const;

type SalesOrderDetailResult = Prisma.SalesOrderGetPayload<{
  include: typeof detailInclude;
}>;

const mapReturnOrder = (
  order: SalesOrderDetailResult['returnOrders'][number]
) => ({
  id: order.id,
  returnNumber: order.returnNumber,
  status: order.status,
  createdAt: order.createdAt.toISOString(),
  refundAmount: Number(order.refundAmount ?? 0),
});

const mapDetail = (
  order: SalesOrderDetailResult,
  productsMap: Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number;
      weight: number | null;
    }
  >
) => {
  const { items, returnOrders, _count, ...base } = order;
  const orderBase = mapOrderBaseFields(base);

  return {
    ...orderBase,
    items: items.map(item =>
      mapSalesOrderItem(
        item,
        item.productId ? productsMap.get(item.productId) : undefined
      )
    ),
    feeItems: order.feeItems.map(fee => ({
      id: fee.id,
      feeType: fee.feeType,
      feeName: fee.feeName,
      feeAmount: fee.feeAmount,
      paidBy: (fee.paidBy as 'customer' | 'company') ?? 'customer',
      remarks: fee.remarks ?? undefined,
    })),
    hasReturnOrder: returnOrders.length > 0,
    returnOrders: returnOrders.map(mapReturnOrder),
    itemCount: _count.items,
  };
};

export async function getSalesOrderById(id: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: detailInclude,
  });

  if (!order) {
    return null;
  }

  // 手动获取产品信息
  const productIds = order.items
    .map(item => item.productId)
    .filter(Boolean) as string[];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      specification: true,
      piecesPerUnit: true,
      weight: true,
    },
    take: productIds.length,
  });

  const productsMap = new Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number;
      weight: number | null;
    }
  >(
    products.map(p => [
      p.id,
      {
        ...p,
        weight: p.weight === null ? null : Number(p.weight),
      },
    ])
  );

  return mapDetail(order, productsMap);
}

/**
 * 获取销售订单详情（含收款统计与收款记录ISO化）
 */
export async function getSalesOrderDetailWithPayments(id: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      ...detailInclude,
      payments: {
        select: {
          id: true,
          paymentNumber: true,
          paymentAmount: true,
          actualPaymentAmount: true,
          roundingAmount: true,
          paymentMethod: true,
          paymentDate: true,
          status: true,
          remarks: true,
          createdAt: true,
        },
        orderBy: { paymentDate: 'desc' },
      },
      refundRecords: {
        select: {
          refundAmount: true,
          processedAmount: true,
          remainingAmount: true,
          status: true,
        },
      },
      prepaymentUsages: {
        select: {
          id: true,
          paymentRecordId: true,
          appliedAmount: true,
          createdAt: true,
          paymentRecord: {
            select: {
              paymentNumber: true,
              paymentMethod: true,
              paymentDate: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!order) return null;

  // 手动获取产品信息
  const productIds = order.items
    .map(item => item.productId)
    .filter(Boolean) as string[];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      specification: true,
      piecesPerUnit: true,
      weight: true,
    },
    take: productIds.length,
  });

  const productsMap = new Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number;
      weight: number | null;
    }
  >(
    products.map(p => [
      p.id,
      {
        ...p,
        weight: p.weight === null ? null : Number(p.weight),
      },
    ])
  );

  const refundTotals = order.refundRecords.reduce(
    (acc, refund) => {
      acc.totalRefundAmount += Number(refund.refundAmount ?? 0);
      acc.refundedAmount += Number(refund.processedAmount ?? 0);
      acc.refundPendingAmount += Number(refund.remainingAmount ?? 0);
      return acc;
    },
    { totalRefundAmount: 0, refundedAmount: 0, refundPendingAmount: 0 }
  );

  const confirmed = order.payments.filter(p => p.status === 'confirmed');
  const actualPaidAmount = confirmed.reduce(
    (sum, r) => sum + Number(r.actualPaymentAmount),
    0
  );
  const paymentRounding = confirmed.reduce(
    (sum, r) => sum + Number(r.roundingAmount || 0),
    0
  );
  const paidAmount = actualPaidAmount + paymentRounding;

  type SalesOrderAmounts = Pick<
    SalesOrder,
    'totalAmount' | 'roundingAdjustment'
  >;
  const amounts = order as unknown as SalesOrderAmounts;
  const actualTotalAmount =
    Number(amounts.totalAmount) + Number(amounts.roundingAdjustment ?? 0);
  const remainingAmount = Math.max(0, actualTotalAmount - paidAmount);

  const mapped = mapDetail(
    order as unknown as SalesOrderDetailResult,
    productsMap
  );

  const prepaymentUsages =
    order.prepaymentUsages?.map(usage => ({
      id: usage.id,
      paymentRecordId: usage.paymentRecordId,
      paymentNumber: usage.paymentRecord.paymentNumber,
      paymentMethod: usage.paymentRecord.paymentMethod,
      paymentDate: usage.paymentRecord.paymentDate.toISOString(),
      paymentStatus: usage.paymentRecord.status,
      appliedAmount: Number(usage.appliedAmount ?? 0),
      createdAt: usage.createdAt.toISOString(),
    })) ?? [];

  const prepaymentTotalApplied = prepaymentUsages.reduce(
    (sum, u) => sum + u.appliedAmount,
    0
  );

  return {
    ...mapped,
    paymentRecords: order.payments.map(p => ({
      ...p,
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    actualPaidAmount,
    paymentRounding,
    paidAmount,
    remainingAmount,
    totalRefundAmount: refundTotals.totalRefundAmount,
    refundedAmount: refundTotals.refundedAmount,
    refundPendingAmount: refundTotals.refundPendingAmount,
    prepaymentUsages,
    prepaymentTotalApplied,
  };
}
