/**
 * 往来账单详情辅助函数
 * 拆分超长函数，符合全局约定规范（每个函数不超过 50 行）
 */

import type { Customer, SalesOrder, Supplier } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * 客户订单类型（包含关联数据）
 */
type CustomerOrderWithRelations = SalesOrder & {
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentAmount: number;
    paymentDate: Date;
    paymentMethod: string;
    status: string;
  }>;
  refunds: Array<{
    id: string;
    refundNumber: string;
    refundAmount: number;
    refundDate: Date;
    reason: string;
    status: string;
  }>;
};

/**
 * 客户类型（包含订单）
 */
type CustomerWithOrders = Customer & {
  salesOrders: CustomerOrderWithRelations[];
};

/**
 * 供应商订单类型（包含关联数据）
 */
type SupplierOrderWithRelations = SalesOrder & {
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentAmount: number;
    paymentDate: Date;
    paymentMethod: string;
    status: string;
  }>;
};

/**
 * 供应商类型（包含订单）
 */
type SupplierWithOrders = Supplier & {
  salesOrders: SupplierOrderWithRelations[];
  factoryShipmentOrderItems: Array<{
    id: string;
    displayName: string;
    totalPrice: number;
    createdAt: Date;
    factoryShipmentOrder: {
      id: string;
      orderNumber: string;
      status: string;
      paidAmount: number;
      updatedAt: Date;
    };
  }>;
};

/**
 * 查询客户数据（包含订单、付款、退款）
 */
