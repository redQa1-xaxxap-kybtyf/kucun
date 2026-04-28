'use client';

/**
 * 供应商管理页面客户端组件
 * 严格遵循全栈项目统一约定规范
 * 职责：处理用户交互、状态管理、TanStack Query 数据管理
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  Clock,
  Loader2,
  MapPin,
  Plus,
  TrendingUp,
  Truck,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/layouts/filter-bar';
import { PageContainer } from '@/components/layouts/page-container';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/use-toast';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  deleteSupplier,
  getSuppliers,
  supplierQueryKeys,
} from '@/lib/api/suppliers';
import { SEARCH_CONFIG } from '@/lib/config/search';
import type { Supplier, SupplierQueryParams } from '@/lib/types/supplier';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';
import { formatSupplierStatus } from '@/lib/utils/supplier-display';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

interface SuppliersPageClientProps {
  initialParams: {
    page: number;
    limit: number;
    search?: string;
    status?: Supplier['status'];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

const SupplierRowActions = dynamic(
  () => import('./SupplierRowActions').then(mod => mod.SupplierRowActions),
  {
    ssr: false,
    loading: () => <div className="h-10 w-10" />,
  }
);

const SupplierDeleteDialog = dynamic(
  () => import('./SupplierDeleteDialog').then(mod => mod.SupplierDeleteDialog),
  { ssr: false }
);

export function SuppliersPageClient({
  initialParams,
}: SuppliersPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 本地状态
  const [committedSearch, setCommittedSearch] = useState(
    initialParams.search || ''
  );
  const [status, setStatus] = useState<Supplier['status'] | undefined>(
    initialParams.status
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null
  );

  useEffect(() => {
    setCommittedSearch(initialParams.search || '');
    setStatus(initialParams.status);
  }, [initialParams]);

  const queryParams = useMemo(() => {
    const normalizedSearch =
      typeof initialParams.search === 'string' && initialParams.search.trim()
        ? initialParams.search.trim()
        : undefined;

    const allowedSortFields: SupplierQueryParams['sortBy'][] = [
      'name',
      'createdAt',
      'updatedAt',
    ];

    const safeSortBy = allowedSortFields.includes(
      initialParams.sortBy as SupplierQueryParams['sortBy']
    )
      ? (initialParams.sortBy as SupplierQueryParams['sortBy'])
      : 'createdAt';

    return {
      page: initialParams.page ?? 1,
      limit: initialParams.limit ?? 20,
      search: normalizedSearch,
      status: initialParams.status,
      sortBy: safeSortBy,
      sortOrder: initialParams.sortOrder === 'asc' ? 'asc' : 'desc',
    } satisfies SupplierQueryParams;
  }, [initialParams]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: supplierQueryKeys.list(queryParams),
    queryFn: () => getSuppliers(queryParams),
    placeholderData: keepPreviousData => keepPreviousData,
    staleTime: SEARCH_CONFIG.CACHE.STALE_TIME,
  });

  const suppliers = data?.data ?? [];
  const pagination = data?.pagination;
  const isListRefreshing = !isLoading && isFetching;

  const syncUrl = useCallback(
    ({
      search,
      status: nextStatus,
      page,
    }: {
      search?: string;
      status?: Supplier['status'];
      page?: number;
    }) => {
      const params = new URLSearchParams();

      if (search) {
        params.set('search', search);
      }
      if (nextStatus) {
        params.set('status', nextStatus);
      }
      if (page && page > 1) {
        params.set('page', String(page));
      }

      const queryString = params.toString();
      router.replace(queryString ? `/suppliers?${queryString}` : '/suppliers', {
        scroll: false,
      });
    },
    [router]
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
      syncUrl({
        search,
        status,
      });
    },
    debounceMs: SEARCH_CONFIG.DEBOUNCE_DELAY.DEFAULT,
  });

  const syncPendingSearch = useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setCommittedSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  // 删除供应商
  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: data => {
      toast({
        title: '删除成功',
        description: data.message || '供应商删除成功',
        variant: 'success',
      });
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除供应商后立即看到变化
      queryClient.refetchQueries({
        queryKey: supplierQueryKeys.lists(),
        type: 'active',
      });
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: error => {
      toast({
        title: '删除失败',
        description: getFriendlyErrorMessage(
          error,
          '这位供应商暂时无法删除，请稍后重试'
        ),
        variant: 'destructive',
      });
    },
  });

  // 处理搜索
  const handleStatusChange = useCallback(
    (value: Supplier['status'] | undefined) => {
      setStatus(value);
      syncUrl({
        search: syncPendingSearch(),
        status: value,
      });
    },
    [syncPendingSearch, syncUrl]
  );

  // 处理分页
  const handlePageChange = useCallback(
    (page: number) => {
      syncUrl({
        search: syncPendingSearch(),
        status,
        page,
      });
    },
    [status, syncPendingSearch, syncUrl]
  );

  // 处理删除
  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handleClearFilters = useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');
    setStatus(undefined);
    router.replace('/suppliers', { scroll: false });
  }, [cancelPendingCommit, router, setSearchInput]);

  return (
    <PageContainer
      title="供应商档案"
      description="供应商资料、采购和对账"
      icon={<Building2 className="h-6 w-6 text-white" />}
      actions={
        <Button size="lg" asChild className="h-10 rounded-md px-4 font-medium">
          <Link href="/suppliers/create">
            <Plus className="mr-2 h-4 w-4" />
            新建供应商
          </Link>
        </Button>
      }
      banner={
        <FilterBar
          searchValue={searchInput}
          onSearchChange={handleSearchChange}
          searchPlaceholder="搜索供应商、证照、联系人"
          isSearching={isSearching || isFetching}
          filters={[
            {
              key: 'status',
              label: '合作状态',
              options: [
                { label: '启用中', value: 'active' },
                { label: '已停用', value: 'inactive' },
                { label: '已暂停', value: 'suspended' },
              ],
              width: 'w-36',
            },
          ]}
          filterValues={{
            status,
          }}
          onFilterChange={(key, value) => {
            if (key === 'status') {
              handleStatusChange(value as Supplier['status'] | undefined);
            }
          }}
          onClearFilters={handleClearFilters}
        />
      }
      className="min-h-screen bg-slate-50/50"
      maxWidthClassName="max-w-[1680px]"
      headerClassName="lg:px-8 lg:pt-6 xl:px-10"
      bannerClassName="lg:px-8 xl:px-10"
      bodyClassName="space-y-4 lg:px-8 lg:pb-8 xl:px-10"
    >
      <div className="relative">
        {isError && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            <div className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            加载供应商资料失败：
            {getFriendlyErrorMessage(error, '请稍后重试')}
          </div>
        )}

        {isListRefreshing && (
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center rounded-lg border border-[hsl(var(--color-border-primary))] bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
            正在更新
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border bg-white">
            <EmptyState
              title="供应商加载中..."
              icon={
                <Loader2 className="h-10 w-10 animate-spin text-slate-300" />
              }
              compact
            />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
            <EmptyState
              title="还没有供应商资料"
              description="新增供应商后可录入采购和对账"
              action={
                <Button
                  onClick={() => router.push('/suppliers/create')}
                  className="h-10 rounded-md px-4 font-medium"
                >
                  新增供应商
                </Button>
              }
              compact
            />
          </div>
        ) : (
          <div
            className={cn(
              'space-y-3 transition-opacity',
              isListRefreshing && 'opacity-60'
            )}
          >
            {suppliers.map((supplier, index) => (
              <div
                key={supplier.id}
                onClick={() => router.push(`/suppliers/${supplier.id}`)}
                className={cn(
                  'relative flex cursor-pointer flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-slate-300',
                  isListRefreshing && index === 0 ? 'mt-10' : ''
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Left: Identity Section */}
                  <div className="flex min-w-[260px] items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {supplier.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          建档时间 {formatDate(supplier.createdAt)}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-200" />
                        <span className="text-xs font-bold text-slate-400">
                          编号：{supplier.id.slice(-6)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Contact & Status */}
                  <div className="flex flex-wrap items-center gap-2 lg:flex-1 lg:px-4">
                    <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">
                        {supplier.phone || '未留联系电话'}
                      </span>
                    </div>
                    <div className="flex max-w-[260px] items-center gap-2 truncate rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate text-sm font-medium text-slate-600">
                        {supplier.address || '未填写地址'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Business Insights */}
                  <div className="grid min-w-[220px] grid-cols-2 gap-2">
                    <div className="flex flex-col items-center justify-center rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                      <span className="mb-1 text-xs text-amber-700">
                        合作状态
                      </span>
                      <div className="flex items-center gap-1 text-amber-700">
                        <Truck className="h-3 w-3" />
                        <span className="text-sm font-medium text-amber-900">
                          {formatSupplierStatus(supplier.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                      <span className="mb-1 text-xs text-blue-700">
                        联系资料
                      </span>
                      <div className="flex items-center gap-1 text-blue-700">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-sm font-medium text-blue-900">
                          {supplier.phone || supplier.address
                            ? '已完善'
                            : '待补充'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Menu */}
                  <div className="hidden lg:block">
                    <SupplierRowActions
                      supplierId={supplier.id}
                      onDelete={() => handleDelete(supplier)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium',
                      supplier.status === 'active'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {formatSupplierStatus(supplier.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-center py-6">
            <div className="flex min-h-12 flex-wrap items-center gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm">
              <div className="mr-2 flex items-center gap-1.5 border-r border-slate-100 pr-6">
                <span className="text-xs font-semibold text-slate-500">
                  供应规模
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {pagination.total} 家供应商
                </span>
              </div>
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                showRange={false}
                showTotal={false}
                disabled={isListRefreshing}
              />
            </div>
          </div>
        )}
      </div>

      {deleteDialogOpen && (
        <SupplierDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          supplierName={supplierToDelete?.name ?? ''}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => {
            if (supplierToDelete) {
              deleteMutation.mutate(supplierToDelete.id);
            }
          }}
        />
      )}
    </PageContainer>
  );
}
