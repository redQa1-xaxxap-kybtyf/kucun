'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BatchPageHeader } from '@/components/inventory/batch-page-header';
import { useBatchSpecifications } from '@/lib/api/batch-specifications';
import type {
  BatchSpecification,
  BatchSpecificationListResponse,
  BatchSpecificationQueryParams,
} from '@/lib/types/batch-specification';

import { BatchRecordsFilters } from './components/BatchRecordsFilters';

const BatchSpecificationDialogs = dynamic(
  () =>
    import('./components/BatchSpecificationDialogs').then(
      mod => mod.BatchSpecificationDialogs
    ),
  {
    ssr: false,
    loading: () => null,
  }
);

const BatchSpecificationsTable = dynamic(
  () =>
    import('./components/BatchSpecificationsTable').then(
      mod => mod.BatchSpecificationsTable
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-6 text-sm">
        列表加载中...
      </div>
    ),
  }
);

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT_BY: NonNullable<BatchSpecificationQueryParams['sortBy']> =
  'createdAt';
const DEFAULT_SORT_ORDER: NonNullable<
  BatchSpecificationQueryParams['sortOrder']
> = 'desc';

type ResolvedParams = Required<
  Pick<BatchSpecificationQueryParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
> &
  Omit<
    BatchSpecificationQueryParams,
    'page' | 'limit' | 'sortBy' | 'sortOrder'
  >;

interface BatchSpecificationPageClientProps {
  initialParams: ResolvedParams;
  initialData: BatchSpecificationListResponse;
}

function buildSearchParams(params: ResolvedParams) {
  const searchParams = new URLSearchParams();

  if (params.page && params.page !== DEFAULT_PAGE) {
    searchParams.set('page', String(params.page));
  }
  if (params.limit && params.limit !== DEFAULT_LIMIT) {
    searchParams.set('limit', String(params.limit));
  }
  if (params.search) {
    searchParams.set('search', params.search);
  }
  if (params.productId) {
    searchParams.set('productId', params.productId);
  }
  if (params.batchNumber) {
    searchParams.set('batchNumber', params.batchNumber);
  }
  if (params.sortBy && params.sortBy !== DEFAULT_SORT_BY) {
    searchParams.set('sortBy', params.sortBy);
  }
  if (params.sortOrder && params.sortOrder !== DEFAULT_SORT_ORDER) {
    searchParams.set('sortOrder', params.sortOrder);
  }

  return searchParams;
}

export function BatchSpecificationPageClient({
  initialParams,
  initialData,
}: BatchSpecificationPageClientProps) {
  const router = useRouter();

  const [queryParams, setQueryParams] = useState<ResolvedParams>(initialParams);
  const [_searchValue, _setSearchValue] = useState(initialParams.search ?? '');
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingSpec, setEditingSpec] = useState<BatchSpecification | null>(
    null
  );
  const [deletingSpec, setDeletingSpec] = useState<BatchSpecification | null>(
    null
  );

  const updateParams = useCallback(
    (
      updater:
        | Partial<ResolvedParams>
        | ((prev: ResolvedParams) => ResolvedParams)
    ) => {
      setQueryParams(prev => {
        const next =
          typeof updater === 'function'
            ? updater(prev)
            : { ...prev, ...updater };
        const normalized: ResolvedParams = {
          page: next.page ?? DEFAULT_PAGE,
          limit: next.limit ?? DEFAULT_LIMIT,
          sortBy: next.sortBy ?? DEFAULT_SORT_BY,
          sortOrder: next.sortOrder ?? DEFAULT_SORT_ORDER,
          search: next.search?.trim() || undefined,
          productId: next.productId?.trim() || undefined,
          batchNumber: next.batchNumber?.trim() || undefined,
        };
        return normalized;
      });
    },
    []
  );

  const initialQueryStringRef = useRef(
    buildSearchParams(initialParams).toString()
  );
  const hasSyncedRef = useRef(false);

  const currentQueryString = useMemo(
    () => buildSearchParams(queryParams).toString(),
    [queryParams]
  );

  useEffect(() => {
    const targetUrl = currentQueryString
      ? `/inventory/batch?${currentQueryString}`
      : '/inventory/batch';

    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      if (currentQueryString === initialQueryStringRef.current) {
        return;
      }
    }

    router.replace(targetUrl, { scroll: false });
  }, [currentQueryString, router]);

  const { data, isLoading, isFetching, error } =
    useBatchSpecifications(queryParams);

  const response = data ?? initialData;
  const specifications = response?.data ?? [];
  const pagination = response?.pagination ?? {
    page: queryParams.page,
    limit: queryParams.limit,
    total: specifications.length,
    totalPages: 1,
  };

  const handleResetFilters = () => {
    _setSearchValue('');
    updateParams({
      page: DEFAULT_PAGE,
      search: undefined,
      productId: undefined,
      batchNumber: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const handleFiltersChange = (
    filters: Partial<BatchSpecificationQueryParams>
  ) => {
    if (filters.search !== undefined) {
      _setSearchValue(filters.search || '');
    }
    updateParams(filters);
  };

  const handleCreate = () => {
    setFormMode('create');
    setEditingSpec(null);
    setShowForm(true);
  };

  const handleEdit = (spec: BatchSpecification) => {
    setFormMode('edit');
    setEditingSpec(spec);
    setShowForm(true);
  };

  const handleDeleteRequest = (spec: BatchSpecification) => {
    setDeletingSpec(spec);
  };

  const handlePageChange = (page: number) => {
    updateParams({ page });
  };

  const handleRefresh = () => {
    router.refresh();
  };

  if (error) {
    return (
      <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
        <div className="space-y-6">
          <BatchPageHeader
            isError
            onRefresh={handleRefresh}
            onCreate={handleCreate}
          />
          <div className="text-muted-foreground rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-6 text-center text-sm">
            加载批次规格数据时发生错误，请稍后重试。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-6">
        <BatchPageHeader onCreate={handleCreate} />

        <BatchRecordsFilters
          filters={queryParams}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
        />

        <BatchSpecificationsTable
          data={specifications}
          pagination={pagination}
          isLoading={isLoading}
          isFetching={isFetching}
          onPageChange={handlePageChange}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
        />
      </div>

      <BatchSpecificationDialogs
        showForm={showForm}
        setShowForm={setShowForm}
        formMode={formMode}
        editingSpec={editingSpec}
        deletingSpec={deletingSpec}
        setDeletingSpec={setDeletingSpec}
      />
    </div>
  );
}
