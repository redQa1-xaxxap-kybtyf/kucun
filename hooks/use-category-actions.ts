'use client';

/**
 * 分类操作自定义Hook
 * 严格遵循全栈项目统一约定规范
 */

import type { UseMutationResult } from '@tanstack/react-query';
import {
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from 'next/navigation';
import React from 'react';

import type { Category, CategoryQueryParams } from '@/lib/api/categories';
import { paginationConfig } from '@/lib/env';

interface DeleteDialogState {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
}

type UpdateStatusVariables = {
  id: string;
  status: 'active' | 'inactive';
};

type NormalizedCategoryQueryParams = Required<
  Pick<
    CategoryQueryParams,
    'page' | 'limit' | 'search' | 'sortBy' | 'sortOrder'
  >
> &
  Pick<CategoryQueryParams, 'status' | 'parentId'>;

const DEFAULT_QUERY_PARAMS: Required<
  Pick<
    CategoryQueryParams,
    'page' | 'limit' | 'search' | 'sortBy' | 'sortOrder'
  >
> = {
  page: 1,
  // 与服务端分类页保持一致：默认一次性取回完整层级，避免父级缺失后子级被误显示为“跑位”
  limit: paginationConfig.maxPageSize,
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const SORT_BY_VALUES = new Set<CategoryQueryParams['sortBy']>([
  'name',
  'code',
  'sortOrder',
  'createdAt',
]);

function parseNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: string | null): CategoryQueryParams['status'] {
  if (value === 'active' || value === 'inactive') {
    return value;
  }
  return undefined;
}

function parseSortBy(value: string | null): CategoryQueryParams['sortBy'] {
  if (value && SORT_BY_VALUES.has(value as CategoryQueryParams['sortBy'])) {
    return value as CategoryQueryParams['sortBy'];
  }
  return DEFAULT_QUERY_PARAMS.sortBy;
}

function parseSortOrder(
  value: string | null
): Required<Pick<CategoryQueryParams, 'sortOrder'>>['sortOrder'] {
  return value === 'asc' ? 'asc' : 'desc';
}

function parseQueryParams(
  searchParams: ReadonlyURLSearchParams
): CategoryQueryParams {
  return {
    page: parseNumber(searchParams.get('page'), DEFAULT_QUERY_PARAMS.page),
    limit: parseNumber(searchParams.get('limit'), DEFAULT_QUERY_PARAMS.limit),
    search: searchParams.get('search') ?? DEFAULT_QUERY_PARAMS.search,
    status: parseStatus(searchParams.get('status')),
    sortBy: parseSortBy(searchParams.get('sortBy')),
    sortOrder: parseSortOrder(searchParams.get('sortOrder')),
    parentId: searchParams.get('parentId') || undefined,
  };
}

function normalizeCategoryQueryParams(
  params: CategoryQueryParams
): NormalizedCategoryQueryParams {
  return {
    page: params.page ?? DEFAULT_QUERY_PARAMS.page,
    limit: params.limit ?? DEFAULT_QUERY_PARAMS.limit,
    search: params.search ?? DEFAULT_QUERY_PARAMS.search,
    sortBy: params.sortBy ?? DEFAULT_QUERY_PARAMS.sortBy,
    sortOrder: params.sortOrder ?? DEFAULT_QUERY_PARAMS.sortOrder,
    status: params.status,
    parentId: params.parentId,
  };
}

function areCategoryQueryParamsEqual(
  a: CategoryQueryParams,
  b: CategoryQueryParams
): boolean {
  const normalizedA = normalizeCategoryQueryParams(a);
  const normalizedB = normalizeCategoryQueryParams(b);

  return (
    normalizedA.page === normalizedB.page &&
    normalizedA.limit === normalizedB.limit &&
    normalizedA.search === normalizedB.search &&
    normalizedA.sortBy === normalizedB.sortBy &&
    normalizedA.sortOrder === normalizedB.sortOrder &&
    normalizedA.status === normalizedB.status &&
    normalizedA.parentId === normalizedB.parentId
  );
}

interface UseCategoryActionsProps {
  queryParams: CategoryQueryParams;
  setQueryParams: React.Dispatch<React.SetStateAction<CategoryQueryParams>>;
  deleteDialog: DeleteDialogState;
  setDeleteDialog: React.Dispatch<React.SetStateAction<DeleteDialogState>>;
  setUpdatingStatusId: React.Dispatch<React.SetStateAction<string | null>>;
  statusMutation: UseMutationResult<
    unknown,
    Error,
    UpdateStatusVariables,
    unknown
  >;
  deleteMutation: UseMutationResult<unknown, Error, string, unknown>;
}

export function useCategoryActions({
  queryParams,
  setQueryParams,
  deleteDialog,
  setDeleteDialog,
  setUpdatingStatusId,
  statusMutation,
  deleteMutation,
}: UseCategoryActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 同步URL参数
  React.useEffect(() => {
    const parsedParams = parseQueryParams(searchParams);

    setQueryParams(prev =>
      areCategoryQueryParamsEqual(prev, parsedParams) ? prev : parsedParams
    );
  }, [searchParams, setQueryParams]);

  const updateURL = React.useCallback(
    (partialParams: Partial<CategoryQueryParams>) => {
      const mergedParams: CategoryQueryParams = {
        ...DEFAULT_QUERY_PARAMS,
        ...queryParams,
        ...partialParams,
      };

      if (areCategoryQueryParamsEqual(queryParams, mergedParams)) {
        return;
      }

      setQueryParams(prev =>
        areCategoryQueryParamsEqual(prev, mergedParams) ? prev : mergedParams
      );

      const params = new URLSearchParams();

      if (
        mergedParams.page &&
        mergedParams.page !== DEFAULT_QUERY_PARAMS.page
      ) {
        params.set('page', String(mergedParams.page));
      }

      if (
        mergedParams.limit &&
        mergedParams.limit !== DEFAULT_QUERY_PARAMS.limit
      ) {
        params.set('limit', String(mergedParams.limit));
      }

      if (mergedParams.search && mergedParams.search.length > 0) {
        params.set('search', mergedParams.search);
      }

      if (mergedParams.status) {
        params.set('status', mergedParams.status);
      }

      if (
        mergedParams.sortBy &&
        mergedParams.sortBy !== DEFAULT_QUERY_PARAMS.sortBy
      ) {
        params.set('sortBy', mergedParams.sortBy);
      }

      if (
        mergedParams.sortOrder &&
        mergedParams.sortOrder !== DEFAULT_QUERY_PARAMS.sortOrder
      ) {
        params.set('sortOrder', mergedParams.sortOrder);
      }

      if (mergedParams.parentId) {
        params.set('parentId', mergedParams.parentId);
      }

      const search = params.toString();
      router.replace(search ? `/categories?${search}` : '/categories', {
        scroll: false,
      });
    },
    [queryParams, router, setQueryParams]
  );

  const handleSearch = React.useCallback(
    (search: string) => {
      updateURL({ search, page: 1 });
    },
    [updateURL]
  );

  const handleFilter = React.useCallback(
    <K extends keyof CategoryQueryParams>(
      key: K,
      value: CategoryQueryParams[K]
    ) => {
      updateURL({ [key]: value, page: 1 });
    },
    [updateURL]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      updateURL({ page });
    },
    [updateURL]
  );

  const handleDeleteCategory = React.useCallback(
    (categoryId: string, categoryName: string) => {
      setDeleteDialog({ open: true, categoryId, categoryName });
    },
    [setDeleteDialog]
  );

  const confirmDelete = React.useCallback(() => {
    const categoryId = deleteDialog.categoryId;
    if (categoryId) {
      deleteMutation.mutate(categoryId);
    }
  }, [deleteDialog.categoryId, deleteMutation]);

  const toggleCategoryStatus = React.useCallback(
    (category: Category) => {
      setUpdatingStatusId(category.id);
      const newStatus: UpdateStatusVariables['status'] =
        category.status === 'active' ? 'inactive' : 'active';
      statusMutation.mutate({ id: category.id, status: newStatus });
    },
    [setUpdatingStatusId, statusMutation]
  );

  return {
    handleSearch,
    handleFilter,
    handlePageChange,
    handleDeleteCategory,
    confirmDelete,
    toggleCategoryStatus,
  };
}
