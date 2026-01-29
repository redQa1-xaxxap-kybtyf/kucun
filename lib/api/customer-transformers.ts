import type { Customer } from '@/lib/types/customer';
import { toNumber } from '@/lib/utils/number';
import { parseExtendedInfo } from '@/lib/validations/customer';

export interface PrismaCustomerBase {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  extendedInfo: string | null;
  parentCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  createdAt: string;
}

export interface CustomerReturnSummary {
  id: string;
  returnNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface CustomerDetailResult extends Customer {
  salesOrders: CustomerOrderSummary[];
  returnOrders: CustomerReturnSummary[];
  _count: {
    salesOrders: number;
    returnOrders: number;
  };
  totalOrders: number;
  totalAmount: number;
  lastOrderDate?: string;
  childCustomers?: Customer[];
}

export interface CustomerDetailQueryResult extends PrismaCustomerBase {
  parentCustomer: PrismaCustomerBase | null;
  childCustomers: PrismaCustomerBase[];
  salesOrders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: unknown;
    paidAmount: unknown;
    status: string;
    createdAt: Date;
  }>;
  returnOrders: Array<{
    id: string;
    returnNumber: string;
    totalAmount: unknown;
    status: string;
    createdAt: Date;
  }>;
  _count: {
    salesOrders: number;
    returnOrders: number;
  };
}

export interface CustomerListQueryResult extends PrismaCustomerBase {
  parentCustomer: PrismaCustomerBase | null;
  salesOrders: Array<{
    id: string;
    totalAmount: unknown;
    status: string;
    createdAt: Date;
  }>;
  returnOrders: Array<{
    id: string;
    status: string;
  }>;
}

export function mapCustomerBase(customer: PrismaCustomerBase): Customer {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone || undefined,
    address: customer.address || undefined,
    extendedInfo: customer.extendedInfo || undefined,
    parentCustomerId: customer.parentCustomerId || undefined,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

function summarizeSalesOrders(
  orders: CustomerDetailQueryResult['salesOrders']
) {
  const summaries: CustomerOrderSummary[] = orders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: toNumber(order.totalAmount, 0),
    paidAmount: toNumber(order.paidAmount, 0),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  }));
  const totalOrders = orders.length;
  const totalAmount = summaries.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );
  const lastOrderDate = orders[0]?.createdAt.toISOString();
  return { summaries, totalOrders, totalAmount, lastOrderDate };
}

function summarizeReturnOrders(
  orders: CustomerDetailQueryResult['returnOrders']
): CustomerReturnSummary[] {
  return orders.map(order => ({
    id: order.id,
    returnNumber: order.returnNumber,
    totalAmount: toNumber(order.totalAmount, 0),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  }));
}

export function buildCustomerDetail(
  customer: CustomerDetailQueryResult
): CustomerDetailResult {
  const extendedInfo = parseExtendedInfo(customer.extendedInfo || undefined);
  const { summaries, totalOrders, totalAmount, lastOrderDate } =
    summarizeSalesOrders(customer.salesOrders);
  const returnOrders = summarizeReturnOrders(customer.returnOrders);
  const baseCustomer = mapCustomerBase(customer);
  const parentCustomer = customer.parentCustomer
    ? mapCustomerBase(customer.parentCustomer)
    : undefined;
  const childCustomers =
    customer.childCustomers.length > 0
      ? customer.childCustomers.map(mapCustomerBase)
      : undefined;

  return {
    ...baseCustomer,
    extendedInfo: JSON.stringify(extendedInfo),
    parentCustomer,
    childCustomers,
    salesOrders: summaries,
    returnOrders,
    _count: customer._count,
    totalOrders,
    totalAmount,
    lastOrderDate,
  };
}

function calculateCooperationDays(
  orders: CustomerListQueryResult['salesOrders']
) {
  if (orders.length === 0) {
    return undefined;
  }
  const firstOrderDate = orders[0].createdAt;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - firstOrderDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function transformCustomerListItem(
  customer: CustomerListQueryResult
): Customer {
  const extendedInfo = parseExtendedInfo(customer.extendedInfo || undefined);

  const completedOrders = customer.salesOrders.filter(
    order => order.status !== 'cancelled' && order.status !== 'draft'
  );
  const transactionCount = completedOrders.length;
  const totalAmount = completedOrders.reduce(
    (sum, order) => sum + toNumber(order.totalAmount, 0),
    0
  );
  const lastOrderDate =
    customer.salesOrders.length > 0
      ? customer.salesOrders[
          customer.salesOrders.length - 1
        ]?.createdAt.toISOString()
      : undefined;
  const cooperationDays = calculateCooperationDays(customer.salesOrders);
  const returnOrderCount = customer.returnOrders.filter(
    order => order.status !== 'cancelled'
  ).length;

  const baseCustomer = mapCustomerBase(customer);
  const parentCustomer = customer.parentCustomer
    ? mapCustomerBase(customer.parentCustomer)
    : undefined;

  return {
    ...baseCustomer,
    extendedInfo: JSON.stringify(extendedInfo),
    parentCustomer,
    totalOrders: customer.salesOrders.length,
    totalAmount,
    lastOrderDate,
    transactionCount,
    cooperationDays,
    returnOrderCount,
  };
}
