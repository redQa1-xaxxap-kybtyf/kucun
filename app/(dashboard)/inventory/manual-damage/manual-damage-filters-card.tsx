'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  MANUAL_DAMAGE_CATEGORY_OPTIONS,
  MANUAL_DAMAGE_HANDLING_OPTIONS,
  MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS,
  type ManualDamageLedgerQueryParams,
  type ManualDamageLedgerStatus,
} from '@/lib/types/manual-damage-ledger';

type CategoryFilterValue =
  | NonNullable<ManualDamageLedgerQueryParams['damageCategory']>
  | 'all';
type HandlingFilterValue =
  | NonNullable<ManualDamageLedgerQueryParams['damageHandling']>
  | 'all';
type StatusFilterValue = NonNullable<ManualDamageLedgerStatus> | 'all';

interface ManualDamageFiltersCardProps {
  initialParams: ManualDamageLedgerQueryParams;
}

interface FilterSnapshot {
  search?: string;
  damageCategory: CategoryFilterValue;
  damageHandling: HandlingFilterValue;
  status: StatusFilterValue;
  startDate?: string;
  endDate?: string;
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

export function ManualDamageFiltersCard({
  initialParams,
}: ManualDamageFiltersCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [committedSearch, setCommittedSearch] = React.useState(
    initialParams.search ?? ''
  );
  const [damageCategory, setDamageCategory] =
    React.useState<CategoryFilterValue>(initialParams.damageCategory ?? 'all');
  const [damageHandling, setDamageHandling] =
    React.useState<HandlingFilterValue>(initialParams.damageHandling ?? 'all');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue>(
    initialParams.status ?? 'all'
  );
  const [dateRange, setDateRange] = React.useState<{
    startDate?: string;
    endDate?: string;
  }>({
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
  });

  React.useEffect(() => {
    setCommittedSearch(initialParams.search ?? '');
    setDamageCategory(initialParams.damageCategory ?? 'all');
    setDamageHandling(initialParams.damageHandling ?? 'all');
    setStatusFilter(initialParams.status ?? 'all');
    setDateRange({
      startDate: initialParams.startDate,
      endDate: initialParams.endDate,
    });
  }, [initialParams]);

  const syncFiltersToURL = React.useCallback(
    (snapshot: FilterSnapshot) => {
      const params = new URLSearchParams();

      if (snapshot.search) {
        params.set('search', snapshot.search);
      }
      if (snapshot.damageCategory !== 'all') {
        params.set('damageCategory', snapshot.damageCategory);
      }
      if (snapshot.damageHandling !== 'all') {
        params.set('damageHandling', snapshot.damageHandling);
      }
      if (snapshot.status !== 'all') {
        params.set('status', snapshot.status);
      }
      if (snapshot.startDate) {
        params.set('startDate', snapshot.startDate);
      }
      if (snapshot.endDate) {
        params.set('endDate', snapshot.endDate);
      }

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router]
  );

  const buildSnapshot = React.useCallback(
    (overrides: Partial<FilterSnapshot> = {}): FilterSnapshot => ({
      search: overrides.search ?? normalizeSearch(committedSearch),
      damageCategory: overrides.damageCategory ?? damageCategory,
      damageHandling: overrides.damageHandling ?? damageHandling,
      status: overrides.status ?? statusFilter,
      startDate: overrides.startDate ?? dateRange.startDate,
      endDate: overrides.endDate ?? dateRange.endDate,
    }),
    [committedSearch, damageCategory, damageHandling, dateRange, statusFilter]
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

  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      const nextSearch = syncPendingSearch();

      if (key === 'damageCategory') {
        const nextValue = (value as CategoryFilterValue | undefined) ?? 'all';
        setDamageCategory(nextValue);
        syncFiltersToURL(
          buildSnapshot({ search: nextSearch, damageCategory: nextValue })
        );
        return;
      }

      if (key === 'damageHandling') {
        const nextValue = (value as HandlingFilterValue | undefined) ?? 'all';
        setDamageHandling(nextValue);
        syncFiltersToURL(
          buildSnapshot({ search: nextSearch, damageHandling: nextValue })
        );
        return;
      }

      if (key === 'status') {
        const nextValue = (value as StatusFilterValue | undefined) ?? 'all';
        setStatusFilter(nextValue);
        syncFiltersToURL(
          buildSnapshot({ search: nextSearch, status: nextValue })
        );
      }
    },
    [buildSnapshot, syncFiltersToURL, syncPendingSearch]
  );

  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      const nextSearch = syncPendingSearch();
      setDateRange(range);
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
    setDamageCategory('all');
    setDamageHandling('all');
    setStatusFilter('all');
    setDateRange({});
    router.replace(pathname, { scroll: false });
  }, [cancelPendingCommit, pathname, router, setSearchInput]);

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    damageCategory !== 'all' ||
    damageHandling !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(dateRange.startDate) ||
    Boolean(dateRange.endDate);

  return (
    <SearchFilterCard
      searchValue={searchInput}
      onSearchChange={handleSearchChange}
      searchPlaceholder="搜索台账号、调整单号、产品编码、产品名称、供应商、批次号..."
      isSearching={isSearching}
      filters={[
        {
          key: 'damageCategory',
          label: '报损类型',
          options: MANUAL_DAMAGE_CATEGORY_OPTIONS,
          width: 'w-full sm:w-36',
        },
        {
          key: 'damageHandling',
          label: '处理方式',
          options: MANUAL_DAMAGE_HANDLING_OPTIONS,
          width: 'w-full sm:w-40',
        },
        {
          key: 'status',
          label: '跟进状态',
          options: MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS,
          width: 'w-full sm:w-40',
        },
      ]}
      filterValues={{
        damageCategory,
        damageHandling,
        status: statusFilter,
      }}
      onFilterChange={handleFilterChange}
      dateRangeFilter={{
        key: 'dateRange',
        label: '登记日期',
        value: dateRange,
        onChange: handleDateRangeChange,
        placeholder: '开始日期至结束日期',
      }}
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
    />
  );
}
