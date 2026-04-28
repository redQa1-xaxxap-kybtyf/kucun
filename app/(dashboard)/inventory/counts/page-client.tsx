'use client';

import { ClipboardCheck, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import type {
  CountStatus,
  CountType,
  InventoryCountQueryParams,
} from '@/lib/types/inventory-count';

import { CountRecordsFilters } from './components/CountRecordsFilters';

interface CountsPageClientProps {
  hasManagePermission: boolean;
  initialParams: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    countType?: string;
    location?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

const CountList = dynamic(
  () =>
    import('@/components/inventory/counts/count-list').then(
      mod => mod.CountList
    ),
  {
    ssr: false,
    loading: () => <TableSkeleton columns={8} rows={8} showPagination />,
  }
);

// eslint-disable-next-line max-lines-per-function -- Search input, filters, and URL sync stay together to keep the page behavior predictable.
export function CountsPageClient({
  initialParams,
  hasManagePermission,
}: CountsPageClientProps) {
  const router = useRouter();

  // 查询参数状态
  const [filters, setFilters] = React.useState<InventoryCountQueryParams>({
    page: initialParams.page,
    pageSize: initialParams.pageSize,
    search: initialParams.search,
    status: initialParams.status as CountStatus | undefined,
    countType: initialParams.countType as CountType | undefined,
    location: initialParams.location,
    categoryId: initialParams.categoryId,
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
    sortBy: initialParams.sortBy as InventoryCountQueryParams['sortBy'],
    sortOrder: initialParams.sortOrder,
  });

  // 更新 URL 查询参数
  const updateURL = React.useCallback(
    (newFilters: InventoryCountQueryParams) => {
      const params = new URLSearchParams();

      if (newFilters.page && newFilters.page > 1) {
        params.set('page', newFilters.page.toString());
      }
      if (newFilters.pageSize && newFilters.pageSize !== 20) {
        params.set('pageSize', newFilters.pageSize.toString());
      }
      if (newFilters.search) {
        params.set('search', newFilters.search);
      }
      if (newFilters.status) {
        params.set('status', newFilters.status);
      }
      if (newFilters.countType) {
        params.set('countType', newFilters.countType);
      }
      if (newFilters.location) {
        params.set('location', newFilters.location);
      }
      if (newFilters.categoryId) {
        params.set('categoryId', newFilters.categoryId);
      }
      if (newFilters.startDate) {
        params.set('startDate', newFilters.startDate);
      }
      if (newFilters.endDate) {
        params.set('endDate', newFilters.endDate);
      }
      if (newFilters.sortBy && newFilters.sortBy !== 'planDate') {
        params.set('sortBy', newFilters.sortBy);
      }
      if (newFilters.sortOrder && newFilters.sortOrder !== 'desc') {
        params.set('sortOrder', newFilters.sortOrder);
      }

      const queryString = params.toString();
      router.replace(
        `/inventory/counts${queryString ? `?${queryString}` : ''}`,
        {
          scroll: false,
        }
      );
    },
    [router]
  );

  const applyFilters = React.useCallback(
    (
      newFilters: Partial<InventoryCountQueryParams>,
      options?: { resetPage?: boolean }
    ) => {
      setFilters(prev => {
        const nextFilters = {
          ...prev,
          ...newFilters,
          page: options?.resetPage === false ? prev.page : 1,
        };

        updateURL(nextFilters);
        return nextFilters;
      });
    },
    [updateURL]
  );

  const { searchInput, isSearching, handleSearchChange } =
    useListSearchController({
      committedValue: filters.search,
      onCommit: search => {
        applyFilters({ search }, { resetPage: true });
      },
    });

  // 处理筛选变化
  const handleFilterChange = React.useCallback(
    (newFilters: Partial<InventoryCountQueryParams>) => {
      applyFilters(newFilters, { resetPage: true });
    },
    [applyFilters]
  );

  // 重置筛选条件
  const handleResetFilters = React.useCallback(() => {
    const resetFilters: InventoryCountQueryParams = {
      page: 1,
      pageSize: initialParams.pageSize,
      sortBy: 'planDate',
      sortOrder: 'desc',
    };

    setFilters(resetFilters);
    updateURL(resetFilters);
  }, [initialParams.pageSize, updateURL]);

  return (
    // 与库存总览等页面保持一致的布局容器，统一滚动和边距
    <div className="flex h-full flex-col overflow-auto p-4 xl:p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="盘点单"
          description="盘点记录"
          icon={<ClipboardCheck className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-info))"
          actions={
            hasManagePermission ? (
              <Button size="lg" asChild className="h-11 shadow-sm">
                <Link href="/inventory/counts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  新建盘点单
                </Link>
              </Button>
            ) : undefined
          }
        />

        {/* 筛选条件 */}
        <CountRecordsFilters
          filters={filters}
          searchValue={searchInput}
          isSearching={isSearching}
          onSearchChange={handleSearchChange}
          onFiltersChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* 盘点单列表 */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CountList filters={filters} />
        </div>
      </div>
    </div>
  );
}
