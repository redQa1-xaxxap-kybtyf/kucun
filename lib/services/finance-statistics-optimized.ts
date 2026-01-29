/**
 * 优化的财务统计服务
 * 解决N+1查询问题，提升性能
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/utils/number';

type SalesOrderWithRelations = {
  id: string;
  totalAmount: number;
  createdAt: Date;
  payments: { paymentAmount: number }[];
  refundRecords: { refundAmount: number }[];
};

// 定义Customer查询返回的类型(包含salesOrders关系)
type CustomerWithSalesOrders = Prisma.CustomerGetPayload<{
  include: {
    salesOrders: {
      select: {
        id: true;
        totalAmount: true;
        createdAt: true;
        payments: {
          select: { paymentAmount: true };
        };
        refundRecords: {
          select: { refundAmount: true };
        };
      };
    };
  };
}>;

/**
 * 客户对账单汇总信息
 */
export interface CustomerStatementSummary {
  id: string;
  name: string;
  type: 'customer';
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  lastTransactionDate: string | null;
  creditLimit: number;
  paymentTerms: string;
}

/**
 * 供应商对账单汇总信息
 */
export interface SupplierStatementSummary {
  id: string;
  name: string;
  type: 'supplier';
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  lastTransactionDate: string | null;
  creditLimit: number;
  paymentTerms: string;
}

/**
 * 批量生成客户对账单（优化版 - 无N+1查询）
 */
