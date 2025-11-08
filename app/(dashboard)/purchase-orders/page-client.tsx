'use client';

import { Plus, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { PurchaseOrderList } from '@/components/purchase-orders/purchase-order-list';
import { PurchaseOrderSearchToolbar } from '@/components/purchase-orders/purchase-order-search-toolbar';
import { Button } from '@/components/ui/button';
import type { PurchaseOrderStatus } from '@/lib/types/purchase-order';

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
  search: string;
  status: PurchaseOrderStatus | 'all';
  supplierId?: string;
}

export function PurchaseOrdersPageClient({
  initialParams,
}: PurchaseOrdersPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  const [searchValue, setSearchValue] = React.useState(
    initialParams.containerNumber || ''
  );
  const [statusFilter, setStatusFilter] = React.useState<
    PurchaseOrderStatus | 'all'
  >(initialParams.status ?? 'all');
  const [supplierFilter, setSupplierFilter] = React.useState<
    string | undefined
  >(initialParams.supplierId);
  const sortBy = initialParams.sortBy || 'createdAt';
  const sortOrder = initialParams.sortOrder || 'desc';

  const buildSnapshot = React.useCallback(
    (overrides: Partial<FilterSnapshot> = {}): FilterSnapshot => ({
      search: overrides.search ?? searchValue,
      status: overrides.status ?? statusFilter,
      supplierId: overrides.supplierId ?? supplierFilter,
    }),
    [searchValue, statusFilter, supplierFilter]
  );

  const syncFiltersToURL = useDebouncedCallback(
    (snapshot: FilterSnapshot) => {
      startTransition(() => {
        const params = new URLSearchParams();
        const trimmedSearch = snapshot.search.trim();

        if (trimmedSearch) {
          params.set('search', trimmedSearch);
        }
        if (snapshot.status !== 'all') {
          params.set('status', snapshot.status);
        }
        if (snapshot.supplierId) {
          params.set('supplierId', snapshot.supplierId);
        }
        if (sortBy && sortBy !== 'createdAt') {
          params.set('sortBy', sortBy);
        }
        if (sortOrder && sortOrder !== 'desc') {
          params.set('sortOrder', sortOrder);
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        const queryString = params.toString();
        router.push(
          queryString ? `/purchase-orders?${queryString}` : '/purchase-orders'
        );
      });
    },
    300,
    [router, startTransition, initialParams.limit, sortBy, sortOrder]
  );

  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchValue(value);
      syncFiltersToURL(buildSnapshot({ search: value }));
    },
    [buildSnapshot, syncFiltersToURL]
  );

  const handleStatusChange = React.useCallback(
    (value: PurchaseOrderStatus | 'all') => {
      setStatusFilter(value);
      syncFiltersToURL(buildSnapshot({ status: value }));
    },
    [buildSnapshot, syncFiltersToURL]
  );

  const handleSupplierChange = React.useCallback(
    (value: string | undefined) => {
      setSupplierFilter(value);
      syncFiltersToURL(buildSnapshot({ supplierId: value }));
    },
    [buildSnapshot, syncFiltersToURL]
  );

  const handleClearFilters = React.useCallback(() => {
    setSearchValue('');
    setStatusFilter('all');
    setSupplierFilter(undefined);
    startTransition(() => {
      router.push('/purchase-orders');
    });
  }, [router, startTransition]);

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-6 flex-shrink-0">
        <PageHeader
          title="仓库进货"
          description="管理采购订单与到货进度，实时掌握仓库补货情况"
          icon={<Warehouse className="h-6 w-6 text-white" />}
          variant="solid"
          actions={
            <Button
              size="lg"
              asChild
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
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
          searchValue={searchValue}
          statusFilter={statusFilter}
          supplierId={supplierFilter}
          isSearching={false}
          onSearch={handleSearch}
          onStatusChange={handleStatusChange}
          onSupplierChange={handleSupplierChange}
          onClearFilters={handleClearFilters}
        />

        <PurchaseOrderList
          page={initialParams.page}
          limit={initialParams.limit}
          search={searchValue}
          status={statusFilter === 'all' ? undefined : statusFilter}
          supplierId={supplierFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </div>
    </div>
  );
}
