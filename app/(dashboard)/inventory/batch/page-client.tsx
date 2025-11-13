'use client';

import { PackageSearch, Plus, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  useBatchSpecifications,
  useCreateBatchSpecification,
  useDeleteBatchSpecification,
  useUpdateBatchSpecification,
} from '@/lib/api/batch-specifications';
import type {
  BatchSpecification,
  BatchSpecificationListResponse,
  BatchSpecificationQueryParams,
  CreateBatchSpecificationRequest,
} from '@/lib/types/batch-specification';

import { BatchRecordsFilters } from './components/BatchRecordsFilters';
import { BatchSpecificationForm } from './components/BatchSpecificationForm';
import { BatchSpecificationsTable } from './components/BatchSpecificationsTable';

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
  const { toast } = useToast();

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

  const createMutation = useCreateBatchSpecification();
  const updateMutation = useUpdateBatchSpecification();
  const deleteMutation = useDeleteBatchSpecification();

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

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleFormSubmit = async (values: CreateBatchSpecificationRequest) => {
    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(values);
        toast({
          title: '创建成功',
          description: '批次规格参数已创建并同步至库存。',
          variant: 'success',
        });
      } else if (editingSpec) {
        await updateMutation.mutateAsync({
          id: editingSpec.id,
          data: {
            piecesPerUnit: values.piecesPerUnit,
            weight: values.weight,
            thickness: values.thickness,
          },
        });
        toast({
          title: '更新成功',
          description: '批次规格参数已更新。',
          variant: 'success',
        });
      }
      setShowForm(false);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : '操作失败，请稍后重试';
      toast({
        title: '操作失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSpec) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deletingSpec.id);
      toast({
        title: '删除成功',
        description: `批次 ${deletingSpec.batchNumber} 已删除。`,
        variant: 'success',
      });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : '删除失败，请稍后重试';
      toast({
        title: '删除失败',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingSpec(null);
    }
  };

  const handlePageChange = (page: number) => {
    updateParams({ page });
  };

  const handleRefresh = () => {
    router.refresh();
  };

  if (error) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <PageHeader
            title="批次管理"
            description="管理产品的批次规格参数，维护库存批次信息"
            icon={<PackageSearch className="h-6 w-6 text-white" />}
            iconBgColor="hsl(var(--color-primary))"
            actions={
              <Button
                variant="outline"
                size="lg"
                className="h-11 gap-2"
                onClick={handleRefresh}
              >
                <RefreshCcw className="h-4 w-4" />
                重新加载
              </Button>
            }
          />
          <div className="text-muted-foreground rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-6 text-center text-sm">
            加载批次规格数据时发生错误，请稍后重试。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <PageHeader
          title="批次管理"
          description="管理每个产品批次的规格参数，确保库存数据准确"
          icon={<PackageSearch className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <Button
              size="lg"
              className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              onClick={handleCreate}
            >
              <Plus className="h-4 w-4" />
              新建批次规格
            </Button>
          }
        />

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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? '新建批次规格' : '编辑批次规格'}
            </DialogTitle>
          </DialogHeader>
          <BatchSpecificationForm
            mode={formMode}
            defaultValues={
              editingSpec
                ? {
                    productId: editingSpec.productId,
                    productName: editingSpec.product?.name,
                    productCode: editingSpec.product?.code,
                    batchNumber: editingSpec.batchNumber,
                    piecesPerUnit: editingSpec.piecesPerUnit,
                    weight: editingSpec.weight ?? undefined,
                    thickness: editingSpec.thickness ?? undefined,
                  }
                : undefined
            }
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingSpec)}
        onOpenChange={open => {
          if (!open) {
            setDeletingSpec(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除批次规格？</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSpec
                ? `批次 ${deletingSpec.batchNumber} 删除后，将无法恢复。`
                : '确认删除该批次规格参数吗？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
