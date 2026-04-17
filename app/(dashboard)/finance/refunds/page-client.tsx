'use client';

import { Download, Plus, TrendingDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { useRefundsQuery } from '@/hooks/use-refunds-query';
import type {
  RefundListData,
  RefundListQueryParams,
  RefundStatus,
} from '@/lib/types/refund';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

type RefundsQueryParams = RefundListQueryParams;

const RefundsClient = dynamic(
  () => import('@/components/finance/refunds-client').then(mod => mod.RefundsClient),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        列表加载中...
      </div>
    ),
  }
);

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
  const [includeTest, setIncludeTest] = React.useState<boolean>(
    !!initialParams.includeTest
  );
  const [includeVoided, setIncludeVoided] = React.useState<boolean>(
    !!initialParams.includeVoided
  );
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
  const latestSearchRef = React.useRef(initialParams.search || '');

  React.useEffect(() => {
    latestSearchRef.current = initialParams.search || '';
    setSearch(initialParams.search || '');
    setStatus(initialParams.status);
    setIncludeTest(!!initialParams.includeTest);
    setIncludeVoided(!!initialParams.includeVoided);
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
      includeTest: includeTest || undefined,
      includeVoided: includeVoided || undefined,
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
      includeTest: includeTest || undefined,
      includeVoided: includeVoided || undefined,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    }),
    [
      initialParams,
      search,
      status,
      includeTest,
      includeVoided,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
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
  const loadError = error
    ? getFriendlyErrorMessage(error, '退款暂时无法加载，请稍后重试')
    : null;

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
        if (filters.includeTest) {
          params.set('includeTest', 'true');
        }
        if (filters.includeVoided) {
          params.set('includeVoided', 'true');
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

  React.useEffect(
    () => () => {
      debouncedUpdateURL.cancel();
    },
    [debouncedUpdateURL]
  );

  // 搜索处理 - 立即更新本地状态，防抖更新URL
  const handleSearch = React.useCallback(
    (value: string) => {
      latestSearchRef.current = value;
      setSearch(value);
      debouncedUpdateURL(value, {
        ...initialParams,
        search: value,
        status,
        includeTest: includeTest || undefined,
        includeVoided: includeVoided || undefined,
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
      includeTest,
      includeVoided,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      debouncedUpdateURL.cancel();
      const currentSearch = latestSearchRef.current;
      let nextStatus = status;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;
      let nextIncludeTest = includeTest;
      let nextIncludeVoided = includeVoided;

      if (key === 'status') {
        nextStatus = value as RefundStatus | undefined;
        setStatus(nextStatus);
      } else if (key === 'sortBy') {
        nextSortBy = (value as RefundListQueryParams['sortBy']) || 'refundDate';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = (value as 'asc' | 'desc') || 'desc';
        setSortOrder(nextSortOrder);
      } else if (key === 'includeTest') {
        nextIncludeTest = value === 'true';
        setIncludeTest(nextIncludeTest);
      } else if (key === 'includeVoided') {
        nextIncludeVoided = value === 'true';
        setIncludeVoided(nextIncludeVoided);
      }

      startTransition(() => {
        const params = new URLSearchParams();
        if (currentSearch) {
          params.set('search', currentSearch);
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
        if (startDate) {
          params.set('startDate', startDate);
        }
        if (endDate) {
          params.set('endDate', endDate);
        }
        if (nextIncludeTest) {
          params.set('includeTest', 'true');
        }
        if (nextIncludeVoided) {
          params.set('includeVoided', 'true');
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.push(`/finance/refunds?${params.toString()}`);
      });
    },
    [
      debouncedUpdateURL,
      router,
      status,
      includeTest,
      includeVoided,
      sortBy,
      sortOrder,
      initialParams.limit,
      startDate,
      endDate,
    ]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      debouncedUpdateURL.cancel();
      const currentSearch = latestSearchRef.current;
      startTransition(() => {
        const params = new URLSearchParams();
        if (currentSearch) {
          params.set('search', currentSearch);
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
        if (includeTest) {
          params.set('includeTest', 'true');
        }
        if (includeVoided) {
          params.set('includeVoided', 'true');
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
      debouncedUpdateURL,
      router,
      status,
      includeTest,
      includeVoided,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      pagination.limit,
    ]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      debouncedUpdateURL.cancel();
      const currentSearch = latestSearchRef.current;
      setStartDate(range.startDate);
      setEndDate(range.endDate);

      startTransition(() => {
        const params = new URLSearchParams();
        if (currentSearch) {
          params.set('search', currentSearch);
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
        if (includeTest) {
          params.set('includeTest', 'true');
        }
        if (includeVoided) {
          params.set('includeVoided', 'true');
        }
        if (pagination.limit) {
          params.set('limit', pagination.limit.toString());
        }

        router.push(`/finance/refunds?${params.toString()}`);
      });
    },
    [
      debouncedUpdateURL,
      router,
      pagination.limit,
      status,
      includeTest,
      includeVoided,
      sortBy,
      sortOrder,
    ]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="退款处理"
          description="跟踪退货产生的退款，优先处理待处理和待退款款项。"
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
