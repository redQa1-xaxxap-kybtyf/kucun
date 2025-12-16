import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { parseOffsetPagination } from '@/lib/api/pagination';
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

function parseQuery(
  searchParams: URLSearchParams,
  pagination: { page: number; pageSize: number }
): CustomerStatementQuery {
  const query: CustomerStatementQuery = {};

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

  query.page = pagination.page;
  query.pageSize = pagination.pageSize;

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
      const searchParams = request.nextUrl.searchParams;
      const normalized = new URLSearchParams(searchParams);
      if (!normalized.get('pageSize') && normalized.get('limit')) {
        normalized.set('pageSize', normalized.get('limit') as string);
      }

      let page: number;
      let pageSize: number;
      try {
        const parsed = parseOffsetPagination(normalized, {
          defaultPage: DEFAULT_PAGE,
          defaultLimit: DEFAULT_PAGE_SIZE,
          maxLimit: 100,
          strict: true,
          pageFieldLabel: '页码',
          limitFieldLabel: '每页数量',
          limitParamName: 'pageSize',
        });
        page = parsed.page;
        pageSize = parsed.limit;
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '分页参数格式不正确',
          400
        );
      }

      const query = parseQuery(normalized, { page, pageSize });

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
