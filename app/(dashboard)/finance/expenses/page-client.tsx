'use client';

import { Plus, Receipt } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { ExpenseFilters } from '@/components/finance/expenses/expense-filters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  StatsCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/skeleton-compositions';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import type {
  ExpenseQueryParams,
  ExpenseStatisticsParams,
  ExpenseType,
} from '@/lib/types/expense';

const ExpenseList = dynamic(
  () =>
    import('@/components/finance/expenses/expense-list').then(
      mod => mod.ExpenseList
    ),
  {
    ssr: false,
    loading: () => <TableSkeleton columns={7} rows={8} showPagination />,
  }
);

const ExpenseStatistics = dynamic(
  () =>
    import('@/components/finance/expenses/expense-statistics').then(
      mod => mod.ExpenseStatistics
    ),
  {
    ssr: false,
    loading: () => <StatsCardsSkeleton count={4} />,
  }
);

interface ExpensesPageClientProps {
  hasManagePermission: boolean;
  initialParams: {
    page: number;
    pageSize: number;
    search?: string;
    expenseType?: string;
    startDate?: string;
    endDate?: string;
    relatedType?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    includeTest?: boolean;
    includeVoided?: boolean;
  };
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

export function ExpensesPageClient({
  initialParams,
  hasManagePermission,
}: ExpensesPageClientProps) {
  const router = useRouter();
  const [committedSearch, setCommittedSearch] = React.useState(
    initialParams.search || ''
  );

  // 查询参数状态
  const [filters, setFilters] = React.useState<ExpenseQueryParams>({
    page: initialParams.page,
    pageSize: initialParams.pageSize,
    search: initialParams.search?.trim() || undefined,
    expenseType: initialParams.expenseType as ExpenseType | undefined,
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
    relatedType: initialParams.relatedType as
      | 'inbound'
      | 'outbound'
      | 'sales_order'
      | 'purchase_order'
      | undefined,
    sortBy: initialParams.sortBy as
      | 'expenseDate'
      | 'expenseAmount'
      | 'createdAt',
    sortOrder: initialParams.sortOrder,
    includeTest: initialParams.includeTest,
    includeVoided: initialParams.includeVoided,
  });

  const getDefaultDateRange = React.useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, []);

  // ✅ P1修复: 统计参数初始化时包含 relatedType
  // 统计参数（默认最近30天）
  const [statisticsParams, setStatisticsParams] =
    React.useState<ExpenseStatisticsParams>(() => {
      const defaultRange = getDefaultDateRange();

      return {
        startDate: filters.startDate || defaultRange.startDate,
        endDate: filters.endDate || defaultRange.endDate,
        groupBy: 'type',
        expenseType: filters.expenseType,
        relatedType: filters.relatedType, // ✅ P1修复: 添加 relatedType
      };
    });

