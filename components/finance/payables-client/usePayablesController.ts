'use client';

import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { usePayableRecords } from '@/lib/api/payables';
import type {
  PayableRecordDetail,
  PayableRecordQuery,
  PayableSourceType,
  PayableStatus,
} from '@/lib/types/payable';

const isValidSortField = (
  value: string | undefined
): value is PayableRecordQuery['sortBy'] =>
  value === 'createdAt' ||
  value === 'payableAmount' ||
  value === 'remainingAmount';

const areQueriesEqual = (a: PayableRecordQuery, b: PayableRecordQuery) =>
  a.page === b.page &&
  a.limit === b.limit &&
  a.search === b.search &&
  a.status === b.status &&
  a.sourceType === b.sourceType &&
  a.sortBy === b.sortBy &&
  a.sortOrder === b.sortOrder &&
  a.startDate === b.startDate &&
  a.endDate === b.endDate;

export interface UsePayablesControllerOptions {
  initialParams?: PayableRecordQuery;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
}

function useDerivedPayablesQuery(
  initialParams: PayableRecordQuery | undefined,
  searchParams: ReturnType<typeof useSearchParams>
): PayableRecordQuery {
  return React.useMemo<PayableRecordQuery>(() => {
    const rawPage =
      typeof initialParams?.page === 'number'
        ? initialParams.page
        : Number.parseInt(searchParams.get('page') || '1', 10);

    const rawLimit =
      typeof initialParams?.limit === 'number'
        ? initialParams.limit
        : Number.parseInt(searchParams.get('limit') || '20', 10);

    const rawSearch =
      typeof initialParams?.search === 'string'
        ? initialParams.search
        : (searchParams.get('search') ?? undefined);

    const rawStatus =
      initialParams?.status ??
      ((searchParams.get('status') as PayableStatus) || undefined);

    const rawSourceType =
      initialParams?.sourceType ??
      ((searchParams.get('sourceType') as PayableSourceType) || undefined);

    const sortByFromParams = searchParams.get('sortBy') || undefined;
    const rawSortBy =
      initialParams?.sortBy ??
      (isValidSortField(sortByFromParams) ? sortByFromParams : undefined);

    const rawSortOrder =
      initialParams?.sortOrder ??
      (searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc');

    const rawStartDate =
      initialParams?.startDate ?? searchParams.get('startDate') ?? undefined;
    const rawEndDate =
      initialParams?.endDate ?? searchParams.get('endDate') ?? undefined;

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;

    const normalizedSearch =
      typeof rawSearch === 'string' && rawSearch.trim().length > 0
        ? rawSearch.trim()
        : undefined;

    const sortBy = rawSortBy ?? 'createdAt';
    const sortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';

    return {
      page,
      limit,
      search: normalizedSearch,
      status: rawStatus,
      sourceType: rawSourceType,
      sortBy,
      sortOrder,
      startDate: rawStartDate || undefined,
      endDate: rawEndDate || undefined,
    };
  }, [initialParams, searchParams]);
}

function useHandleSearch(
  onSearch: UsePayablesControllerOptions['onSearch'],
  setQuery: React.Dispatch<React.SetStateAction<PayableRecordQuery>>
) {
  return React.useCallback(
    (search: string) => {
      const trimmed = search.trim();
      setQuery(prev => {
        const next: PayableRecordQuery = {
          ...prev,
          search: trimmed ? trimmed : undefined,
          page: 1,
        };
        return areQueriesEqual(prev, next) ? prev : next;
      });
      onSearch?.(search);
    },
    [onSearch, setQuery]
  );
}

function useHandleFilterChange(
  onFilter: UsePayablesControllerOptions['onFilter'],
  setQuery: React.Dispatch<React.SetStateAction<PayableRecordQuery>>
) {
  return React.useCallback(
    (key: string, value: string | undefined) => {
      setQuery(prev => {
        const next: PayableRecordQuery = { ...prev };
        let changed = false;

        if (key === 'status') {
          const nextStatus =
            value === 'all' || !value ? undefined : (value as PayableStatus);
          if (next.status !== nextStatus) {
            next.status = nextStatus;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'sourceType') {
          const nextSource =
            value === 'all' || !value
              ? undefined
              : (value as PayableSourceType);
          if (next.sourceType !== nextSource) {
            next.sourceType = nextSource;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'sortBy') {
          const nextSort = isValidSortField(value) ? value : 'createdAt';
          if (next.sortBy !== nextSort) {
            next.sortBy = nextSort;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'sortOrder') {
          const nextOrder = value === 'asc' ? 'asc' : 'desc';
          if (next.sortOrder !== nextOrder) {
            next.sortOrder = nextOrder;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'limit') {
          const parsed = value ? Number.parseInt(value, 10) : NaN;
          if (Number.isFinite(parsed) && parsed > 0 && next.limit !== parsed) {
            next.limit = parsed;
            next.page = 1;
            changed = true;
          }
        } else {
          return prev;
        }

        if (!changed) return prev;
        return next;
      });
      onFilter?.(key, value);
    },
    [onFilter, setQuery]
  );
}

function useHandleDateRangeChange(
  onDateRangeChange: UsePayablesControllerOptions['onDateRangeChange'],
  setQuery: React.Dispatch<React.SetStateAction<PayableRecordQuery>>
) {
  return React.useCallback(
    (range: DateRangeValue) => {
      setQuery(prev => {
        const next: PayableRecordQuery = {
          ...prev,
          startDate: range.startDate,
          endDate: range.endDate,
          page: 1,
        };
        return areQueriesEqual(prev, next) ? prev : next;
      });
      onDateRangeChange?.(range);
    },
    [onDateRangeChange, setQuery]
  );
}

function useHandlePageChange(
  onPageChange: UsePayablesControllerOptions['onPageChange'],
  setQuery: React.Dispatch<React.SetStateAction<PayableRecordQuery>>
) {
  return React.useCallback(
    (newPage: number) => {
      setQuery(prev =>
        prev.page === newPage ? prev : { ...prev, page: newPage }
      );
      if (onPageChange) {
        onPageChange(newPage);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [onPageChange, setQuery]
  );
}

export function usePayablesController(options: UsePayablesControllerOptions) {
  const { initialParams, onSearch, onFilter, onDateRangeChange, onPageChange } =
    options;
  const searchParams = useSearchParams();

  const derivedQuery = useDerivedPayablesQuery(initialParams, searchParams);

  const [query, setQuery] = React.useState<PayableRecordQuery>(derivedQuery);

  React.useEffect(() => {
    setQuery(prev =>
      areQueriesEqual(prev, derivedQuery) ? prev : derivedQuery
    );
  }, [derivedQuery]);

  const { data: payablesData, isLoading } = usePayableRecords(query);
  const payables: PayableRecordDetail[] = payablesData?.data ?? [];
  const pagination = payablesData?.pagination;

  // Handlers
  const handleSearch = useHandleSearch(onSearch, setQuery);

  const handleFilterChange = useHandleFilterChange(onFilter, setQuery);

  const handleDateRangeChange = useHandleDateRangeChange(
    onDateRangeChange,
    setQuery
  );

  const handlePageChange = useHandlePageChange(onPageChange, setQuery);

  return {
    query,
    setQuery,
    payables,
    pagination,
    isLoading,
    handleSearch,
    handleFilterChange,
    handleDateRangeChange,
    handlePageChange,
  } as const;
}