export async function generateCustomerStatementsOptimized(
  customerIds?: string[]
): Promise<CustomerStatementSummary[]> {
  const results: CustomerStatementSummary[] = [];
  const pageSize = 200;
  let cursor: string | undefined;

  while (true) {
    const customers = (await prisma.customer.findMany({
      where: customerIds ? { id: { in: customerIds } } : {},
      include: {
        salesOrders: {
          where: {
            status: { in: ['confirmed', 'shipped', 'completed'] },
          },
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
            payments: {
              where: { status: 'confirmed' },
              select: { paymentAmount: true },
            },
            refundRecords: {
              where: { status: 'completed' },
              select: { refundAmount: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })) as CustomerWithSalesOrders[];

    if (customers.length === 0) {
      break;
    }

    const overdueMap = await batchCalculateOverdue(
      customers.map(c => c.id),
      'customer'
    );

    results.push(
      ...customers.map(customer => {
        const orders: SalesOrderWithRelations[] = customer.salesOrders.map(
          order => ({
            id: order.id,
            totalAmount: Number(order.totalAmount ?? 0),
            createdAt: order.createdAt,
            payments: order.payments.map(p => ({
              paymentAmount: Number(p.paymentAmount ?? 0),
            })),
            refundRecords: order.refundRecords.map(r => ({
              refundAmount: Number(r.refundAmount ?? 0),
            })),
          })
        );

        const totalOrders = orders.length;
        const totalAmount = orders.reduce<number>(
          (sum, order) => sum + order.totalAmount,
          0
        );

        const paidAmount = orders.reduce<number>((sum, order) => {
          const orderPaid = order.payments.reduce<number>(
            (paymentSum, payment) => paymentSum + payment.paymentAmount,
            0
          );
          return sum + orderPaid;
        }, 0);

        const refundAmount = orders.reduce<number>((sum, order) => {
          const orderRefund = order.refundRecords.reduce<number>(
            (refundSum, refund) => refundSum + refund.refundAmount,
            0
          );
          return sum + orderRefund;
        }, 0);

        const pendingAmount = Math.max(
          0,
          totalAmount - paidAmount - refundAmount
        );

        const lastTransactionDate =
          orders.length > 0
            ? orders
                .map(order => order.createdAt)
                .sort((a, b) => b.getTime() - a.getTime())[0]
                .toISOString()
            : null;

        const customerWithOptionalFields = customer as typeof customer & {
          creditLimit?: number | null;
          paymentTerms?: string | null;
        };

        const creditLimit =
          typeof customerWithOptionalFields.creditLimit === 'number'
            ? customerWithOptionalFields.creditLimit
            : 50000;

        const paymentTerms =
          customerWithOptionalFields.paymentTerms &&
          customerWithOptionalFields.paymentTerms.trim().length > 0
            ? customerWithOptionalFields.paymentTerms
            : '30天';

        return {
          id: customer.id,
          name: customer.name,
          type: 'customer' as const,
          totalOrders,
          totalAmount,
          paidAmount,
          pendingAmount,
          overdueAmount: overdueMap.get(customer.id) || 0,
          lastTransactionDate,
          creditLimit,
          paymentTerms,
        };
      })
    );

    if (customers.length < pageSize) {
      break;
    }

    cursor = customers[customers.length - 1]?.id;
    if (!cursor) {
      break;
    }
  }

  return results;
}

/**
 * 批量计算逾期金额（优化版）
 */
async function batchCalculateOverdue(
  entityIds: string[],
  entityType: 'customer' | 'supplier'
): Promise<Map<string, number>> {
  const overdueMap = new Map<string, number>();

  if (entityIds.length === 0) {
    return overdueMap;
  }

  // 计算30天前的日期
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - 30);

  if (entityType === 'customer') {
    const pageSize = 2000;
    let cursor: string | undefined;

    while (true) {
      // 批量查询所有客户的逾期订单（分页）
      const overdueOrders = await prisma.salesOrder.findMany({
        where: {
          customerId: { in: entityIds },
          status: { in: ['confirmed', 'shipped', 'completed'] },
          createdAt: { lt: overdueDate },
        },
        select: {
          id: true,
          customerId: true,
          totalAmount: true,
          payments: {
            where: { status: 'confirmed' },
            select: { paymentAmount: true },
          },
          refundRecords: {
            where: { status: 'completed' },
            select: { refundAmount: true },
          },
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      // 按客户分组计算逾期金额
      for (const order of overdueOrders) {
        const paidAmount = order.payments.reduce(
          (sum, p) => sum + Number(p.paymentAmount ?? 0),
          0
        );
        const refundAmount = order.refundRecords.reduce(
          (sum, r) => sum + Number(r.refundAmount ?? 0),
          0
        );
        const overdue = Math.max(
          0,
          Number(order.totalAmount ?? 0) - paidAmount - refundAmount
        );

        const currentOverdue = overdueMap.get(order.customerId) || 0;
        overdueMap.set(order.customerId, currentOverdue + overdue);
      }

      if (overdueOrders.length < pageSize) {
        break;
      }

      cursor = overdueOrders[overdueOrders.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }
  } else {
    // 供应商逾期计算
    const pageSize = 2000;
    let cursor: string | undefined;

    while (true) {
      const overduePayables = await prisma.payableRecord.findMany({
        where: {
          supplierId: { in: entityIds },
          status: { in: ['pending', 'partial'] },
          dueDate: { lt: overdueDate },
        },
        select: {
          id: true,
          supplierId: true,
          remainingAmount: true,
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      for (const payable of overduePayables) {
        const currentOverdue = overdueMap.get(payable.supplierId) || 0;
        overdueMap.set(
          payable.supplierId,
          currentOverdue + toNumber(payable.remainingAmount)
        );
      }

      if (overduePayables.length < pageSize) {
        break;
      }

      cursor = overduePayables[overduePayables.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }
  }

  return overdueMap;
}

/**
 * 批量生成供应商对账单（优化版）
 */
export async function generateSupplierStatementsOptimized(
  supplierIds?: string[]
): Promise<SupplierStatementSummary[]> {
  const results: SupplierStatementSummary[] = [];
  const pageSize = 200;
  let cursor: string | undefined;

  while (true) {
    const suppliers = await prisma.supplier.findMany({
      where: supplierIds ? { id: { in: supplierIds } } : {},
      include: {
        salesOrders: {
          where: {
            orderType: 'TRANSFER',
            status: { in: ['confirmed', 'shipped', 'completed'] },
          },
          select: {
            id: true,
            costAmount: true,
            createdAt: true,
            payments: {
              where: { status: 'confirmed' },
              select: { paymentAmount: true },
            },
          },
        },
        factoryShipmentOrderItems: {
          select: {
            factoryShipmentOrder: {
              select: {
                id: true,
                totalAmount: true,
                createdAt: true,
                payments: {
                  where: { status: 'confirmed', paymentType: 'order_payment' },
                  select: { paymentAmount: true },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (suppliers.length === 0) {
      break;
    }

    const overdueMap = await batchCalculateOverdue(
      suppliers.map(s => s.id),
      'supplier'
    );

    results.push(
      ...suppliers.map(supplier => {
        // 调货销售订单统计
        const transferOrders = supplier.salesOrders;
        const transferAmount = transferOrders.reduce(
          (sum, o) => sum + toNumber(o.costAmount),
          0
        );
        const transferPaid = transferOrders.reduce(
          (sum, o) =>
            sum +
            o.payments.reduce(
              (pSum, p) => pSum + Number(p.paymentAmount ?? 0),
              0
            ),
          0
        );

        // 厂家发货订单统计（去重）
        const uniqueFactoryOrders = new Map<
          string,
          { totalAmount: number; paidAmount: number; createdAt: Date }
        >();
        supplier.factoryShipmentOrderItems.forEach(item => {
          const order = item.factoryShipmentOrder;
          if (!uniqueFactoryOrders.has(order.id)) {
            uniqueFactoryOrders.set(order.id, {
              totalAmount: toNumber(order.totalAmount),
              paidAmount: order.payments.reduce(
                (sum, payment) => sum + Number(payment.paymentAmount ?? 0),
                0
              ),
              createdAt: order.createdAt,
            });
          }
        });

        const factoryTotalAmount = Array.from(
          uniqueFactoryOrders.values()
        ).reduce((sum, o) => sum + o.totalAmount, 0);
        const factoryPaidAmount = Array.from(
          uniqueFactoryOrders.values()
        ).reduce((sum, o) => sum + o.paidAmount, 0);

        // 合计
        const totalOrders = transferOrders.length + uniqueFactoryOrders.size;
        const totalAmount = transferAmount + factoryTotalAmount;
        const paidAmount = transferPaid + factoryPaidAmount;
        const pendingAmount = Math.max(0, totalAmount - paidAmount);

        // 最后交易日期
        const allDates = [
          ...transferOrders.map(o => o.createdAt),
          ...Array.from(uniqueFactoryOrders.values()).map(o => o.createdAt),
        ];
        const lastTransactionDate =
          allDates.length > 0
            ? allDates
                .sort((a, b) => b.getTime() - a.getTime())[0]
                .toISOString()
            : null;

        return {
          id: supplier.id,
          name: supplier.name,
          type: 'supplier' as const,
          totalOrders,
          totalAmount,
          paidAmount,
          pendingAmount,
          overdueAmount: overdueMap.get(supplier.id) || 0,
          lastTransactionDate,
          creditLimit: 100000, // 默认供应商信用额度
          paymentTerms: '30天', // 默认付款条款
        };
      })
    );

    if (suppliers.length < pageSize) {
      break;
    }

    cursor = suppliers[suppliers.length - 1]?.id;
    if (!cursor) {
      break;
    }
  }

  return results;
}

/**
 * 获取财务概览（优化版）
 */
export async function getFinancialOverviewOptimized(): Promise<{
  receivables: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
  };
  payables: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
  };
}> {
  const pageSize = 2000;

  const computeReceivables = async () => {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 30);

    let total = 0;
    let paid = 0;
    let overdue = 0;
    let cursor: string | undefined;

    while (true) {
      const page = await prisma.salesOrder.findMany({
        where: {
          status: { in: ['confirmed', 'shipped', 'completed'] },
        },
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
          payments: {
            where: { status: 'confirmed' },
            select: { paymentAmount: true },
          },
          refundRecords: {
            where: { status: 'completed' },
            select: { refundAmount: true },
          },
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      for (const order of page) {
        const totalAmount = Number(order.totalAmount ?? 0);
        const paidAmount = order.payments.reduce(
          (sum, p) => sum + Number(p.paymentAmount ?? 0),
          0
        );
        const refundAmount = order.refundRecords.reduce(
          (sum, r) => sum + Number(r.refundAmount ?? 0),
          0
        );

        total += totalAmount;
        paid += paidAmount + refundAmount;

        if (order.createdAt < overdueDate) {
          overdue += Math.max(0, totalAmount - paidAmount - refundAmount);
        }
      }

      if (page.length < pageSize) {
        break;
      }

      cursor = page[page.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }

    return { total, paid, overdue };
  };

  const computePayables = async () => {
    let total = 0;
    let paid = 0;
    let overdue = 0;
    let cursor: string | undefined;
    const now = new Date();

    while (true) {
      const page = await prisma.payableRecord.findMany({
        where: {
          status: { in: ['pending', 'partial', 'paid'] },
        },
        select: {
          id: true,
          payableAmount: true,
          remainingAmount: true,
          dueDate: true,
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      for (const payable of page) {
        const payableAmount = toNumber(payable.payableAmount);
        const remainingAmount = toNumber(payable.remainingAmount);
        total += payableAmount;
        paid += payableAmount - remainingAmount;

        if (payable.dueDate && payable.dueDate < now) {
          overdue += remainingAmount;
        }
      }

      if (page.length < pageSize) {
        break;
      }

      cursor = page[page.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }

    return { total, paid, overdue };
  };

  const [receivables, payables] = await Promise.all([
    computeReceivables(),
    computePayables(),
  ]);

  return {
    receivables: {
      total: receivables.total,
      paid: receivables.paid,
      pending: receivables.total - receivables.paid,
      overdue: receivables.overdue,
    },
    payables: {
      total: payables.total,
      paid: payables.paid,
      pending: payables.total - payables.paid,
      overdue: payables.overdue,
    },
  };
}
