/**
 * 往来账单详情辅助函数
 * 拆分超长函数，符合全局约定规范（每个函数不超过 50 行）
 */

import type { Customer, SalesOrder, Supplier } from '@prisma/client';

import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/utils/number';

/**
 * 客户订单类型（包含关联数据）
 */
type CustomerOrderWithRelations = Omit<SalesOrder, 'totalAmount'> & {
  totalAmount: number;
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentAmount: number;
    paymentDate: Date;
    paymentMethod: string;
    status: string;
  }>;
  prepaymentUsages: Array<{
    id: string;
    appliedAmount: number;
    createdAt: Date;
  }>;
  refundRecords: Array<{
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
type SupplierOrderWithRelations = Omit<SalesOrder, 'totalAmount'> & {
  totalAmount: number;
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
  const customer = await prisma.customer.findUnique({
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
              paymentType: 'order_payment',
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
          prepaymentUsages: {
            select: {
              id: true,
              appliedAmount: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          refundRecords: {
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

  if (!customer) {
    return null;
  }

  const mapped: CustomerWithOrders = {
    ...customer,
    salesOrders: customer.salesOrders.map(order => ({
      ...order,
      totalAmount: toNumber(order.totalAmount),
      payments: order.payments.map(payment => ({
        ...payment,
        paymentAmount: Number(payment.paymentAmount ?? 0),
      })),
      prepaymentUsages: order.prepaymentUsages.map(usage => ({
        ...usage,
        appliedAmount: Number(usage.appliedAmount ?? 0),
      })),
      refundRecords: order.refundRecords.map(refund => ({
        ...refund,
        refundAmount: Number(refund.refundAmount ?? 0),
      })),
    })),
  };

  return mapped;
}

/**
 * 查询供应商数据（包含订单、付款）
 */
export async function fetchSupplierWithOrders(
  id: string
): Promise<SupplierWithOrders | null> {
  const supplier = await prisma.supplier.findUnique({
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

  if (!supplier) {
    return null;
  }

  const mapped: SupplierWithOrders = {
    ...supplier,
    salesOrders: supplier.salesOrders.map(order => ({
      ...order,
      totalAmount: toNumber(order.totalAmount),
      payments: order.payments.map(payment => ({
        ...payment,
        paymentAmount: Number(payment.paymentAmount ?? 0),
      })),
    })),
    factoryShipmentOrderItems: supplier.factoryShipmentOrderItems.map(item => ({
      ...item,
      totalPrice: Number(item.totalPrice ?? 0),
      factoryShipmentOrder: {
        ...item.factoryShipmentOrder,
        paidAmount: Number(item.factoryShipmentOrder.paidAmount ?? 0),
      },
    })),
  };

  return mapped;
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
    const prepaymentAppliedAmount = order.prepaymentUsages.reduce(
      (preSum, usage) => preSum + usage.appliedAmount,
      0
    );
    return sum + orderPaidAmount + prepaymentAppliedAmount;
  }, 0);

  const refundAmount = customer.salesOrders.reduce((sum, order) => {
    const orderRefundAmount = order.refundRecords.reduce(
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

    order.prepaymentUsages.forEach(usage => {
      runningBalance -= usage.appliedAmount;
      transactions.push({
        id: usage.id,
        date: usage.createdAt,
        type: 'payment',
        amount: -usage.appliedAmount,
        balance: runningBalance,
        description: `预收冲抵`,
        orderId: order.id,
      });
    });

    order.refundRecords.forEach(refund => {
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
