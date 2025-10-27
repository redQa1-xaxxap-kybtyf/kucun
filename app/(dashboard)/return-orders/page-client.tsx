'use client';

import { Download, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { ERPReturnOrderList } from '@/components/return-orders/erp-return-order-list';
import { Button } from '@/components/ui/button';
import type {
  ReturnOrderQueryParams,
  ReturnOrderStatus,
  ReturnOrderType,
  ReturnProcessType,
} from '@/lib/types/return-order';

interface ReturnOrdersPageClientProps {
  initialParams: ReturnOrderQueryParams;
}

interface DateRangePayload {
  startDate?: string;
  endDate?: string;
}

function buildReturnOrderQuery(
  searchValue: string,
  filters: ReturnOrderQueryParams
) {
  const params = new URLSearchParams();

  if (searchValue) {
    params.set('search', searchValue);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }
  if (filters.processType) {
    params.set('processType', filters.processType);
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

  return params.toString();
}

function useReturnOrderNavigation(initialParams: ReturnOrderQueryParams) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState(initialParams.status);
  const [type, setType] = React.useState<ReturnOrderType | undefined>(
    initialParams.type
  );
  const [processType, setProcessType] = React.useState<
    ReturnProcessType | undefined
  >(initialParams.processType);
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState(initialParams.startDate);
  const [endDate, setEndDate] = React.useState(initialParams.endDate);

  const buildFilters = React.useCallback(
    (overrides: Partial<ReturnOrderQueryParams> = {}) => ({
      ...initialParams,
      status,
      type,
      processType,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      page: 1,
      ...overrides,
    }),
    [
      endDate,
      initialParams,
      processType,
      sortBy,
      sortOrder,
      startDate,
      status,
      type,
    ]
  );

  const pushFilters = React.useCallback(
    (searchValue: string, filters: ReturnOrderQueryParams) => {
      startTransition(() => {
        const query = buildReturnOrderQuery(searchValue, filters);
        router.push(query ? `/return-orders?${query}` : '/return-orders');
      });
    },
    [router, startTransition]
  );

  const debouncedPushFilters = useDebouncedCallback(pushFilters, 300);

  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedPushFilters(value, buildFilters({ page: 1 }));
    },
    [buildFilters, debouncedPushFilters]
  );

  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'status') {
        const nextStatus =
          (value as ReturnOrderStatus | undefined) || undefined;
        setStatus(nextStatus);
        pushFilters(search, buildFilters({ status: nextStatus, page: 1 }));
        return;
      }

      if (key === 'type') {
        const nextType = (value as ReturnOrderType | undefined) || undefined;
        setType(nextType);
        pushFilters(search, buildFilters({ type: nextType, page: 1 }));
        return;
      }

      if (key === 'processType') {
        const nextProcessType =
          (value as ReturnProcessType | undefined) || undefined;
        setProcessType(nextProcessType);
        pushFilters(
          search,
          buildFilters({ processType: nextProcessType, page: 1 })
        );
        return;
      }

      if (key === 'sortBy') {
        const nextSortBy = value || 'createdAt';
        setSortBy(nextSortBy);
        pushFilters(search, buildFilters({ sortBy: nextSortBy, page: 1 }));
        return;
      }

      if (key === 'sortOrder') {
        const nextSortOrder = (value as 'asc' | 'desc') || 'desc';
        setSortOrder(nextSortOrder);
        pushFilters(
          search,
          buildFilters({ sortOrder: nextSortOrder, page: 1 })
        );
      }
    },
    [buildFilters, pushFilters, search]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangePayload) => {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      pushFilters(
        search,
        buildFilters({
          startDate: range.startDate,
          endDate: range.endDate,
          page: 1,
        })
      );
    },
    [buildFilters, pushFilters, search]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      pushFilters(search, buildFilters({ page }));
    },
    [buildFilters, pushFilters, search]
  );

  const handleClearFilters = React.useCallback(() => {
    setStatus(undefined);
    setType(undefined);
    setProcessType(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    pushFilters(
      search,
      buildFilters({
        status: undefined,
        type: undefined,
        processType: undefined,
        startDate: undefined,
        endDate: undefined,
        page: 1,
      })
    );
  }, [buildFilters, pushFilters, search]);

  return {
    onSearch: handleSearch,
    onFilter: handleFilter,
    onDateRangeChange: handleDateRangeChange,
    onPageChange: handlePageChange,
    onClearFilters: handleClearFilters,
  };
}

/**
 * 退货订单页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function ReturnOrdersPageClient({
  initialParams,
}: ReturnOrdersPageClientProps) {
  const {
    onSearch,
    onFilter,
    onDateRangeChange,
    onPageChange,
    onClearFilters,
  } = useReturnOrderNavigation(initialParams);

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <PageHeader
          title="退货订单管理"
          description="管理客户退货订单，跟踪退货处理状态和退款情况"
          icon={<Package className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-orange))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/return-orders/export">
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
                  新建退货单
                </Link>
              </Button>
            </>
          }
        />

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          }
        >
          <ERPReturnOrderList
            initialParams={initialParams}
            onSearch={onSearch}
            onFilter={onFilter}
            onDateRangeChange={onDateRangeChange}
            onPageChange={onPageChange}
            onClearFilters={onClearFilters}
          />
        </Suspense>
      </div>
    </div>
  );
}
