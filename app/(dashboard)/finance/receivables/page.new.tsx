import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { ReceivablesClient } from '@/components/finance/receivables-client';
import { Button } from '@/components/ui/button';
import { paginationConfig } from '@/lib/env';
import { accountsReceivableQuerySchema } from '@/lib/validations/payment';

export const metadata: Metadata = {
  title: '应收货款管理 - 财务管理',
  description: '管理销售订单产生的应收账款，跟踪收款状态和逾期情况',
};

/**
 * 获取应收账款数据
 * 直接调用 API 端点，确保数据一致性
 */
async function fetchReceivables(searchParams: Record<string, string>) {
  // 构建查询参数
  const params = new URLSearchParams({
    page: searchParams.page || '1',
    pageSize: searchParams.limit || String(paginationConfig.defaultPageSize),
    ...(searchParams.search && { search: searchParams.search }),
    ...(searchParams.status && { paymentStatus: searchParams.status }),
    ...(searchParams.customerId && { customerId: searchParams.customerId }),
    ...(searchParams.startDate && { startDate: searchParams.startDate }),
    ...(searchParams.endDate && { endDate: searchParams.endDate }),
    ...(searchParams.sortBy && { sortBy: searchParams.sortBy }),
    ...(searchParams.sortOrder && { sortOrder: searchParams.sortOrder }),
  });

  // 获取请求头（包含认证信息）
  const headersList = await headers();
  const cookie = headersList.get('cookie');

  // 内部 API 调用（避免网络开销）
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/finance/receivables?${params}`,
    {
      headers: {
        ...(cookie && { cookie }),
      },
      cache: 'no-store', // 确保实时数据
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch receivables');
  }

  const data = await response.json();
  return data;
}

/**
 * 应收货款管理页面
 * 服务器组件，预取数据并传递给客户端
 */
export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  // 验证查询参数
  const validatedParams = accountsReceivableQuerySchema.safeParse({
    page: parseInt(searchParams.page || '1'),
    pageSize: parseInt(
      searchParams.limit || String(paginationConfig.defaultPageSize)
    ),
    search: searchParams.search,
    paymentStatus: searchParams.status,
    customerId: searchParams.customerId,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    sortBy: searchParams.sortBy || 'orderDate',
    sortOrder: searchParams.sortOrder || 'desc',
  });

  // 如果参数无效，使用默认值
  const queryParams = validatedParams.success
    ? validatedParams.data
    : {
        page: 1,
        pageSize: paginationConfig.defaultPageSize,
        sortBy: 'orderDate',
        sortOrder: 'desc' as const,
      };

  // 创建 QueryClient 并预取数据
  const queryClient = new QueryClient();

  // 预取应收账款数据
  await queryClient.prefetchQuery({
    queryKey: ['receivables', queryParams],
    queryFn: () => fetchReceivables(searchParams),
  });

  // 预取客户列表（用于筛选）
  await queryClient.prefetchQuery({
    queryKey: ['customers', 'list'],
    queryFn: async () => {
      const headersList = await headers();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/customers?pageSize=100`,
        {
          headers: {
            cookie: headersList.get('cookie') || '',
          },
        }
      );
      return response.json();
    },
  });

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">应收货款管理</h1>
          <p className="text-muted-foreground mt-1">
            跟踪销售订单的收款状态，管理应收账款和逾期款项
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出报表
          </Button>
          <Button asChild size="sm">
            <Link href="/finance/payments/create">
              <Plus className="mr-2 h-4 w-4" />
              新增收款
            </Link>
          </Button>
        </div>
      </div>

      {/* 使用 HydrationBoundary 传递预取的数据 */}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReceivablesClient
          initialData={{
            receivables: [],
            summary: {
              totalReceivable: 0,
              receivableCount: 0,
              totalOverdue: 0,
              overdueCount: 0,
              collectionRate: 0,
              averageAccountPeriod: 0,
            },
            pagination: {
              page: 1,
              limit: paginationConfig.defaultPageSize,
              total: 0,
              totalPages: 0,
            },
          }}
        />
      </HydrationBoundary>
    </div>
  );
}
