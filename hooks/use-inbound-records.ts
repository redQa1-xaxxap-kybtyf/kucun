'use client';

import React from 'react';

import { useInboundRecords } from '@/lib/api/inbound';
import type { InboundQueryParams } from '@/lib/types/inbound';

const DEFAULT_QUERY_PARAMS: InboundQueryParams = {
  page: 1,
  limit: 50,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

function normalizeValue(
  key: keyof InboundQueryParams,
  value: string | number | boolean | undefined
): InboundQueryParams[keyof InboundQueryParams] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined as InboundQueryParams[keyof InboundQueryParams];
    }

    if (key === 'page' || key === 'limit') {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed)
        ? (parsed as InboundQueryParams[keyof InboundQueryParams])
        : (undefined as InboundQueryParams[keyof InboundQueryParams]);
    }

    return trimmed as InboundQueryParams[keyof InboundQueryParams];
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? (value as InboundQueryParams[keyof InboundQueryParams])
      : (undefined as InboundQueryParams[keyof InboundQueryParams]);
  }

  return value as InboundQueryParams[keyof InboundQueryParams];
}

export function useInboundRecordsState(
  initialParams: InboundQueryParams = DEFAULT_QUERY_PARAMS
) {
  const mergedInitial = React.useMemo<InboundQueryParams>(
    () => ({
      ...DEFAULT_QUERY_PARAMS,
      ...initialParams,
    }),
    [initialParams]
  );

  const [queryParams, setQueryParams] = React.useState<InboundQueryParams>(mergedInitial);

  React.useEffect(() => {
    setQueryParams(mergedInitial);
  }, [mergedInitial]);

  const { data, isLoading, error } = useInboundRecords(queryParams);
  const inboundRecords = data?.data || [];

  const handleFilter = (
    key: keyof InboundQueryParams,
    value: string | number | boolean | undefined
  ) => {
    const normalizedValue = normalizeValue(key, value);

    setQueryParams(prev => ({
      ...prev,
      [key]: normalizedValue,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setQueryParams({ ...DEFAULT_QUERY_PARAMS });
  };

  return {
    queryParams,
    inboundRecords,
    isLoading,
    error,
    handleFilter,
    handleResetFilters,
  };
}

