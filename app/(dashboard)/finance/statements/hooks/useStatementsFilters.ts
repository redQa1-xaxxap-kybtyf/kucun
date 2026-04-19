'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { useListSearchController } from '@/hooks/use-list-search-controller';

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

interface StatementsLocalState {
  committedSearch: string;
  setCommittedSearch: React.Dispatch<React.SetStateAction<string>>;
  type: string;
  setType: React.Dispatch<React.SetStateAction<string>>;
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  startDate?: string;
  setStartDate: React.Dispatch<React.SetStateAction<string | undefined>>;
  endDate?: string;
  setEndDate: React.Dispatch<React.SetStateAction<string | undefined>>;
}

type BuildParams = (
  overrides?: Partial<StatementsQueryParams>
) => StatementsQueryParams;

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

function buildStatementsURLParams(params: StatementsQueryParams) {
  const urlParams = new URLSearchParams();
  const normalizedSearch = normalizeSearch(params.search);

  if (normalizedSearch) {
    urlParams.set('search', normalizedSearch);
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

function buildStatementsParams(args: {
  initialParams: StatementsQueryParams;
  committedSearch: string;
  type: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  overrides?: Partial<StatementsQueryParams>;
}): StatementsQueryParams {
  const {
    initialParams,
    committedSearch,
    type,
    sortBy,
    sortOrder,
    startDate,
    endDate,
    overrides = {},
  } = args;

  return {
    page: overrides.page ?? initialParams.page,
    limit: overrides.limit ?? initialParams.limit,
    search: overrides.search ?? normalizeSearch(committedSearch),
    type: overrides.type ?? type,
    sortBy: overrides.sortBy ?? sortBy,
    sortOrder: overrides.sortOrder ?? sortOrder,
    startDate: overrides.startDate ?? startDate,
    endDate: overrides.endDate ?? endDate,
  };
}

function useStatementsLocalState(
  initialParams: StatementsQueryParams
): StatementsLocalState {
  const [committedSearch, setCommittedSearch] = React.useState(
    initialParams.search || ''
  );
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

  React.useEffect(() => {
    setCommittedSearch(initialParams.search || '');
    setType(initialParams.type || 'all');
    setSortBy(initialParams.sortBy || 'totalAmount');
    setSortOrder(initialParams.sortOrder || 'desc');
    setStartDate(initialParams.startDate);
    setEndDate(initialParams.endDate);
  }, [initialParams]);

  return {
    committedSearch,
    setCommittedSearch,
    type,
    setType,
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

function useStatementsSyncUrl() {
  const router = useRouter();

  const syncUrl = React.useCallback(
    (params: StatementsQueryParams) => {
      const queryString = buildStatementsURLParams(params).toString();

      router.replace(
        queryString
          ? `/finance/statements?${queryString}`
          : '/finance/statements',
        { scroll: false }
      );
    },
    [router]
  );

  return { router, syncUrl };
}

function useStatementsSearch(args: {
  initialParams: StatementsQueryParams;
  state: StatementsLocalState;
  syncUrl: (params: StatementsQueryParams) => void;
}) {
  const { initialParams, state, syncUrl } = args;
  const { committedSearch, setCommittedSearch, type, sortBy, sortOrder, startDate, endDate } =
    state;

  const buildParams = React.useCallback<BuildParams>(
    (overrides = {}) =>
      buildStatementsParams({
        initialParams,
        committedSearch,
        type,
        sortBy,
        sortOrder,
        startDate,
        endDate,
        overrides,
      }),
    [
      committedSearch,
      endDate,
      initialParams,
      sortBy,
      sortOrder,
      startDate,
      type,
    ]
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
      setCommittedSearch(search ?? '');
      syncUrl(buildParams({ search, page: 1 }));
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setCommittedSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput, setCommittedSearch]);

  return {
    buildParams,
    searchInput,
    isSearching,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
    syncPendingSearch,
  };
}

function useStatementsHandlers(args: {
  state: StatementsLocalState;
  buildParams: BuildParams;
  syncUrl: (params: StatementsQueryParams) => void;
  syncPendingSearch: () => string | undefined;
  handleSearchChange: (value: string) => void;
  handleClearFilters: () => void;
}) {
  const {
    state,
    buildParams,
    syncUrl,
    syncPendingSearch,
    handleSearchChange,
    handleClearFilters,
  } = args;
  const {
    type,
    sortBy,
    sortOrder,
    setType,
    setSortBy,
    setSortOrder,
    setStartDate,
    setEndDate,
  } = state;

  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const nextSearch = syncPendingSearch();
      const nextType = key === 'type' ? value || 'all' : type;
      const nextSortBy = key === 'sortBy' ? value || 'totalAmount' : sortBy;
      const nextSortOrder =
        key === 'sortOrder' ? (value as 'asc' | 'desc') || 'desc' : sortOrder;

      setType(nextType);
      setSortBy(nextSortBy);
      setSortOrder(nextSortOrder);
      syncUrl(
        buildParams({
          search: nextSearch,
          type: nextType,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
          page: 1,
        })
      );
    },
    [
      buildParams,
      setSortBy,
      setSortOrder,
      setType,
      sortBy,
      sortOrder,
      syncPendingSearch,
      syncUrl,
      type,
    ]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      const nextSearch = syncPendingSearch();
      const nextStartDate = range.startDate || undefined;
      const nextEndDate = range.endDate || undefined;

      setStartDate(nextStartDate);
      setEndDate(nextEndDate);
      syncUrl(
        buildParams({
          search: nextSearch,
          startDate: nextStartDate,
          endDate: nextEndDate,
          page: 1,
        })
      );
    },
    [buildParams, setEndDate, setStartDate, syncPendingSearch, syncUrl]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      const nextSearch = syncPendingSearch();
      syncUrl(buildParams({ search: nextSearch, page }));
    },
    [buildParams, syncPendingSearch, syncUrl]
  );

  return {
    handleSearch: handleSearchChange,
    handleFilter,
    handleDateRangeChange,
    handlePageChange,
    handleClearFilters,
  };
}

