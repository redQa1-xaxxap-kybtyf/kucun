import type { Metadata } from 'next';

import { getCustomerStatements } from '@/lib/services/customer-statement-service';
import type { CustomerStatementQuery } from '@/lib/types/customer-statement';

import { CustomerStatementsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '客户对账单 - 财务管理',
  description: '查看与客户之间的往来账务记录与余额情况',
};

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

const ALLOWED_BALANCE_TYPES: Array<
  NonNullable<CustomerStatementQuery['balanceType']>
> = ['receivable', 'payable', 'all'];

const ALLOWED_SORT_FIELDS: CustomerStatementQuery['sortBy'][] = [
  'customerName',
  'netBalance',
  'receivableBalance',
  'payableBalance',
  'lastTransactionDate',
];

const ALLOWED_SORT_ORDER: CustomerStatementQuery['sortOrder'][] = [
  'asc',
  'desc',
];

function normaliseQuery(
  params: Record<string, string | string[] | undefined>
): CustomerStatementQuery {
  const query: CustomerStatementQuery = {};

  const getSingle = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pageParam = getSingle('page');
  const pageSizeParam = getSingle('pageSize') ?? getSingle('limit');
  const customerId = getSingle('customerId');
  const customerName = getSingle('customerName') ?? getSingle('search');
  const startDate = getSingle('startDate');
  const endDate = getSingle('endDate');
  const minBalance = getSingle('minBalance');
  const maxBalance = getSingle('maxBalance');
  const balanceType = getSingle('balanceType');
  const sortBy = getSingle('sortBy');
  const sortOrder = getSingle('sortOrder');

  const page = pageParam ? Number.parseInt(pageParam, 10) : DEFAULT_PAGE;
  query.page = Number.isFinite(page) && page > 0 ? page : DEFAULT_PAGE;

  const pageSize = pageSizeParam
    ? Number.parseInt(pageSizeParam, 10)
    : DEFAULT_PAGE_SIZE;
  query.pageSize =
    Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100
      ? pageSize
      : DEFAULT_PAGE_SIZE;

  if (customerId) {
    query.customerId = customerId;
  }

  if (customerName) {
    query.customerName = customerName;
  }

  if (startDate) {
    query.startDate = startDate;
  }

  if (endDate) {
    query.endDate = endDate;
  }

  if (minBalance) {
    const parsed = Number.parseFloat(minBalance);
    if (Number.isFinite(parsed)) {
      query.minBalance = parsed;
    }
  }

  if (maxBalance) {
    const parsed = Number.parseFloat(maxBalance);
    if (Number.isFinite(parsed)) {
      query.maxBalance = parsed;
    }
  }

  if (
    balanceType &&
    ALLOWED_BALANCE_TYPES.includes(
      balanceType as (typeof ALLOWED_BALANCE_TYPES)[number]
    )
  ) {
    query.balanceType = balanceType as CustomerStatementQuery['balanceType'];
  } else {
    query.balanceType = 'all';
  }

  if (
    sortBy &&
    ALLOWED_SORT_FIELDS.includes(sortBy as CustomerStatementQuery['sortBy'])
  ) {
    query.sortBy = sortBy as CustomerStatementQuery['sortBy'];
  }

  if (
    sortOrder &&
    ALLOWED_SORT_ORDER.includes(
      sortOrder as CustomerStatementQuery['sortOrder']
    )
  ) {
    query.sortOrder = sortOrder as CustomerStatementQuery['sortOrder'];
  }

  return query;
}

export default async function CustomerStatementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = normaliseQuery(params);
  const initialData = await getCustomerStatements(query);

  return (
    <CustomerStatementsPageClient
      initialData={initialData}
      initialParams={query}
    />
  );
}
