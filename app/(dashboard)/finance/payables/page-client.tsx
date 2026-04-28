'use client';

import { CreditCard, Download, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { FinanceListSkeleton } from '@/components/ui/skeleton-compositions';
import { useFinanceExport } from '@/hooks/use-finance-export';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  PAYABLE_SORT_OPTIONS,
  type PayableSourceType,
  type PayableStatus,
} from '@/lib/types/payable';

type PayableSortField =
  | 'createdAt'
  | 'payableAmount'
  | 'dueDate'
  | 'remainingAmount';

const PayablesClient = dynamic(
  () =>
    import('@/components/finance/payables-client').then(
      mod => mod.PayablesClient
    ),
  {
    ssr: false,
    loading: () => <FinanceListSkeleton />,
  }
);

const PAYABLE_STATUS_VALUES: PayableStatus[] = [
  'pending',
  'partial',
  'paid',
  'cancelled',
];

const PAYABLE_SOURCE_VALUES: PayableSourceType[] = [
  'purchase_order',
  'factory_shipment',
  'sales_order',
  'service',
  'other',
];

const PAYABLE_SORT_VALUES = PAYABLE_SORT_OPTIONS.map(option => option.value);

interface PayablesQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: PayableStatus;
  sourceType?: PayableSourceType;
  sortBy?: PayableSortField;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

