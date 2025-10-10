import type { Metadata } from 'next';

import { getStatementsList } from '@/lib/services/finance-statistics';

import { StatementsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '往来账单 - 财务管理',
  description: '管理客户和供应商的综合账务往来',
};

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 服务器端获取往来账单数据
 * 修复：使用与API相同的服务函数，确保数据一致性
 */
async function getStatementsData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const queryParams = {
    page: parseInt(searchParams.page || '1', 10),
    limit: parseInt(searchParams.limit || '20', 10),
    search: searchParams.search || '',
    type: (searchParams.type as 'customer' | 'supplier') || 'customer',
    sortBy: searchParams.sortBy || 'totalAmount',
    sortOrder: (searchParams.sortOrder as 'asc' | 'desc') || 'desc',
  };

  // 使用与API相同的服务函数
  const result = await getStatementsList(queryParams);

  return {
    statements: result.data,
    statistics: result.summary,
    pagination: result.pagination,
  };
}

/**
 * 往来账单页面 - 服务器组件
 */
export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const initialData = await getStatementsData(params);

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search: params.search,
    type: params.type || 'customer',
    sortBy: params.sortBy || 'totalAmount',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return (
    <StatementsPageClient
      initialData={initialData}
      initialParams={queryParams}
    />
  );
}
