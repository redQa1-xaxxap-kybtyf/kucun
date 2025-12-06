'use client';

import { CreditCard, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback, type DebouncedState } from 'use-debounce';

import { PayablesClient } from '@/components/finance/payables-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { useFinanceExport } from '@/hooks/use-finance-export';
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

type DebouncedUpdateFn = DebouncedState<
  (nextSearch: string, overrides: FilterOverrides) => void
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
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  };
}

function usePayablesUrlUpdater(
  router: ReturnType<typeof useRouter>,
  normalizedInitialParams: PayablesQueryParams,
  status: PayableStatus | undefined,
  sourceType: PayableSourceType | undefined,
  sortBy: PayableSortField,
  sortOrder: 'asc' | 'desc',
  startDate: string | undefined,
  endDate: string | undefined
): DebouncedUpdateFn {
  const [, startTransition] = React.useTransition();

  return useDebouncedCallback(
    (nextSearch: string, overrides: FilterOverrides) => {
      const nextParams: PayablesQueryParams = {
        ...normalizedInitialParams,
        search: nextSearch || '',
        status,
        sourceType,
        sortBy,
        sortOrder,
        startDate,
        endDate,
        ...overrides,
      };

      const searchParams = new URLSearchParams();
      searchParams.set('page', String(nextParams.page));
      searchParams.set('limit', String(nextParams.limit));
      if (nextParams.search) {
        searchParams.set('search', nextParams.search);
      }
      if (nextParams.status) {
        searchParams.set('status', nextParams.status);
      }
      if (nextParams.sourceType) {
        searchParams.set('sourceType', nextParams.sourceType);
      }
      searchParams.set('sortBy', nextParams.sortBy ?? 'createdAt');
      searchParams.set('sortOrder', nextParams.sortOrder ?? 'desc');
      if (nextParams.startDate) {
        searchParams.set('startDate', nextParams.startDate);
      }
      if (nextParams.endDate) {
        searchParams.set('endDate', nextParams.endDate);
      }

      startTransition(() => {
        router.push(`/finance/payables?${searchParams.toString()}`);
      });
    },
    300
  );
}

function usePayablesSearchHandler(args: {
  debouncedUpdateURL: DebouncedUpdateFn;
  normalizedInitialParams: PayablesQueryParams;
  status: PayableStatus | undefined;
  sourceType: PayableSourceType | undefined;
  sortBy: PayableSortField;
  sortOrder: 'asc' | 'desc';
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  startDate: string | undefined;
  endDate: string | undefined;
}) {
  const {
    debouncedUpdateURL,
    normalizedInitialParams,
    setSearch,
    sortBy,
    sortOrder,
    sourceType,
    status,
    startDate,
    endDate,
  } = args;

  return React.useCallback(
    (nextSearch: string) => {
      setSearch(nextSearch);
      debouncedUpdateURL(nextSearch, {
        page: 1,
        limit: normalizedInitialParams.limit,
        search: nextSearch || undefined,
        status,
        sourceType,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      endDate,
      normalizedInitialParams.limit,
      setSearch,
      sortBy,
      sortOrder,
      sourceType,
      startDate,
      status,
    ]
  );
}

function usePayablesFilterHandler(args: {
  debouncedUpdateURL: DebouncedUpdateFn;
  normalizedInitialParams: PayablesQueryParams;
  search: string;
  status: PayableStatus | undefined;
  setStatus: React.Dispatch<React.SetStateAction<PayableStatus | undefined>>;
  sourceType: PayableSourceType | undefined;
  setSourceType: React.Dispatch<
    React.SetStateAction<PayableSourceType | undefined>
  >;
  sortBy: PayableSortField;
  setSortBy: React.Dispatch<React.SetStateAction<PayableSortField>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  startDate: string | undefined;
  endDate: string | undefined;
}) {
  const {
    debouncedUpdateURL,
    normalizedInitialParams,
    search,
    setSortBy,
    setSortOrder,
    setSourceType,
    setStatus,
    sortBy,
    sortOrder,
    sourceType,
    status,
    startDate,
    endDate,
  } = args;

  return React.useCallback(
    (key: string, value?: string) => {
      let nextStatus = status;
      let nextSourceType = sourceType;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;
      let nextLimit = normalizedInitialParams.limit;

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
        }
      }

      debouncedUpdateURL(search, {
        page: 1,
        limit: nextLimit,
        search: search || undefined,
        status: nextStatus,
        sourceType: nextSourceType,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
        startDate,
        endDate,
      });
    },
    [
      endDate,
      debouncedUpdateURL,
      normalizedInitialParams.limit,
      search,
      setSortBy,
      setSortOrder,
      setSourceType,
      setStatus,
      sortBy,
      sortOrder,
      sourceType,
      startDate,
      status,
    ]
  );
}

