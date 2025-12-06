'use client';

import { Download, Plus, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { RefundsClient } from '@/components/finance/refunds-client';
import { Button } from '@/components/ui/button';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { useRefundsQuery } from '@/hooks/use-refunds-query';
import type {
  RefundListData,
  RefundListQueryParams,
  RefundStatus,
} from '@/lib/types/refund';

type RefundsQueryParams = RefundListQueryParams;

interface RefundsPageClientProps {
  initialParams: RefundListQueryParams;
}

/**
 * 退款记录页面客户端组件
 * 负责用户交互和状态管理
 */
export function RefundsPageClient({ initialParams }: RefundsPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState(initialParams.status);
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'refundDate'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState<string | undefined>(
    initialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    initialParams.endDate
  );

  React.useEffect(() => {
    setSearch(initialParams.search || '');
    setStatus(initialParams.status);
    setSortBy(initialParams.sortBy || 'refundDate');
    setSortOrder(initialParams.sortOrder || 'desc');
    setStartDate(initialParams.startDate);
    setEndDate(initialParams.endDate);
  }, [initialParams]);

  const { data, isLoading, error } = useRefundsQuery({
    params: {
      ...initialParams,
      search,
      status,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    },
  });

  const currentParams = React.useMemo(
    () => ({
      ...initialParams,
      search,
      status,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    }),
    [initialParams, search, status, sortBy, sortOrder, startDate, endDate]
  );

  const resolvedData = React.useMemo<RefundListData>(
    () => ({
      refunds: data?.refunds ?? [],
      statistics: data?.statistics ?? {
        totalRefundable: 0,
        totalProcessed: 0,
        totalRemaining: 0,
        pendingCount: 0,
        processingCount: 0,
        completedCount: 0,
      },
      pagination: data?.pagination ?? {
        page: currentParams.page,
        limit: currentParams.limit,
        total: 0,
        totalPages: 1,
      },
    }),
    [data, currentParams]
  );

  const pagination = resolvedData.pagination;
  const loadError =
    error instanceof Error ? error.message : error ? String(error) : null;

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: RefundsQueryParams) => {
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
        if (filters.startDate) {
          params.set('startDate', filters.startDate);
        }
        if (filters.endDate) {
          params.set('endDate', filters.endDate);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/finance/refunds?${params.toString()}`);
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
        startDate,
        endDate,
        page: 1,
      });
    },
    [
      debouncedUpdateURL,
      initialParams,
      status,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const newFilters = { ...initialParams, [key]: value, page: 1 };

      if (key === 'status') {
        setStatus(value as RefundStatus | undefined);
      } else if (key === 'sortBy') {
        const nextSortBy =
          (value as RefundListQueryParams['sortBy']) || 'refundDate';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        setSortOrder((value as 'asc' | 'desc') || 'desc');
      }

      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (newFilters.status) {
          params.set('status', newFilters.status);
        }
        if (newFilters.sortBy) {
          params.set('sortBy', newFilters.sortBy);
        }
        if (newFilters.sortOrder) {
          params.set('sortOrder', newFilters.sortOrder);
        }
        if (startDate) {
          params.set('startDate', startDate);
        }
        if (endDate) {
          params.set('endDate', endDate);
        }
        if (newFilters.limit) {
          params.set('limit', newFilters.limit.toString());
        }

        router.push(`/finance/refunds?${params.toString()}`);
      });
    },
    [router, search, initialParams, startDate, endDate]
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
        if (startDate) {
          params.set('startDate', startDate);
        }
        if (endDate) {
          params.set('endDate', endDate);
        }
        if (page > 1) {
          params.set('page', page.toString());
        }
        if (pagination.limit) {
          params.set('limit', pagination.limit.toString());
        }

        router.push(`/finance/refunds?${params.toString()}`);
      });
    },
    [
      router,
      search,
      status,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      pagination.limit,
    ]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      setStartDate(range.startDate);
      setEndDate(range.endDate);

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
        if (range.startDate) {
          params.set('startDate', range.startDate);
        }
        if (range.endDate) {
          params.set('endDate', range.endDate);
        }
        if (pagination.limit) {
          params.set('limit', pagination.limit.toString());
        }

        router.push(`/finance/refunds?${params.toString()}`);
      });
    },
    [router, pagination.limit, search, sortBy, sortOrder, status]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="应退货款管理"
          description="管理退货订单产生的应退账款，跟踪退款处理状态"
          icon={<TrendingDown className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-warning))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/finance/refunds/export">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/return-orders/create">
                  <Plus className="mr-2 h-4 w-4" />
                  新建退货订单
                </Link>
              </Button>
            </>
          }
        />

        {/* 客户端交互组件 */}
        <RefundsClient
          data={resolvedData}
          initialParams={currentParams}
          isLoading={isLoading}
          errorMessage={loadError}
          onSearch={handleSearch}
          onFilter={handleFilter}
          onDateRangeChange={handleDateRangeChange}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
