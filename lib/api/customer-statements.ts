import { useQuery, type QueryKey } from '@tanstack/react-query';

import {
  ExportService,
  type ExcelExportOptions,
} from '@/lib/services/export-service';
import type {
  CustomerStatementDetail,
  CustomerStatementListResponse,
  CustomerStatementQuery,
  CustomerStatementStatistics,
} from '@/lib/types/customer-statement';

const CUSTOMER_STATEMENTS_API_BASE = '/api/finance/customer-statements';
const CUSTOMER_STATEMENTS_STATISTICS_API = `${CUSTOMER_STATEMENTS_API_BASE}/statistics`;

function buildQueryParams(query: CustomerStatementQuery = {}): string {
  const params = new URLSearchParams();

  if (query.page) {
    params.set('page', String(query.page));
  }

  if (query.pageSize) {
    params.set('pageSize', String(query.pageSize));
  }

  if (query.customerId) {
    params.set('customerId', query.customerId);
  }

  if (query.customerName) {
    params.set('customerName', query.customerName);
  }

  if (query.startDate) {
    params.set('startDate', query.startDate);
  }

  if (query.endDate) {
    params.set('endDate', query.endDate);
  }

  if (query.minBalance !== undefined) {
    params.set('minBalance', String(query.minBalance));
  }

  if (query.maxBalance !== undefined) {
    params.set('maxBalance', String(query.maxBalance));
  }

  if (query.balanceType && query.balanceType !== 'all') {
    params.set('balanceType', query.balanceType);
  }

  if (query.sortBy) {
    params.set('sortBy', query.sortBy);
  }

  if (query.sortOrder) {
    params.set('sortOrder', query.sortOrder);
  }

  return params.toString();
}

async function handleResponse<T>(
  response: Response,
  fallbackError: string
): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackError}: ${response.statusText}`);
  }

  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(payload?.error || fallbackError);
  }

  return payload.data as T;
}

export const customerStatementQueryKeys = {
  all: ['customer-statements'] as const satisfies QueryKey,
  lists: () =>
    [...customerStatementQueryKeys.all, 'list'] as const satisfies QueryKey,
  list: (query: CustomerStatementQuery) =>
    [...customerStatementQueryKeys.lists(), query] as const satisfies QueryKey,
  details: () =>
    [...customerStatementQueryKeys.all, 'detail'] as const satisfies QueryKey,
  detail: (customerId: string, startDate: string, endDate: string) =>
    [
      ...customerStatementQueryKeys.details(),
      customerId,
      startDate,
      endDate,
    ] as const satisfies QueryKey,
  statistics: () =>
    [
      ...customerStatementQueryKeys.all,
      'statistics',
    ] as const satisfies QueryKey,
};

export const customerStatementApi = {
  async getStatements(
    query: CustomerStatementQuery = {}
  ): Promise<CustomerStatementListResponse['data']> {
    const queryString = buildQueryParams(query);
    const response = await fetch(
      queryString
        ? `${CUSTOMER_STATEMENTS_API_BASE}?${queryString}`
        : CUSTOMER_STATEMENTS_API_BASE,
      {
        credentials: 'include',
      }
    );

    return handleResponse<CustomerStatementListResponse['data']>(
      response,
      '获取客户对账单失败'
    );
  },

  async getStatementDetail(
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<CustomerStatementDetail> {
    const params = new URLSearchParams();
    if (startDate) {
      params.set('startDate', startDate);
    }
    if (endDate) {
      params.set('endDate', endDate);
    }

    const response = await fetch(
      `${CUSTOMER_STATEMENTS_API_BASE}/${customerId}?${params.toString()}`,
      {
        credentials: 'include',
      }
    );

    return handleResponse<CustomerStatementDetail>(
      response,
      '获取客户对账单详情失败'
    );
  },

  async getStatistics(): Promise<CustomerStatementStatistics> {
    const response = await fetch(CUSTOMER_STATEMENTS_STATISTICS_API, {
      credentials: 'include',
    });

    return handleResponse<CustomerStatementStatistics>(
      response,
      '获取客户对账单统计失败'
    );
  },

  async exportStatementToExcel(
    detail: CustomerStatementDetail,
    options?: ExcelExportOptions
  ) {
    const { customerName, periodStart, periodEnd, summary, transactions } =
      detail;

    const filename = options?.filename
      ? options.filename
      : `客户对账单-${customerName}-${periodStart}_至_${periodEnd}`;

    // 组织导出数据：先摘要，再明细
    const summaryRow = {
      客户名称: customerName,
      对账期间开始: periodStart,
      对账期间结束: periodEnd,
      期初余额: summary.receivables.receivableBalance
        ? detail.openingBalance
        : detail.openingBalance,
      销售金额: summary.receivables.salesAmount,
      退货金额: summary.receivables.salesReturnAmount,
      收款金额: summary.receivables.paymentReceived,
      预收款: summary.receivables.prepaymentReceived,
      已退款金额: summary.receivables.refundPaid ?? 0,
      应收余额: summary.receivables.receivableBalance,
    };

    const detailRows = transactions.map(tx => ({
      日期: tx.transactionDate,
      类型: tx.transactionType,
      单据号: tx.referenceNumber,
      描述: tx.description,
      增加应收: tx.debitAmount,
      减少应收: tx.creditAmount,
      余额: tx.balance,
      状态: tx.status,
    }));

    const data = [
      summaryRow,
      { ...summaryRow, 客户名称: '——明细如下——' },
      ...detailRows,
    ];

    ExportService.exportToExcel(data, {
      ...options,
      filename,
      sheetName: '客户对账单',
    });
  },
};

export const useCustomerStatements = (
  query: CustomerStatementQuery = {},
  options?: { enabled?: boolean }
) =>
  useQuery<
    CustomerStatementListResponse['data'],
    Error,
    CustomerStatementListResponse['data']
  >({
    queryKey: customerStatementQueryKeys.list(query),
    queryFn: () => customerStatementApi.getStatements(query),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });

export const useCustomerStatementDetail = (
  customerId: string,
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean }
) =>
  useQuery<CustomerStatementDetail, Error, CustomerStatementDetail>({
    queryKey: customerStatementQueryKeys.detail(customerId, startDate, endDate),
    queryFn: () =>
      customerStatementApi.getStatementDetail(customerId, startDate, endDate),
    enabled: (options?.enabled ?? true) && Boolean(customerId),
    staleTime: 5 * 60 * 1000,
  });

export const useCustomerStatementStatistics = (
  _query?: CustomerStatementQuery,
  options?: { enabled?: boolean }
) =>
  useQuery<CustomerStatementStatistics, Error, CustomerStatementStatistics>({
    queryKey: customerStatementQueryKeys.statistics(),
    queryFn: () => customerStatementApi.getStatistics(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