export async function fetchCustomerWithOrders(
  id: string
): Promise<CustomerWithOrders | null> {
  return await prisma.customer.findUnique({
    where: { id },
    include: {
      salesOrders: {
        where: {
          status: {
            in: ['confirmed', 'shipped', 'completed'],
          },
        },
        include: {
          payments: {
            where: {
              status: 'confirmed',
            },
            select: {
              id: true,
              paymentNumber: true,
              paymentAmount: true,
              paymentDate: true,
              paymentMethod: true,
              status: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
          refunds: {
            where: {
              status: 'completed',
            },
            select: {
              id: true,
              refundNumber: true,
              refundAmount: true,
              refundDate: true,
              reason: true,
              status: true,
            },
            orderBy: {
              refundDate: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
}

/**
 * 查询供应商数据（包含订单、付款）
 */
export async function fetchSupplierWithOrders(
  id: string
): Promise<SupplierWithOrders | null> {
  return await prisma.supplier.findUnique({
    where: { id },
    include: {
      salesOrders: {
        where: {
          status: {
            in: ['confirmed', 'shipped', 'completed'],
          },
        },
        include: {
          payments: {
            where: {
              status: 'confirmed',
            },
            select: {
              id: true,
              paymentNumber: true,
              paymentAmount: true,
              paymentDate: true,
              paymentMethod: true,
              status: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      factoryShipmentOrderItems: {
        select: {
          id: true,
          displayName: true,
          totalPrice: true,
          createdAt: true,
          factoryShipmentOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paidAmount: true,
              updatedAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
}

/**
 * 计算客户财务统计
 */
export function calculateCustomerFinancials(customer: CustomerWithOrders) {
  const totalOrders = customer.salesOrders.length;
  const totalAmount = customer.salesOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const paidAmount = customer.salesOrders.reduce((sum, order) => {
    const orderPaidAmount = order.payments.reduce(
      (paySum, payment) => paySum + payment.paymentAmount,
      0
    );
    return sum + orderPaidAmount;
  }, 0);

  const refundAmount = customer.salesOrders.reduce((sum, order) => {
    const orderRefundAmount = order.refunds.reduce(
      (refundSum, refund) => refundSum + refund.refundAmount,
      0
    );
    return sum + orderRefundAmount;
  }, 0);

  // 待收金额 = 总金额 - 已付金额 - 退款金额
  const pendingAmount = Math.max(0, totalAmount - paidAmount - refundAmount);

  return {
    totalOrders,
    totalAmount,
    paidAmount,
    refundAmount,
    pendingAmount,
  };
}

/**
 * 计算逾期金额
 */
export function calculateOverdueAmount(customer: CustomerWithOrders): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const overdueOrders = customer.salesOrders.filter(
    order =>
      order.createdAt < thirtyDaysAgo &&
      ['confirmed', 'shipped'].includes(order.status)
  );

  return overdueOrders.reduce((sum, order) => {
    const orderPaidAmount = order.payments.reduce(
      (paySum, payment) => paySum + payment.paymentAmount,
      0
    );
    const orderRefundAmount = order.refunds.reduce(
      (refundSum, refund) => refundSum + refund.refundAmount,
      0
    );
    const orderPendingAmount = Math.max(
      0,
      order.totalAmount - orderPaidAmount - orderRefundAmount
    );
    return sum + orderPendingAmount;
  }, 0);
}

/**
 * 计算供应商财务统计
 */
export function calculateSupplierFinancials(supplier: SupplierWithOrders) {
  const totalOrders = supplier.salesOrders.length;
  const totalAmount = supplier.salesOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const transferPaidAmount = supplier.salesOrders.reduce((sum, order) => {
    const orderPaidAmount = order.payments.reduce(
      (paySum, payment) => paySum + payment.paymentAmount,
      0
    );
    return sum + orderPaidAmount;
  }, 0);

  const transferPendingAmount = Math.max(0, totalAmount - transferPaidAmount);

  return {
    totalOrders,
    totalAmount,
    transferPaidAmount,
    transferPendingAmount,
  };
}

/**
 * 计算供应商逾期金额
 */
export function calculateSupplierOverdueAmount(
  supplier: SupplierWithOrders
): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const overdueOrders = supplier.salesOrders.filter(
    order =>
      order.createdAt < thirtyDaysAgo &&
      ['confirmed', 'shipped'].includes(order.status)
  );

  return overdueOrders.reduce((sum, order) => {
    const orderPaidAmount = order.payments.reduce(
      (paySum, payment) => paySum + payment.paymentAmount,
      0
    );
    const orderPendingAmount = Math.max(0, order.totalAmount - orderPaidAmount);
    return sum + orderPendingAmount;
  }, 0);
}

/**
 * 构建客户交易记录
 */
export function buildCustomerTransactions(customer: CustomerWithOrders) {
  const transactions: Array<{
    id: string;
    date: Date;
    type: 'order' | 'payment' | 'refund';
    amount: number;
    balance: number;
    description: string;
    orderId?: string;
  }> = [];

  let runningBalance = 0;

  customer.salesOrders.forEach(order => {
    runningBalance += order.totalAmount;
    transactions.push({
      id: order.id,
      date: order.createdAt,
      type: 'order',
      amount: order.totalAmount,
      balance: runningBalance,
      description: `订单 ${order.orderNumber}`,
      orderId: order.id,
    });

    order.payments.forEach(payment => {
      runningBalance -= payment.paymentAmount;
      transactions.push({
        id: payment.id,
        date: payment.paymentDate,
        type: 'payment',
        amount: -payment.paymentAmount,
        balance: runningBalance,
        description: `收款`,
        orderId: order.id,
      });
    });

    order.refunds.forEach(refund => {
      runningBalance -= refund.refundAmount;
      transactions.push({
        id: refund.id,
        date: refund.refundDate,
        type: 'refund',
        amount: -refund.refundAmount,
        balance: runningBalance,
        description: `退款`,
        orderId: order.id,
      });
    });
  });

  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * 构建供应商交易记录
 */
export function buildSupplierTransactions(supplier: SupplierWithOrders) {
  const transactions: Array<{
    id: string;
    date: Date;
    type: 'order' | 'payment';
    amount: number;
    balance: number;
    description: string;
    orderId?: string;
  }> = [];

  let runningBalance = 0;

  supplier.salesOrders.forEach(order => {
    runningBalance += order.totalAmount;
    transactions.push({
      id: order.id,
      date: order.createdAt,
      type: 'order',
      amount: order.totalAmount,
      balance: runningBalance,
      description: `采购订单 ${order.orderNumber}`,
      orderId: order.id,
    });

    order.payments.forEach(payment => {
      runningBalance -= payment.paymentAmount;
      transactions.push({
        id: payment.id,
        date: payment.paymentDate,
        type: 'payment',
        amount: -payment.paymentAmount,
        balance: runningBalance,
        description: `付款`,
        orderId: order.id,
      });
    });
  });

  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}
