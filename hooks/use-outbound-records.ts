'use client';

import { useQuery } from '@tanstack/react-query';
import React from 'react';

import {
  INVENTORY_ACTIVITY_GC_TIME_MS,
  INVENTORY_ACTIVITY_STALE_TIME_MS,
} from '@/lib/constants/cache';
import { queryKeys } from '@/lib/queryKeys';
import type {
  OutboundRecord,
  OutboundRecordQueryParams,
  OutboundType,
} from '@/lib/types/inventory';

interface OutboundFilters {
  startDate: string;
  endDate: string;
  type: OutboundType | '';
  search?: string;
}

const DEFAULT_QUERY_PARAMS: OutboundRecordQueryParams = {
  page: 1,
  limit: 50,
};

function normalizeQueryParams(
  params: OutboundRecordQueryParams
): OutboundRecordQueryParams {
  const next: OutboundRecordQueryParams = { ...params };

  if (!next.page || next.page < 1) {
    next.page = DEFAULT_QUERY_PARAMS.page;
  }

  if (!next.limit || next.limit < 1) {
    next.limit = DEFAULT_QUERY_PARAMS.limit;
  }

  return next;
}

function serializeForKey(
  params: OutboundRecordQueryParams
): OutboundRecordQueryParams {
  const serialized: OutboundRecordQueryParams = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    serialized[key as keyof OutboundRecordQueryParams] = value;
  });

  return serialized;
}

function normalizeFilterValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function useOutboundRecords(
  initialParams: OutboundRecordQueryParams = DEFAULT_QUERY_PARAMS
) {
  const mergedInitial = React.useMemo(
    () => normalizeQueryParams({ ...DEFAULT_QUERY_PARAMS, ...initialParams }),
    [initialParams]
  );

  const defaultParamsRef = React.useRef(mergedInitial);
  const [queryParams, setQueryParams] =
    React.useState<OutboundRecordQueryParams>(mergedInitial);

  React.useEffect(() => {
    const next = normalizeQueryParams({ ...mergedInitial });
    defaultParamsRef.current = next;
    setQueryParams(next);
  }, [mergedInitial]);

  const keyParams = React.useMemo(
    () => serializeForKey(queryParams),
    [queryParams]
  );

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.inventory.outboundsList(keyParams),
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      Object.entries(keyParams).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });

      const response = await fetch(
        `/api/inventory/outbound?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取出库记录失败');
      }

      const result = await response.json();

      if (result.data && result.pagination) {
        return {
          data: result.data as OutboundRecord[],
          pagination: result.pagination,
        };
      }

      if (!result.success) {
        throw new Error(result.error || '获取出库记录失败');
      }

      return {
        data: (result.data as OutboundRecord[]) ?? [],
        pagination: result.pagination,
      };
    },
    staleTime: INVENTORY_ACTIVITY_STALE_TIME_MS,
    gcTime: INVENTORY_ACTIVITY_GC_TIME_MS,
    refetchOnWindowFocus: true,
    placeholderData: previousData => previousData,
  });

  const outboundRecords = data?.data || [];
  const isInitialLoading = isLoading && !data;
  const isListRefreshing = !isInitialLoading && isFetching;

  const filters: OutboundFilters = {
    startDate: (queryParams.startDate as string) || '',
    endDate: (queryParams.endDate as string) || '',
    type: (queryParams.type as OutboundType | '') || '',
    search: queryParams.search || '',
  };

  const resetFilters = () => {
    setQueryParams({ ...defaultParamsRef.current });
  };

  const updateFilter = (key: keyof OutboundFilters, value: string) => {
    const normalized = normalizeFilterValue(value);

    setQueryParams(prev => ({
      ...prev,
      [key]:
        normalized as OutboundRecordQueryParams[keyof OutboundRecordQueryParams],
      page: 1,
    }));
  };

  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({
      ...prev,
      page,
    }));
  };

  return {
    outboundRecords,
    pagination: data?.pagination,
    filters,
    isLoading,
    isFetching,
    isInitialLoading,
    isListRefreshing,
    error,
    resetFilters,
    updateFilter,
    onPageChange: handlePageChange,
  };
}
