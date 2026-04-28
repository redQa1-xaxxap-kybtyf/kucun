'use client';

import { Plus, Warehouse } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import type { PurchaseOrderStatus } from '@/lib/types/purchase-order';

const PurchaseOrderSearchToolbar = dynamic(
  () =>
    import('@/components/purchase-orders/purchase-order-search-toolbar').then(
      mod => mod.PurchaseOrderSearchToolbar
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        筛选加载中...
      </div>
    ),
  }
);

const PurchaseOrderList = dynamic(
  () =>
    import('@/components/purchase-orders/purchase-order-list').then(
      mod => mod.PurchaseOrderList
    ),
  {
    ssr: false,
    loading: () => <TableSkeleton columns={9} rows={8} showPagination />,
  }
);

interface PurchaseOrderQueryParams {
  page?: number;
  limit?: number;
  containerNumber?: string;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: Date;
  endDate?: Date;
}

interface PurchaseOrdersPageClientProps {
  initialParams: PurchaseOrderQueryParams;
}

interface FilterSnapshot {
  search?: string;
  status: PurchaseOrderStatus | 'all';
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

export function PurchaseOrdersPageClient({
  initialParams,
}: PurchaseOrdersPageClientProps) {
  const router = useRouter();
  const initialSearch = initialParams.containerNumber || '';
  const initialStartDate = initialParams.startDate?.toISOString().split('T')[0];
  const initialEndDate = initialParams.endDate?.toISOString().split('T')[0];

  const [committedSearch, setCommittedSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<
    PurchaseOrderStatus | 'all'
  >(initialParams.status ?? 'all');
  const [supplierFilter, setSupplierFilter] = React.useState<
    string | undefined
  >(initialParams.supplierId);
  const [dateRange, setDateRange] = React.useState<{
    startDate?: string;
    endDate?: string;
  }>({
    startDate: initialStartDate,
    endDate: initialEndDate,
  });
  const sortBy = initialParams.sortBy || 'createdAt';
  const sortOrder = initialParams.sortOrder || 'desc';

  React.useEffect(() => {
    setCommittedSearch(initialSearch);
  }, [initialSearch]);

  React.useEffect(() => {
    setStatusFilter(initialParams.status ?? 'all');
    setSupplierFilter(initialParams.supplierId);
    setDateRange({
      startDate: initialStartDate,
      endDate: initialEndDate,
    });
  }, [
    initialEndDate,
    initialParams.status,
    initialParams.supplierId,
    initialStartDate,
  ]);

  const buildSnapshot = React.useCallback(
    (overrides: Partial<FilterSnapshot> = {}): FilterSnapshot => ({
      search: overrides.search ?? normalizeSearch(committedSearch),
      status: overrides.status ?? statusFilter,
      supplierId: overrides.supplierId ?? supplierFilter,
      startDate: overrides.startDate ?? dateRange.startDate,
      endDate: overrides.endDate ?? dateRange.endDate,
      page: overrides.page,
    }),
    [committedSearch, statusFilter, supplierFilter, dateRange]
  );

  const syncFiltersToURL = React.useCallback(
    (snapshot: FilterSnapshot) => {
      const params = new URLSearchParams();

      if (snapshot.search) {
        params.set('search', snapshot.search);
      }
      if (snapshot.status !== 'all') {
        params.set('status', snapshot.status);
      }
      if (snapshot.supplierId) {
        params.set('supplierId', snapshot.supplierId);
      }
      if (snapshot.startDate) {
        params.set('startDate', snapshot.startDate);
      }
      if (snapshot.endDate) {
        params.set('endDate', snapshot.endDate);
      }
      if (sortBy && sortBy !== 'createdAt') {
        params.set('sortBy', sortBy);
      }
      if (sortOrder && sortOrder !== 'desc') {
        params.set('sortOrder', sortOrder);
      }
      if (snapshot.page && snapshot.page > 1) {
        params.set('page', snapshot.page.toString());
      }
      if (initialParams.limit) {
        params.set('limit', initialParams.limit.toString());
      }

      const queryString = params.toString();
      router.replace(
        queryString ? `/purchase-orders?${queryString}` : '/purchase-orders',
        { scroll: false }
      );
    },
    [initialParams.limit, router, sortBy, sortOrder]
  );

  const {
    searchInput,
    isSearching,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
  } = useListSearchController({
    committedValue: committedSearch,
    onCommit: search => {
      const nextSearch = search ?? '';
      setCommittedSearch(nextSearch);
      syncFiltersToURL(buildSnapshot({ search }));
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setCommittedSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  const handleStatusChange = React.useCallback(
    (value: PurchaseOrderStatus | 'all') => {
      setStatusFilter(value);
      const nextSearch = syncPendingSearch();
      syncFiltersToURL(buildSnapshot({ search: nextSearch, status: value }));
    },
    [buildSnapshot, syncFiltersToURL, syncPendingSearch]
  );

  const handleSupplierChange = React.useCallback(
    (value: string | undefined) => {
      setSupplierFilter(value);
      const nextSearch = syncPendingSearch();
      syncFiltersToURL(buildSnapshot({ search: nextSearch, supplierId: value }));
    },
    [buildSnapshot, syncFiltersToURL, syncPendingSearch]
  );

  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      setDateRange(range);
      const nextSearch = syncPendingSearch();
      syncFiltersToURL(
        buildSnapshot({
          search: nextSearch,
          startDate: range.startDate,
          endDate: range.endDate,
        })
      );
    },
    [buildSnapshot, syncFiltersToURL, syncPendingSearch]
  );

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');
    setStatusFilter('all');
    setSupplierFilter(undefined);
    setDateRange({});
    router.replace('/purchase-orders', { scroll: false });
  }, [cancelPendingCommit, router, setSearchInput]);

  const handlePageChange = React.useCallback(
    (page: number) => {
      const nextSearch = syncPendingSearch();
      syncFiltersToURL(buildSnapshot({ search: nextSearch, page }));
    },
    [buildSnapshot, syncFiltersToURL, syncPendingSearch]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex-shrink-0 sm:mb-6">
        <PageHeader
          title="仓库进货"
          description="管理采购订单与到货进度，实时掌握仓库补货情况"
          icon={<Warehouse className="h-6 w-6 text-white" />}
          variant="solid"
          actions={
            <Button
              size="lg"
              asChild
              className="h-11 shadow-sm"
            >
              <Link href="/purchase-orders/create">
                <Plus className="mr-2 h-4 w-4" />
                新建采购订单
              </Link>
            </Button>
          }
        />
      </div>

      <div className="flex-1 space-y-4">
        <PurchaseOrderSearchToolbar
          searchValue={searchInput}
          statusFilter={statusFilter}
          supplierId={supplierFilter}
          dateRange={dateRange}
          isSearching={isSearching}
          onSearch={handleSearchChange}
          onStatusChange={handleStatusChange}
          onSupplierChange={handleSupplierChange}
          onDateRangeChange={handleDateRangeChange}
          onClearFilters={handleClearFilters}
        />

        <PurchaseOrderList
          page={initialParams.page}
          limit={initialParams.limit}
          search={normalizeSearch(committedSearch)}
          status={statusFilter === 'all' ? undefined : statusFilter}
          supplierId={supplierFilter}
          startDate={
            dateRange.startDate ? new Date(dateRange.startDate) : undefined
          }
          endDate={dateRange.endDate ? new Date(dateRange.endDate) : undefined}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
