/**
 * 往来账单筛选状态管理Hook
 * 职责：管理搜索、筛选、排序和分页状态
 */

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface StatementsQueryParams {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

interface UseStatementsFiltersProps {
  initialParams: StatementsQueryParams;
}

/**
 * 构建往来账单URL查询参数
 */
function buildStatementsURLParams(params: {
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  const urlParams = new URLSearchParams();
  if (params.search) {
    urlParams.set('search', params.search);
  }
  if (params.type && params.type !== 'all') {
    urlParams.set('type', params.type);
  }
  if (params.sortBy) {
    urlParams.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    urlParams.set('sortOrder', params.sortOrder);
  }
  if (params.page && params.page > 1) {
    urlParams.set('page', params.page.toString());
  }
  if (params.limit) {
    urlParams.set('limit', params.limit.toString());
  }
  if (params.startDate) {
    urlParams.set('startDate', params.startDate);
  }
  if (params.endDate) {
    urlParams.set('endDate', params.endDate);
  }
  return urlParams;
}

export function useStatementsFilters({
  initialParams,
}: UseStatementsFiltersProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // 本地状态管理
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [type, setType] = React.useState(initialParams.type || 'all');
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'totalAmount'
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

  // 构建URL参数
  const buildURLParams = React.useCallback(buildStatementsURLParams, []);

  // 防抖更新URL
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: StatementsQueryParams) => {
      startTransition(() => {
        const params = buildURLParams({
          search: searchValue,
          type: filters.type,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          page: filters.page,
          limit: filters.limit,
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
        router.push(`/finance/statements?${params.toString()}`);
      });
    },
    300
  );

  // 搜索处理
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        ...initialParams,
        search: value,
        type: type === 'all' ? undefined : type,
        sortBy,
        sortOrder,
        page: 1,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      initialParams,
      type,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const nextType = key === 'type' ? value || 'all' : type;
      const nextSortBy = key === 'sortBy' ? value || 'totalAmount' : sortBy;
      const nextSortOrder =
        key === 'sortOrder' ? (value as 'asc' | 'desc') || 'desc' : sortOrder;

      setType(nextType);
      setSortBy(nextSortBy);
      setSortOrder(nextSortOrder);

      startTransition(() => {
        const params = buildURLParams({
          search,
          type: nextType,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
          limit: initialParams.limit,
          startDate,
          endDate,
        });
        router.push(`/finance/statements?${params.toString()}`);
      });
    },
    [
      buildURLParams,
      initialParams.limit,
      router,
      search,
      sortBy,
      sortOrder,
      type,
      startDate,
      endDate,
    ]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const params = buildURLParams({
          search,
          type,
          sortBy,
          sortOrder,
          page,
          limit: initialParams.limit,
          startDate,
          endDate,
        });
        router.push(`/finance/statements?${params.toString()}`);
      });
    },
    [
      buildURLParams,
      router,
      search,
      type,
      sortBy,
      sortOrder,
      initialParams.limit,
      startDate,
      endDate,
    ]
  );

  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      const nextStart = range.startDate || undefined;
      const nextEnd = range.endDate || undefined;

      setStartDate(nextStart);
      setEndDate(nextEnd);

      startTransition(() => {
        const params = buildURLParams({
          search,
          type,
          sortBy,
          sortOrder,
          page: 1,
          limit: initialParams.limit,
          startDate: nextStart,
          endDate: nextEnd,
        });
        router.push(`/finance/statements?${params.toString()}`);
      });
    },
    [
      buildURLParams,
      initialParams.limit,
      router,
      search,
      sortBy,
      sortOrder,
      type,
    ]
  );

  return {
    filters: {
      search,
      type,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    },
    handlers: {
      handleSearch,
      handleFilter,
      handlePageChange,
      handleDateRangeChange,
    },
  };
}
