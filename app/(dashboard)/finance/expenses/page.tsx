import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { queryKeys } from '@/lib/queryKeys';
import { getExpenseRecords } from '@/lib/services/expense-service';
import type { ExpenseQueryParams } from '@/lib/types/expense';

import { ExpensesPageClient } from './page-client';

export const metadata: Metadata = {
  title: '费用管理 - 财务管理',
  description: '查看各类费用，跟踪费用支出情况',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 费用记录列表页面（Server Component）
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    expenseType?: string;
    startDate?: string;
    endDate?: string;
    relatedType?: string;
    sortBy?: string;
    sortOrder?: string;
    includeTest?: string;
    includeVoided?: string;
  }>;
}) {
  // 获取用户会话
  const session = await getServerSession(authOptions);

  // 检查权限
  if (!session?.user || !can(session.user, 'finance:view')) {
    redirect('/dashboard');
  }

  const hasManagePermission = can(session.user, 'finance:manage');

  // 解析查询参数
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '20', 10);

  const sortBy: NonNullable<ExpenseQueryParams['sortBy']> =
    params.sortBy === 'expenseDate' ||
    params.sortBy === 'expenseAmount' ||
    params.sortBy === 'createdAt'
      ? params.sortBy
      : 'expenseDate';

  const sortOrder: NonNullable<ExpenseQueryParams['sortOrder']> =
    params.sortOrder === 'asc' || params.sortOrder === 'desc'
      ? params.sortOrder
      : 'desc';

  const initialParams = {
    page,
    pageSize,
    expenseType: params.expenseType,
    startDate: params.startDate,
    endDate: params.endDate,
    relatedType: params.relatedType,
    sortBy,
    sortOrder,
    includeTest: params.includeTest === 'true' ? true : undefined,
    includeVoided: params.includeVoided === 'true' ? true : undefined,
  };

  const expenseQuery: ExpenseQueryParams = {
    page,
    pageSize,
    expenseType: params.expenseType as ExpenseQueryParams['expenseType'],
    startDate: params.startDate,
    endDate: params.endDate,
    relatedType: params.relatedType as ExpenseQueryParams['relatedType'],
    sortBy,
    sortOrder,
    includeTest: params.includeTest === 'true' ? true : undefined,
    includeVoided: params.includeVoided === 'true' ? true : undefined,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  const initialListData = await getExpenseRecords(expenseQuery);

  queryClient.setQueryData(
    queryKeys.finance.expensesList(expenseQuery),
    initialListData
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExpensesPageClient
        initialParams={initialParams}
        hasManagePermission={hasManagePermission}
      />
    </HydrationBoundary>
  );
}