function useStatementsClearHandler(args: {
  state: StatementsLocalState;
  router: ReturnType<typeof useRouter>;
  cancelPendingCommit: () => void;
  setSearchInput: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { state, router, cancelPendingCommit, setSearchInput } = args;
  const { setCommittedSearch, setEndDate, setSortBy, setSortOrder, setStartDate, setType } =
    state;

  return React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');
    setType('all');
    setSortBy('totalAmount');
    setSortOrder('desc');
    setStartDate(undefined);
    setEndDate(undefined);
    router.replace('/finance/statements', { scroll: false });
  }, [
    cancelPendingCommit,
    router,
    setCommittedSearch,
    setEndDate,
    setSearchInput,
    setSortBy,
    setSortOrder,
    setStartDate,
    setType,
  ]);
}

export function useStatementsFilters({
  initialParams,
}: UseStatementsFiltersProps) {
  const state = useStatementsLocalState(initialParams);
  const { router, syncUrl } = useStatementsSyncUrl();
  const search = useStatementsSearch({
    initialParams,
    state,
    syncUrl,
  });
  const handleClearFilters = useStatementsClearHandler({
    state,
    router,
    cancelPendingCommit: search.cancelPendingCommit,
    setSearchInput: search.setSearchInput,
  });
  const handlers = useStatementsHandlers({
    state,
    buildParams: search.buildParams,
    syncUrl,
    syncPendingSearch: search.syncPendingSearch,
    handleSearchChange: search.handleSearchChange,
    handleClearFilters,
  });

  return {
    filters: {
      search: state.committedSearch,
      searchInput: search.searchInput,
      isSearching: search.isSearching,
      type: state.type,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      startDate: state.startDate,
      endDate: state.endDate,
    },
    handlers,
  };
}