function usePayablesPageHandler(args: {
  debouncedUpdateURL: DebouncedUpdateFn;
  normalizedInitialParams: PayablesQueryParams;
  search: string;
  status: PayableStatus | undefined;
  sourceType: PayableSourceType | undefined;
  sortBy: PayableSortField;
  sortOrder: 'asc' | 'desc';
  startDate: string | undefined;
  endDate: string | undefined;
}) {
  const {
    debouncedUpdateURL,
    normalizedInitialParams,
    search,
    sortBy,
    sortOrder,
    sourceType,
    status,
    startDate,
    endDate,
  } = args;

  return React.useCallback(
    (page: number) => {
      debouncedUpdateURL(search, {
        page,
        limit: normalizedInitialParams.limit,
        search: search || undefined,
        status,
        sourceType,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      endDate,
      normalizedInitialParams.limit,
      search,
      sortBy,
      sortOrder,
      sourceType,
      startDate,
      status,
    ]
  );
}

function usePayablesFilters(
  router: ReturnType<typeof useRouter>,
  initialParams: PayablesQueryParams
) {
  const {
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
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  } = usePayablesQueryState(initialParams);

  const debouncedUpdateURL = usePayablesUrlUpdater(
    router,
    normalizedInitialParams,
    status,
    sourceType,
    sortBy,
    sortOrder,
    startDate,
    endDate
  );

  const handleSearch = usePayablesSearchHandler({
    debouncedUpdateURL,
    normalizedInitialParams,
    status,
    sourceType,
    sortBy,
    sortOrder,
    setSearch,
    startDate,
    endDate,
  });

  const handleFilter = usePayablesFilterHandler({
    debouncedUpdateURL,
    normalizedInitialParams,
    search,
    status,
    setStatus,
    sourceType,
    setSourceType,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    startDate,
    endDate,
  });

  const handlePageChange = usePayablesPageHandler({
    debouncedUpdateURL,
    normalizedInitialParams,
    search,
    status,
    sourceType,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  });

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      setStartDate(range.startDate);
      setEndDate(range.endDate);

      debouncedUpdateURL(search, {
        page: 1,
        limit: normalizedInitialParams.limit,
        search: search || undefined,
        status,
        sourceType,
        sortBy,
        sortOrder,
        startDate: range.startDate,
        endDate: range.endDate,
      });
    },
    [
      debouncedUpdateURL,
      normalizedInitialParams.limit,
      search,
      setEndDate,
      setStartDate,
      sortBy,
      sortOrder,
      sourceType,
      status,
    ]
  );

  return {
    normalizedInitialParams,
    handleSearch,
    handleFilter,
    handlePageChange,
    handleDateRangeChange,
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
    handleSearch,
    handleFilter,
    handlePageChange,
    handleDateRangeChange,
  } = usePayablesFilters(router, initialParams);

  const { exportData, isExporting } = useFinanceExport();

  const handleExport = React.useCallback(() => {
    exportData('/api/finance/payables/export', {
      format: 'excel',
      // 导出接口期望通用的 Record<string, unknown>，这里将查询参数对象显式转换
      filters: normalizedInitialParams as unknown as Record<string, unknown>,
    });
  }, [exportData, normalizedInitialParams]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)] sm:h-12 sm:w-12">
                  <CreditCard className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl sm:font-bold">
                    应付款管理
                  </h1>
                  <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                    管理供应商应付款和付款记录，跟踪付款状态和账务动态
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? '导出中...' : '导出'}
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payables/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建应付款
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
          <PayablesClient
            initialStatistics={initialStatistics}
            initialParams={normalizedInitialParams}
            onSearch={handleSearch}
            onFilter={handleFilter}
            onDateRangeChange={handleDateRangeChange}
            onPageChange={handlePageChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
