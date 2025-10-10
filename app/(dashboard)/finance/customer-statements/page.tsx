import type { Metadata } from 'next';

import { logger } from '@/lib/logger';
import { getCustomerStatements } from '@/lib/services/customer-statement-service';

import { CustomerStatementsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '客户对账单 - 财务管理',
  description: '管理与客户之间的完整财务往来记录',
};

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 服务器端获取客户对账单数据
 */
async function getStatementsData(searchParams: {
  page?: string;
  pageSize?: string;
  customerName?: string;
  balanceType?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const pageSize = parseInt(searchParams.pageSize || '20', 10);
  const customerName = searchParams.customerName || undefined;
  const balanceType = (searchParams.balanceType as
    | 'receivable'
    | 'payable'
    | 'all') || 'all';
  const sortBy = (searchParams.sortBy as
    | 'customerName'
    | 'netBalance'
    | 'receivableBalance'
    | 'payableBalance'
    | 'lastTransactionDate') || 'customerName';
  const sortOrder = (searchParams.sortOrder as 'asc' | 'desc') || 'desc';

  try {
    const result = await getCustomerStatements({
      page,
      pageSize,
      customerName,
      balanceType,
      sortBy,
      sortOrder,
    });

    return result;
  } catch (error) {
    logger.error(
      'finance-customer-statements',
      '获取客户对账单数据失败',
      error,
      {
        page,
        pageSize,
        customerName,
        balanceType,
        sortBy,
        sortOrder,
      }
    );
    return {
      statements: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

/**
 * 客户对账单页面 - 服务器组件
 */
export default async function CustomerStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    customerName?: string;
    balanceType?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const initialData = await getStatementsData(params);

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    pageSize: parseInt(params.pageSize || '20', 10),
    customerName: params.customerName,
    balanceType: (params.balanceType as 'receivable' | 'payable' | 'all') || 'all',
    sortBy: (params.sortBy as
      | 'customerName'
      | 'netBalance'
      | 'receivableBalance'
      | 'payableBalance'
      | 'lastTransactionDate') || 'customerName',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return (
    <CustomerStatementsPageClient
      initialData={initialData}
      initialParams={queryParams}
    />
  );
}