  // 更新 URL 查询参数
  const updateURL = React.useCallback(
    (newFilters: ExpenseQueryParams) => {
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
      if (newFilters.expenseType) {
        params.set('expenseType', newFilters.expenseType);
      }
      if (newFilters.startDate) {
        params.set('startDate', newFilters.startDate);
      }
      if (newFilters.endDate) {
        params.set('endDate', newFilters.endDate);
      }
      if (newFilters.relatedType) {
        params.set('relatedType', newFilters.relatedType);
      }
      if (newFilters.sortBy && newFilters.sortBy !== 'expenseDate') {
        params.set('sortBy', newFilters.sortBy);
      }
      if (newFilters.sortOrder && newFilters.sortOrder !== 'desc') {
        params.set('sortOrder', newFilters.sortOrder);
      }
      if (newFilters.includeTest) {
        params.set('includeTest', 'true');
      }
      if (newFilters.includeVoided) {
        params.set('includeVoided', 'true');
      }

      const queryString = params.toString();
      router.push(`/finance/expenses${queryString ? `?${queryString}` : ''}`, {
        scroll: false,
      });
    },
    [router]
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
      const updatedFilters = {
        ...filters,
        search,
        page: 1,
      };

      setCommittedSearch(nextSearch);
      setFilters(updatedFilters);
      updateURL(updatedFilters);
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setCommittedSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  // 处理筛选变化
  const handleFilterChange = React.useCallback(
    (newFilters: Partial<ExpenseQueryParams>) => {
      const nextSearch = syncPendingSearch();
      const updatedFilters = {
        ...filters,
        search: nextSearch,
        ...newFilters,
        page: 1, // 重置到第一页
      };

      setFilters(updatedFilters);
      updateURL(updatedFilters);

      // ✅ P1修复: 同时更新统计参数，包括 relatedType
      const shouldUpdateDates =
        Object.prototype.hasOwnProperty.call(newFilters, 'startDate') ||
        Object.prototype.hasOwnProperty.call(newFilters, 'endDate');
      const shouldUpdateType = Object.prototype.hasOwnProperty.call(
        newFilters,
        'expenseType'
      );
      // ✅ P1修复: 添加 relatedType 变化检测
      const shouldUpdateRelatedType = Object.prototype.hasOwnProperty.call(
        newFilters,
        'relatedType'
      );

      if (shouldUpdateDates || shouldUpdateType || shouldUpdateRelatedType) {
        const defaultRange = getDefaultDateRange();
        setStatisticsParams(prev => {
          const next = { ...prev };

          if (shouldUpdateDates) {
            const hasStartDate = Object.prototype.hasOwnProperty.call(
              newFilters,
              'startDate'
            );
            const hasEndDate = Object.prototype.hasOwnProperty.call(
              newFilters,
              'endDate'
            );

            if (hasStartDate) {
              next.startDate = newFilters.startDate ?? defaultRange.startDate;
            }

            if (hasEndDate) {
              next.endDate = newFilters.endDate ?? defaultRange.endDate;
            }

            if (
              hasStartDate &&
              hasEndDate &&
              newFilters.startDate === undefined &&
              newFilters.endDate === undefined
            ) {
              next.startDate = defaultRange.startDate;
              next.endDate = defaultRange.endDate;
            }
          }

          if (shouldUpdateType) {
            next.expenseType = newFilters.expenseType as
              | ExpenseType
              | undefined;
          }

          // ✅ P1修复: 同步 relatedType 到统计参数
          if (shouldUpdateRelatedType) {
            next.relatedType = newFilters.relatedType as
              | 'inbound'
              | 'outbound'
              | 'sales_order'
              | 'purchase_order'
              | undefined;
          }

          return next;
        });
      }
    },
    [filters, getDefaultDateRange, syncPendingSearch, updateURL]
  );

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');

    const updatedFilters: ExpenseQueryParams = {
      page: 1,
      pageSize: 20,
      sortBy: 'expenseDate',
      sortOrder: 'desc',
    };

    setFilters(updatedFilters);
    updateURL(updatedFilters);

    const defaultRange = getDefaultDateRange();
    setStatisticsParams({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      groupBy: 'type',
    });
  }, [cancelPendingCommit, getDefaultDateRange, setSearchInput, updateURL]);

  // 处理分页变化
  const handlePageChange = React.useCallback(
    (page: number) => {
      const nextSearch = syncPendingSearch();
      const updatedFilters = { ...filters, search: nextSearch, page };
      setFilters(updatedFilters);
      updateURL(updatedFilters);
    },
    [filters, syncPendingSearch, updateURL]
  );

  // 处理排序变化
  const handleSortChange = React.useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      const nextSearch = syncPendingSearch();
      const updatedFilters = {
        ...filters,
        search: nextSearch,
        sortBy: sortBy as 'expenseDate' | 'expenseAmount' | 'createdAt',
        sortOrder,
      };
      setFilters(updatedFilters);
      updateURL(updatedFilters);
    },
    [filters, syncPendingSearch, updateURL]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="费用管理"
          description="登记营业费、管理费、工资等费用；审核入账后自动进入报表。"
          icon={<Receipt className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            hasManagePermission ? (
              <Button
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)]"
              >
                <Link href="/finance/expenses/create">
                  <Plus className="mr-2 h-4 w-4" />
                  登记费用
                </Link>
              </Button>
            ) : null
          }
        />

        {/* 统计卡片 */}
        <ExpenseStatistics params={statisticsParams} />

        {/* 筛选器 */}
        <Card>
          <CardContent className="pt-6">
            <ExpenseFilters
              filters={filters}
              searchValue={searchInput}
              onSearchChange={handleSearchChange}
              isSearching={isSearching}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          </CardContent>
        </Card>

        {/* 费用记录列表 */}
        <ExpenseList
          filters={filters}
          onPageChange={handlePageChange}
          onSortChange={handleSortChange}
          hasManagePermission={hasManagePermission}
        />
      </div>
    </div>
  );
}
