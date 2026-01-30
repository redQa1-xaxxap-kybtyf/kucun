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
  TrendingUp,
  Truck,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { SupplierPageHeader } from '@/components/suppliers/supplier-page-header';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/use-toast';
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

const SearchFilterCard = dynamic(
  () =>
    import('@/components/common/search-filter-card').then(
      mod => mod.SearchFilterCard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[76px] w-full animate-pulse rounded-[2.5rem] border border-white bg-white/40 backdrop-blur-md" />
    ),
  }
);

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
  const [_isPending, startTransition] = useTransition();

  // 本地状态
  const [searchInput, setSearchInput] = useState(initialParams.search || '');
  const [status, setStatus] = useState<Supplier['status'] | undefined>(
    initialParams.status
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null
  );
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(initialParams.search || '');
    setStatus(initialParams.status);
  }, [initialParams]);

  useEffect(
    () => () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    },
    []
  );

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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: supplierQueryKeys.list(queryParams),
    queryFn: () => getSuppliers(queryParams),
    placeholderData: keepPreviousData => keepPreviousData,
    staleTime: SEARCH_CONFIG.CACHE.STALE_TIME,
  });

  const suppliers = data?.data ?? [];
  const pagination = data?.pagination;

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
        description: error.message || '删除供应商失败',
        variant: 'destructive',
      });
    },
  });

  // 处理搜索
  const handleSearch = useCallback(
    (value: string) => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      setSearchInput(value);

      searchDebounceRef.current = setTimeout(() => {
        startTransition(() => {
          const params = new URLSearchParams();
          const trimmedValue = value.trim();
          if (trimmedValue) {
            params.set('search', trimmedValue);
          }
          if (status) {
            params.set('status', status);
          }
          router.push(
            params.size > 0 ? `/suppliers?${params.toString()}` : '/suppliers'
          );
          searchDebounceRef.current = null;
        });
      }, SEARCH_CONFIG.DEBOUNCE_DELAY.DEFAULT);
    },
    [router, startTransition, status]
  );

  // 处理状态筛选
  const handleStatusChange = useCallback(
    (value: Supplier['status'] | undefined) => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }

      setStatus(value);
      startTransition(() => {
        const params = new URLSearchParams();
        const trimmedSearch = searchInput.trim();
        if (trimmedSearch) {
          params.set('search', trimmedSearch);
        }
        if (value) {
          params.set('status', value);
        }
        router.push(
          params.size > 0 ? `/suppliers?${params.toString()}` : '/suppliers'
        );
      });
    },
    [router, searchInput, startTransition]
  );

  // 处理分页
  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      const trimmedSearch = searchInput.trim();
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }
      if (status) {
        params.set('status', status);
      }

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }

      startTransition(() => {
        router.push(`/suppliers?${params.toString()}`);
      });
    },
    [router, searchInput, startTransition, status]
  );

  // 处理删除
  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 transition-all duration-500">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 lg:p-10 xl:p-14">
        {/* Identity Header */}
        <SupplierPageHeader />

        {/* Search & Filters */}
        <div className="relative z-10">
          <div className="absolute -inset-4 -z-10 rounded-full bg-gradient-to-tr from-slate-100/40 to-white/0 opacity-50 blur-2xl" />
          <SearchFilterCard
            searchValue={searchInput}
            onSearchChange={handleSearch}
            searchPlaceholder="搜索供应商名称、证照编号或联系人..."
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
            variant="pro"
            compact={true}
          />
        </div>

        {/* Error State */}
        {isError && (
          <div className="animate-in fade-in slide-in-from-top-4 mb-8 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 px-6 py-4 text-sm font-bold text-rose-600 duration-500">
            <div className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            同步供应中枢数据失败：
            {error instanceof Error ? error.message : '发生未知错误'}
          </div>
        )}

        {/* List Content */}
        <div className="relative">
          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-[2.5rem] border border-white bg-white/40 backdrop-blur-md">
              <EmptyState
                title="正在同步供应中枢..."
                icon={
                  <Loader2 className="h-10 w-10 animate-spin text-slate-300" />
                }
                compact
              />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="rounded-[2.5rem] border border-dashed border-slate-200 bg-white/20 p-20 text-center">
              <EmptyState
                title="暂无往来供应商登记"
                description="完善供应链的第一步从这里开始"
                action={
                  <Button
                    onClick={() => router.push('/suppliers/create')}
                    className="h-12 rounded-2xl bg-slate-900 px-8 font-black"
                  >
                    登记首位供应商
                  </Button>
                }
                compact
              />
            </div>
          ) : (
            <div className="space-y-4">
              {suppliers.map((supplier, index) => (
                <div
                  key={supplier.id}
                  onClick={() => router.push(`/suppliers/${supplier.id}`)}
                  className={cn(
                    'group relative flex flex-col gap-6 rounded-[2rem] border border-white bg-white/60 p-6 backdrop-blur-xl transition-all duration-500',
                    'cursor-pointer hover:-translate-y-1 hover:bg-white hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]',
                    'animate-in fade-in slide-in-from-bottom-4',
                    `duration-${(index + 1) * 100}`
                  )}
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left: Identity Section */}
                    <div className="flex min-w-[300px] items-center gap-5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl transition-transform duration-500 group-hover:scale-110">
                        <Building2 className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-amber-600">
                          {supplier.name}
                        </h3>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            合作始于 {formatDate(supplier.createdAt)}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-200" />
                          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                            编号：{supplier.id.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Contact & Status */}
                    <div className="flex flex-wrap items-center gap-4 lg:flex-1 lg:px-8">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm font-bold text-slate-600">
                          {supplier.phone || '未留联系电话'}
                        </span>
                      </div>
                      <div className="flex max-w-[240px] items-center gap-2 truncate rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate text-sm font-bold text-slate-600">
                          {supplier.address || '无登记地址'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Business Insights */}
                    <div className="grid min-w-[240px] grid-cols-2 gap-3">
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-100/50 bg-amber-50/50 px-4 py-3">
                        <span className="mb-1 text-xs font-black tracking-widest text-amber-600 uppercase">
                          供应频次
                        </span>
                        <div className="flex items-center gap-1 text-amber-700">
                          <Truck className="h-3 w-3" />
                          <span className="text-sm font-black text-amber-900/40">
                            活跃数据
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-100/50 bg-blue-50/50 px-4 py-3">
                        <span className="mb-1 text-xs font-black tracking-widest text-blue-600 uppercase">
                          结算信用
                        </span>
                        <div className="flex items-center gap-1 text-blue-700">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-sm font-black text-blue-900/40">
                            优秀
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

                  {/* Status Badges Overlay */}
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-black tracking-[0.2em] uppercase',
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
        </div>

        {/* Pagination Container */}
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-center py-10">
            <div className="group flex h-16 items-center gap-6 rounded-3xl border border-white bg-white/60 px-8 py-3 shadow-sm backdrop-blur-xl transition-all hover:bg-white hover:shadow-xl">
              <div className="mr-2 flex items-center gap-1.5 border-r border-slate-100 pr-6">
                <span className="text-xs font-black tracking-widest text-slate-500 uppercase">
                  供应规模
                </span>
                <span className="text-sm font-black text-slate-900">
                  {pagination.total} 家合作伙伴
                </span>
              </div>
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                showRange={false}
                showTotal={false}
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
    </div>
  );
}
