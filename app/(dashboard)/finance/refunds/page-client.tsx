'use client';

import { Download, Plus, TrendingDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { FinanceListSkeleton } from '@/components/ui/skeleton-compositions';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import { useRefundsQuery } from '@/hooks/use-refunds-query';
import type {
  RefundListData,
  RefundListQueryParams,
  RefundStatus,
} from '@/lib/types/refund';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

type RefundsQueryParams = RefundListQueryParams;

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

const RefundsClient = dynamic(
  () =>
    import('@/components/finance/refunds-client').then(
      mod => mod.RefundsClient
    ),
  {
    ssr: false,
    loading: () => <FinanceListSkeleton />,
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

  // 本地状态管理 - 用于即时更新UI
  const [committedSearch, setCommittedSearch] = React.useState(
    initialParams.search || ''
  );
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
  const [page, setPage] = React.useState(initialParams.page);
  const [limit, setLimit] = React.useState(initialParams.limit);
  const [startDate, setStartDate] = React.useState<string | undefined>(
    initialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    initialParams.endDate
  );

  React.useEffect(() => {
    setCommittedSearch(initialParams.search || '');
    setStatus(initialParams.status);
    setIncludeTest(!!initialParams.includeTest);
    setIncludeVoided(!!initialParams.includeVoided);
    setSortBy(initialParams.sortBy || 'refundDate');
    setSortOrder(initialParams.sortOrder || 'desc');
    setPage(initialParams.page);
    setLimit(initialParams.limit);
    setStartDate(initialParams.startDate);
    setEndDate(initialParams.endDate);
  }, [initialParams]);

  const { data, isLoading, error } = useRefundsQuery({
    params: {
      ...initialParams,
      search: normalizeSearch(committedSearch),
      status,
      includeTest: includeTest || undefined,
      includeVoided: includeVoided || undefined,
      sortBy,
      sortOrder,
      page,
      limit,
      startDate,
      endDate,
    },
  });

  const currentParams = React.useMemo(
    () => ({
      ...initialParams,
      search: normalizeSearch(committedSearch),
      status,
      includeTest: includeTest || undefined,
      includeVoided: includeVoided || undefined,
      sortBy,
      sortOrder,
      page,
      limit,
      startDate,
      endDate,
    }),
    [
      committedSearch,
      initialParams,
      status,
      includeTest,
      includeVoided,
      sortBy,
      sortOrder,
      page,
      limit,
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

  const syncUrl = React.useCallback(
    (filters: RefundsQueryParams) => {
      const params = new URLSearchParams();
      const normalizedSearch = normalizeSearch(filters.search);

      if (normalizedSearch) {
        params.set('search', normalizedSearch);
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

      const queryString = params.toString();
      router.replace(
        queryString ? `/finance/refunds?${queryString}` : '/finance/refunds',
        { scroll: false }
      );
    },
    [router]
  );

  const buildFilters = React.useCallback(
    (overrides: Partial<RefundsQueryParams> = {}): RefundsQueryParams => ({
      ...initialParams,
      search: overrides.search ?? normalizeSearch(committedSearch),
      status: overrides.status ?? status,
      includeTest: overrides.includeTest ?? (includeTest || undefined),
      includeVoided: overrides.includeVoided ?? (includeVoided || undefined),
      sortBy: overrides.sortBy ?? sortBy,
      sortOrder: overrides.sortOrder ?? sortOrder,
      startDate: overrides.startDate ?? startDate,
      endDate: overrides.endDate ?? endDate,
      page: overrides.page ?? page,
      limit: overrides.limit ?? limit,
    }),
    [
      committedSearch,
      endDate,
      includeTest,
      includeVoided,
      initialParams,
      limit,
      page,
      sortBy,
      sortOrder,
      startDate,
      status,
    ]
  );

  const {
    searchInput,
    isSearching: isSearchPending,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
  } = useListSearchController({
    committedValue: committedSearch,
    onCommit: search => {
      const nextSearch = search ?? '';
      setCommittedSearch(nextSearch);
      setPage(1);
      syncUrl(
        buildFilters({
          search,
          page: 1,
        })
      );
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setCommittedSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const nextSearch = syncPendingSearch();
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

      setPage(1);
      syncUrl(
        buildFilters({
          search: nextSearch,
          status: nextStatus,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
          includeTest: nextIncludeTest || undefined,
          includeVoided: nextIncludeVoided || undefined,
          page: 1,
        })
      );
    },
    [
      buildFilters,
      includeTest,
      includeVoided,
      sortBy,
      sortOrder,
      status,
      syncPendingSearch,
      syncUrl,
    ]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      const nextSearch = syncPendingSearch();
      setPage(page);
      setLimit(pagination.limit);
      syncUrl(
        buildFilters({
          search: nextSearch,
          page,
          limit: pagination.limit,
        })
      );
    },
    [buildFilters, pagination.limit, syncPendingSearch, syncUrl]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      const nextSearch = syncPendingSearch();
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      setPage(1);

      syncUrl(
        buildFilters({
          search: nextSearch,
          startDate: range.startDate,
          endDate: range.endDate,
          page: 1,
          limit: pagination.limit,
        })
      );
    },
    [buildFilters, pagination.limit, syncPendingSearch, syncUrl]
  );

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');
    setStatus(undefined);
    setIncludeTest(false);
    setIncludeVoided(false);
    setSortBy('refundDate');
    setSortOrder('desc');
    setPage(1);
    setStartDate(undefined);
    setEndDate(undefined);
    router.replace('/finance/refunds', { scroll: false });
  }, [cancelPendingCommit, router, setSearchInput]);

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
                className="h-11 shadow-sm"
              >
                <Link href="/finance/refunds/export">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="h-11 shadow-sm"
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
          searchValue={searchInput}
          isSearching={isSearchPending || isLoading}
          errorMessage={loadError}
          onSearch={handleSearchChange}
          onFilter={handleFilter}
          onDateRangeChange={handleDateRangeChange}
          onPageChange={handlePageChange}
          onClearFilters={handleClearFilters}
        />
      </div>
    </div>
  );
}
