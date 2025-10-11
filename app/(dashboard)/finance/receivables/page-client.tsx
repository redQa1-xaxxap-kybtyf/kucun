'use client';

import { Download, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { ReceivablesClient } from '@/components/finance/receivables-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type {
  PaymentStatus,
  ReceivablesResult,
} from '@/lib/services/receivables-service';

interface ReceivablesPageQueryParams {
  page: number;
  limit: number;
  search: string;
  status?: PaymentStatus;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface ReceivablesPageClientProps {
  initialData: ReceivablesResult;
  initialParams: ReceivablesPageQueryParams;
}

/**
 * 应收款页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function ReceivablesPageClient({
  initialData,
  initialParams,
}: ReceivablesPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState(initialParams.status);
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'orderDate'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: ReceivablesPageQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (filters.sortBy) {
          params.set('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set('sortOrder', filters.sortOrder);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/finance/receivables?${params.toString()}`);
      });
    },
    300
  );

  // 搜索处理 - 立即更新本地状态，防抖更新URL
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        ...initialParams,
        search: value,
        status,
        sortBy,
        sortOrder,
        page: 1,
      });
    },
    [debouncedUpdateURL, initialParams, status, sortBy, sortOrder]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      let nextStatus = status;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;

      if (key === 'status') {
        nextStatus = value ? (value as PaymentStatus) : undefined;
        setStatus(nextStatus);
      } else if (key === 'sortBy') {
        nextSortBy = value || 'orderDate';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = value === 'asc' ? 'asc' : 'desc';
        setSortOrder(nextSortOrder);
      }

      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (nextStatus) {
          params.set('status', nextStatus);
        }
        if (nextSortBy) {
          params.set('sortBy', nextSortBy);
        }
        if (nextSortOrder) {
          params.set('sortOrder', nextSortOrder);
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.push(`/finance/receivables?${params.toString()}`);
      });
    },
    [router, search, initialParams.limit, sortBy, sortOrder, status]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (status) {
          params.set('status', status);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        if (page > 1) {
          params.set('page', page.toString());
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.push(`/finance/receivables?${params.toString()}`);
      });
    },
    [router, search, status, sortBy, sortOrder, initialParams.limit]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    应收货款管理
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    管理销售订单产生的应收账款，跟踪收款状态和逾期情况
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/receivables/export">
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Link>
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/sales-orders/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建销售订单
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 客户端交互组件 */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          }
        >
          <ReceivablesClient
            initialData={initialData}
            initialParams={initialParams}
            onSearch={handleSearch}
            onFilter={handleFilter}
            onPageChange={handlePageChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
