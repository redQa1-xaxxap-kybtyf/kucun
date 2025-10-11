/**
 * 库存调整记录管理Hook
 * 管理调整记录的查询、筛选和分页
 */

import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { getAdjustmentQueryOptions } from '@/lib/api/adjustments';
import type {
  AdjustmentQueryParams,
  InventoryAdjustment,
} from '@/lib/types/inventory';

const DEFAULT_QUERY_PARAMS: AdjustmentQueryParams = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

function normalizeQueryParams(
  params: AdjustmentQueryParams
): AdjustmentQueryParams {
  const next: AdjustmentQueryParams = { ...params };

  if (!next.page || next.page < 1) {
    next.page = DEFAULT_QUERY_PARAMS.page;
  }

  if (!next.limit || next.limit < 1) {
    next.limit = DEFAULT_QUERY_PARAMS.limit;
  }

  if (typeof next.search === 'string' && next.search.trim() === '') {
    delete next.search;
  }

  (['productId', 'variantId', 'batchNumber', 'reason', 'status', 'operatorId', 'startDate', 'endDate'] as const).forEach(
    key => {
      const value = next[key];
      if (typeof value === 'string' && value.trim() === '') {
        delete next[key];
      }
    }
  );

  return next;
}

function sanitizePartialParams(
  params: Partial<AdjustmentQueryParams>
): Partial<AdjustmentQueryParams> {
  const sanitized: Record<string, unknown> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      sanitized[key] = trimmed === '' ? undefined : trimmed;
      return;
    }

    sanitized[key] = value;
  });

  return sanitized as Partial<AdjustmentQueryParams>;
}

export function useAdjustmentRecords(
  initialParams: AdjustmentQueryParams = DEFAULT_QUERY_PARAMS
) {
  const mergedInitial = React.useMemo(
    () => normalizeQueryParams({ ...DEFAULT_QUERY_PARAMS, ...initialParams }),
    [initialParams]
  );

  const defaultParamsRef = React.useRef(mergedInitial);

  const [queryParams, setQueryParams] =
    React.useState<AdjustmentQueryParams>(mergedInitial);
  const [selectedAdjustment, setSelectedAdjustment] =
    React.useState<InventoryAdjustment | null>(null);
  const [showDetailDialog, setShowDetailDialog] = React.useState(false);

  React.useEffect(() => {
    const next = normalizeQueryParams({ ...mergedInitial });
    defaultParamsRef.current = next;
    setQueryParams(next);
  }, [mergedInitial]);

  const { data, isLoading, error, refetch } = useQuery(
    getAdjustmentQueryOptions(queryParams)
  );

  const adjustments = data?.adjustments || [];
  const pagination = data?.pagination || {
    page: queryParams.page ?? DEFAULT_QUERY_PARAMS.page!,
    limit: queryParams.limit ?? DEFAULT_QUERY_PARAMS.limit!,
    total: 0,
    totalPages: 0,
  };

  const updateQueryParams = (newParams: Partial<AdjustmentQueryParams>) => {
    const sanitized = sanitizePartialParams(newParams);

    setQueryParams(prev =>
      normalizeQueryParams({
        ...prev,
        ...sanitized,
      })
    );
  };

  const resetFilters = () => {
    setQueryParams({ ...defaultParamsRef.current });
  };

  const handlePageChange = (page: number) => {
    updateQueryParams({ page });
  };

  const handlePageSizeChange = (limit: number) => {
    updateQueryParams({ page: 1, limit });
  };

  const handleSortChange = (
    sortBy: AdjustmentQueryParams['sortBy'],
    sortOrder: 'asc' | 'desc'
  ) => {
    updateQueryParams({ sortBy, sortOrder, page: 1 });
  };

  const viewDetail = (adjustment: InventoryAdjustment) => {
    setSelectedAdjustment(adjustment);
    setShowDetailDialog(true);
  };

  const closeDetailDialog = () => {
    setShowDetailDialog(false);
    setSelectedAdjustment(null);
  };

  return {
    adjustments,
    pagination,
    isLoading,
    error,
    queryParams,
    selectedAdjustment,
    showDetailDialog,
    updateQueryParams,
    resetFilters,
    handlePageChange,
    handlePageSizeChange,
    handleSortChange,
    viewDetail,
    closeDetailDialog,
    refetch,
  };
}

