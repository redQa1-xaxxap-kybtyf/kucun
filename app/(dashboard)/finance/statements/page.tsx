import type { Metadata } from 'next';

import {
  getStatementsList,
  type StatementQueryParams,
} from '@/lib/services/finance-statistics';

import { StatementsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '往来账单 - 财务管理',
  description: '统一管理业务伙伴往来账本',
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
  const rawType = searchParams.type;
  const normalizedType =
    rawType && ['customer', 'supplier', 'partner'].includes(rawType)
      ? (rawType as 'customer' | 'supplier' | 'partner')
      : undefined;

  const queryParams = {
    page: parseInt(searchParams.page || '1', 10),
    limit: parseInt(searchParams.limit || '20', 10),
    search: searchParams.search?.trim() || undefined,
    type: (normalizedType ?? 'all') as
      | 'customer'
      | 'supplier'
      | 'partner'
      | 'all',
    sortBy: (searchParams.sortBy ||
      'totalAmount') as StatementQueryParams['sortBy'],
    sortOrder: (searchParams.sortOrder as 'asc' | 'desc') || 'desc',
  };

  // 使用与API相同的服务函数
  const result = await getStatementsList(queryParams);

  return {
    statements: result.data,
    summary: result.summary,
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

  const type =
    params.type && ['customer', 'supplier', 'partner'].includes(params.type)
      ? params.type
      : 'all';

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search: params.search?.trim() || undefined,
    type,
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