interface PayablesPageClientProps {
  initialParams: PayablesQueryParams;
  initialStatistics: {
    totalPayables: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    pendingCount: number;
    partialCount: number;
    overdueCount: number;
    paidCount: number;
  };
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

function isPayableStatus(value?: string): value is PayableStatus {
  return !!value && PAYABLE_STATUS_VALUES.includes(value as PayableStatus);
}

function isPayableSourceType(value?: string): value is PayableSourceType {
  return !!value && PAYABLE_SOURCE_VALUES.includes(value as PayableSourceType);
}

function isPayableSortField(value?: string): value is PayableSortField {
  return !!value && PAYABLE_SORT_VALUES.includes(value as PayableSortField);
}

function normalizeInitialParams(
  params: PayablesQueryParams
): PayablesQueryParams {
  const next: PayablesQueryParams = {
    page: params.page || 1,
    limit: params.limit || 20,
    search: params.search || '',
    status: undefined,
    sourceType: undefined,
    sortBy: 'createdAt',
    sortOrder: params.sortOrder === 'asc' ? 'asc' : 'desc',
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (isPayableStatus(params.status)) {
    next.status = params.status;
  }
  if (isPayableSourceType(params.sourceType)) {
    next.sourceType = params.sourceType;
  }
  if (isPayableSortField(params.sortBy)) {
    next.sortBy = params.sortBy;
  }

  return next;
}

type FilterOverrides = Partial<
  Pick<
    PayablesQueryParams,
    | 'page'
    | 'limit'
    | 'search'
    | 'status'
    | 'sourceType'
    | 'sortBy'
    | 'sortOrder'
    | 'startDate'
    | 'endDate'
  >
>;

function usePayablesQueryState(initialParams: PayablesQueryParams) {
  const normalizedInitialParams = React.useMemo(
    () => normalizeInitialParams(initialParams),
    [initialParams]
  );

  const [search, setSearch] = React.useState(
    normalizedInitialParams.search ?? ''
  );
  const [status, setStatus] = React.useState<PayableStatus | undefined>(
    normalizedInitialParams.status
  );
  const [sourceType, setSourceType] = React.useState<
    PayableSourceType | undefined
  >(normalizedInitialParams.sourceType);
  const [sortBy, setSortBy] = React.useState<PayableSortField>(
    normalizedInitialParams.sortBy ?? 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    normalizedInitialParams.sortOrder ?? 'desc'
  );
  const [page, setPage] = React.useState(normalizedInitialParams.page);
  const [limit, setLimit] = React.useState(normalizedInitialParams.limit);
  const [startDate, setStartDate] = React.useState<string | undefined>(
    normalizedInitialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    normalizedInitialParams.endDate
  );

  React.useEffect(() => {
    setSearch(normalizedInitialParams.search ?? '');
    setStatus(normalizedInitialParams.status);
    setSourceType(normalizedInitialParams.sourceType);
    setSortBy(normalizedInitialParams.sortBy ?? 'createdAt');
    setSortOrder(normalizedInitialParams.sortOrder ?? 'desc');
    setPage(normalizedInitialParams.page);
    setLimit(normalizedInitialParams.limit);
    setStartDate(normalizedInitialParams.startDate);
    setEndDate(normalizedInitialParams.endDate);
  }, [normalizedInitialParams]);

  return {
    normalizedInitialParams,
    search,
    setSearch,
    status,
    setStatus,
    sourceType,
    setSourceType,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    limit,
    setLimit,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  };
}

/**
 * 应付款页面客户端组件
 * 负责用户交互和状态管理
 */
export function PayablesPageClient({
  initialParams,
  initialStatistics,
}: PayablesPageClientProps) {
  const router = useRouter();
  const {
    normalizedInitialParams,
    search: committedSearch,
    setSearch: setCommittedSearch,
    status,
    setStatus,
    sourceType,
    setSourceType,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    limit,
    setLimit,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  } = usePayablesQueryState(initialParams);

  const { exportData, isExporting } = useFinanceExport();

  const currentParams = React.useMemo(
    () =>
      ({
        ...normalizedInitialParams,
        search: normalizeSearch(committedSearch),
        status,
        sourceType,
        sortBy,
        sortOrder,
        page,
        limit,
        startDate,
        endDate,
      }) satisfies PayablesQueryParams,
    [
      committedSearch,
      endDate,
      limit,
      normalizedInitialParams,
      page,
      sortBy,
      sortOrder,
      sourceType,
      startDate,
      status,
    ]
  );

  const syncUrl = React.useCallback(
    (params: PayablesQueryParams) => {
      const searchParams = new URLSearchParams();
      const normalizedSearch = normalizeSearch(params.search);

      if (params.page && params.page > 1) {
        searchParams.set('page', String(params.page));
      }
      if (params.limit) {
        searchParams.set('limit', String(params.limit));
      }
      if (normalizedSearch) {
        searchParams.set('search', normalizedSearch);
      }
      if (params.status) {
        searchParams.set('status', params.status);
      }
      if (params.sourceType) {
        searchParams.set('sourceType', params.sourceType);
      }
      if (params.sortBy) {
        searchParams.set('sortBy', params.sortBy);
      }
      if (params.sortOrder) {
        searchParams.set('sortOrder', params.sortOrder);
      }
      if (params.startDate) {
        searchParams.set('startDate', params.startDate);
      }
      if (params.endDate) {
        searchParams.set('endDate', params.endDate);
      }

      const queryString = searchParams.toString();
      router.replace(
        queryString ? `/finance/payables?${queryString}` : '/finance/payables',
        { scroll: false }
      );
    },
    [router]
  );

  const buildFilters = React.useCallback(
    (overrides: FilterOverrides = {}): PayablesQueryParams => ({
      ...normalizedInitialParams,
      search: overrides.search ?? normalizeSearch(committedSearch),
      status: overrides.status ?? status,
      sourceType: overrides.sourceType ?? sourceType,
      sortBy: overrides.sortBy ?? sortBy,
      sortOrder: overrides.sortOrder ?? sortOrder,
      page: overrides.page ?? page,
      limit: overrides.limit ?? limit,
      startDate: overrides.startDate ?? startDate,
      endDate: overrides.endDate ?? endDate,
    }),
    [
      committedSearch,
      endDate,
      limit,
      normalizedInitialParams,
      page,
      sortBy,
      sortOrder,
      sourceType,
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
  }, [cancelPendingCommit, searchInput, setCommittedSearch]);

  const handleFilter = React.useCallback(
    (key: string, value?: string) => {
      const nextSearch = syncPendingSearch();
      let nextStatus = status;
      let nextSourceType = sourceType;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;
      let nextLimit = limit;

      if (key === 'status') {
        nextStatus = isPayableStatus(value) ? value : undefined;
        setStatus(nextStatus);
      } else if (key === 'sourceType') {
        nextSourceType = isPayableSourceType(value) ? value : undefined;
        setSourceType(nextSourceType);
      } else if (key === 'sortBy') {
        nextSortBy = isPayableSortField(value) ? value : 'createdAt';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = value === 'asc' ? 'asc' : 'desc';
        setSortOrder(nextSortOrder);
      } else if (key === 'limit') {
        const parsed = value ? Number.parseInt(value, 10) : nextLimit;
        if (Number.isFinite(parsed) && parsed > 0) {
          nextLimit = parsed;
          setLimit(parsed);
        }
      }

      setPage(1);
      syncUrl(
        buildFilters({
          search: nextSearch,
          status: nextStatus,
          sourceType: nextSourceType,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
          limit: nextLimit,
          page: 1,
        })
      );
    },
    [
      buildFilters,
      limit,
      setLimit,
      setPage,
      setSortBy,
      setSortOrder,
      setSourceType,
      setStatus,
      sortBy,
      sortOrder,
      sourceType,
      status,
      syncPendingSearch,
      syncUrl,
    ]
  );

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      const nextSearch = syncPendingSearch();
      setPage(nextPage);
      syncUrl(
        buildFilters({
          search: nextSearch,
          page: nextPage,
          limit,
        })
      );
    },
    [buildFilters, limit, setPage, syncPendingSearch, syncUrl]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      const nextSearch = syncPendingSearch();
      const nextStartDate = range.startDate || undefined;
      const nextEndDate = range.endDate || undefined;

      setStartDate(nextStartDate);
      setEndDate(nextEndDate);
      setPage(1);
      syncUrl(
        buildFilters({
          search: nextSearch,
          startDate: nextStartDate,
          endDate: nextEndDate,
          page: 1,
          limit,
        })
      );
    },
    [
      buildFilters,
      limit,
      setEndDate,
      setPage,
      setStartDate,
      syncPendingSearch,
      syncUrl,
    ]
  );

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');
    setStatus(undefined);
    setSourceType(undefined);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    setLimit(normalizedInitialParams.limit);
    setStartDate(undefined);
    setEndDate(undefined);
    router.replace('/finance/payables', { scroll: false });
  }, [
    cancelPendingCommit,
    normalizedInitialParams.limit,
    router,
    setCommittedSearch,
    setEndDate,
    setLimit,
    setPage,
    setSearchInput,
    setSortBy,
    setSortOrder,
    setSourceType,
    setStartDate,
    setStatus,
  ]);

  const handleExport = React.useCallback(() => {
    exportData('/api/finance/payables/export', {
      format: 'excel',
      // 导出接口期望通用的 Record<string, unknown>，这里将查询参数对象显式转换
      filters: {
        ...currentParams,
        search: normalizeSearch(searchInput),
      } as unknown as Record<string, unknown>,
    });
  }, [currentParams, exportData, searchInput]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 xl:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="应付账款"
          description="查看供应商待付款。"
          icon={<CreditCard className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={handleExport}
                disabled={isExporting}
                className="h-11 rounded-lg"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? '导出中...' : '导出'}
              </Button>
              <Button size="lg" asChild className="h-11 rounded-lg">
                <Link href="/finance/payables/create">
                  <Plus className="mr-2 h-4 w-4" />
                  登记应付款
                </Link>
              </Button>
            </>
          }
        />

        {/* 客户端交互组件 */}
        <Suspense fallback={<FinanceListSkeleton />}>
          <PayablesClient
            initialStatistics={initialStatistics}
            initialParams={currentParams}
            searchValue={searchInput}
            isSearching={isSearchPending}
            onSearch={handleSearchChange}
            onFilter={handleFilter}
            onDateRangeChange={handleDateRangeChange}
            onPageChange={handlePageChange}
            onClearFilters={handleClearFilters}
          />
        </Suspense>
      </div>
    </div>
  );
}
