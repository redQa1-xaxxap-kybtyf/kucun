import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { getCustomerStatements } from '@/lib/services/customer-statement-service';
import type { CustomerStatementQuery } from '@/lib/types/customer-statement';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

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

const ALLOWED_BALANCE_TYPES: Array<
  NonNullable<CustomerStatementQuery['balanceType']>
> = ['receivable', 'payable', 'all'];

function parseQuery(searchParams: URLSearchParams): CustomerStatementQuery {
  const query: CustomerStatementQuery = {};

  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('pageSize') ?? searchParams.get('limit');
  const customerId = searchParams.get('customerId');
  const customerName =
    searchParams.get('customerName') ?? searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const minBalance = searchParams.get('minBalance');
  const maxBalance = searchParams.get('maxBalance');
  const balanceType = searchParams.get('balanceType');
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder');

  const page = pageParam ? Number.parseInt(pageParam, 10) : DEFAULT_PAGE;
  if (Number.isFinite(page) && page > 0) {
    query.page = page;
  } else {
    query.page = DEFAULT_PAGE;
  }

  const pageSize = limitParam
    ? Number.parseInt(limitParam, 10)
    : DEFAULT_PAGE_SIZE;
  if (Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100) {
    query.pageSize = pageSize;
  } else {
    query.pageSize = DEFAULT_PAGE_SIZE;
  }

  if (customerId) {
    query.customerId = customerId;
  }

  if (customerName) {
    query.customerName = customerName.trim();
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

const getCustomerStatementsHandler = withAuth(
  async (request: NextRequest) => {
    try {
      const searchParams = new URL(request.url).searchParams;
      const query = parseQuery(searchParams);

      const result = await getCustomerStatements(query);

      return successResponse(result);
    } catch (error) {
      logger.error(
        'finance-customer-statements',
        '获取客户对账单失败',
        error instanceof Error ? error : undefined
      );
      const message =
        error instanceof Error ? error.message : '获取客户对账单失败';
      return errorResponse(message, 500);
    }
  },
  { permissions: ['finance:view'] }
);

export const GET = withRateLimit(RateLimitType.FINANCE_READ)(
  getCustomerStatementsHandler
);
