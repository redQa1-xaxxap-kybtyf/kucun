'use client';

import { Download, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { CustomerDeleteDialog } from '@/components/customers/customer-delete-dialog';
import { Button } from '@/components/ui/button';
import { useCustomersQuery } from '@/hooks/use-customers-query';
import {
  CUSTOMER_SORT_OPTIONS,
  type Customer,
  type CustomerQueryParams,
} from '@/lib/types/customer';

interface CustomersPageClientProps {
  initialParams: CustomerQueryParams;
}

const ERPCustomerList = dynamic(
  () => import('@/components/customers/erp-customer-list').then(mod => mod.ERPCustomerList),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        列表加载中...
      </div>
    ),
  }
);

/**
 * 客户管理页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 * 参考供应商页面实现，使用URL参数管理搜索状态
 */
export function CustomersPageClient({
  initialParams,
}: CustomersPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // 本地状态管理
  const [search, setSearch] = React.useState(initialParams.search || '');
  type SortField = NonNullable<CustomerQueryParams['sortBy']>;
  const isSortField = React.useCallback(
    (value: string): value is SortField =>
      CUSTOMER_SORT_OPTIONS.some(option => option.value === value),
    []
  );
  const [sortBy, setSortBy] = React.useState<SortField>(
    initialParams.sortBy ?? 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );

  // 对话框状态管理
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);

  React.useEffect(() => {
    setSearch(initialParams.search || '');
    if (initialParams.sortBy && isSortField(initialParams.sortBy)) {
      setSortBy(initialParams.sortBy);
    } else {
      setSortBy('createdAt');
    }
    setSortOrder(initialParams.sortOrder === 'asc' ? 'asc' : 'desc');
  }, [initialParams, isSortField]);

  const queryParams = React.useMemo(() => {
    const normalizedSearch =
      typeof initialParams.search === 'string' && initialParams.search.trim()
        ? initialParams.search.trim()
        : undefined;

    return {
      page: initialParams.page ?? 1,
      limit: initialParams.limit ?? 10,
      search: normalizedSearch,
      sortBy: initialParams.sortBy ?? 'createdAt',
      sortOrder: initialParams.sortOrder ?? 'desc',
      parentCustomerId: initialParams.parentCustomerId,
      region: initialParams.region,
    } satisfies CustomerQueryParams;
  }, [initialParams]);

  const { data, isLoading, isError, error } = useCustomersQuery(queryParams);

  const customers = data?.data ?? [];
  const pagination = data?.pagination;

  // 防抖更新URL - 避免每次输入都触发导航
  // 参考Next.js官方最佳实践: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
  const debouncedUpdateURL = useDebouncedCallback((value: string) => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (value) {
        params.set('search', value);
      }
      if (sortBy) {
        params.set('sortBy', sortBy);
      }
      if (sortOrder) {
        params.set('sortOrder', sortOrder);
      }
      router.push(`/customers?${params.toString()}`);
    });
  }, 300); // 300ms防抖延迟，用户停止输入后才更新URL

  // 处理搜索 - 立即更新本地状态，防抖更新URL
  const handleSearch = (value: string) => {
    setSearch(value); // 立即更新，保持输入框响应流畅
    debouncedUpdateURL(value); // 防抖更新URL和服务器数据
  };

  // 处理排序 - 更新URL参数触发服务器端重新获取数据
  const handleSortChange = (
    newSortBy: string,
    newSortOrder: 'asc' | 'desc'
  ) => {
    const nextSortBy = isSortField(newSortBy) ? newSortBy : 'createdAt';
    setSortBy(nextSortBy);
    setSortOrder(newSortOrder);
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      params.set('sortBy', nextSortBy);
      params.set('sortOrder', newSortOrder);
      router.push(`/customers?${params.toString()}`);
    });
  };

  // 处理分页 - 更新URL参数触发服务器端重新获取数据
  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (sortBy) {
        params.set('sortBy', sortBy);
      }
      if (sortOrder) {
        params.set('sortOrder', sortOrder);
      }
      if (page > 1) {
        params.set('page', page.toString());
      }
      router.push(`/customers?${params.toString()}`);
    });
  };

  // 操作处理函数
  const handleViewDetail = (customer: Customer) => {
    router.push(`/customers/${customer.id}`);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 transition-all duration-500 lg:p-10 xl:p-14">
        {/* Identity Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tighter text-slate-900">
              客户管理
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed font-bold text-slate-400">
              管理核心客群资产，跟踪交易频次、合作周期及往来账目。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="lg"
              asChild
              className="h-12 rounded-2xl border-none bg-white px-6 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-900 hover:text-white active:scale-95"
            >
              <Link href="/customers/export">
                <Download className="mr-2 h-4 w-4" />
                导出报表
              </Link>
            </Button>
            <Button
              size="lg"
              asChild
              className="h-12 rounded-2xl border-none bg-slate-900 px-6 font-black text-white shadow-xl transition-all hover:shadow-slate-200 active:scale-95"
            >
              <Link href="/customers/create">
                <Plus className="mr-2 h-4 w-4" />
                新建客户
              </Link>
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="relative z-10">
          <div className="absolute -inset-4 -z-10 rounded-full bg-gradient-to-tr from-slate-100/40 to-white/0 opacity-50 blur-2xl" />
          <SearchFilterCard
            // ... existing props
            searchValue={search}
            onSearchChange={handleSearch}
            searchPlaceholder="搜索客户名称、电话或地址..."
            filters={[
              {
                key: 'sortBy',
                label: '排序字段',
                options: CUSTOMER_SORT_OPTIONS.map(option => ({ ...option })),
                width: 'w-36',
              },
              {
                key: 'sortOrder',
                label: '排序方式',
                options: [
                  { label: '升序', value: 'asc' },
                  { label: '降序', value: 'desc' },
                ],
                width: 'w-28',
              },
            ]}
            filterValues={{
              sortBy,
              sortOrder,
            }}
            onFilterChange={(key, value) => {
              if (key === 'sortBy' && value) {
                handleSortChange(value, sortOrder);
              } else if (key === 'sortOrder' && value) {
                handleSortChange(sortBy, value as 'asc' | 'desc');
              }
            }}
            variant="pro"
            compact={true}
          />
        </div>

        {/* 客户列表 */}
        <div className="relative">
          {isError && (
            <div className="animate-in fade-in slide-in-from-top-4 mb-8 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 px-6 py-4 text-sm font-bold text-rose-600 duration-500">
              <div className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              加载客户数据失败：
              {error instanceof Error ? error.message : '发生未知错误'}
            </div>
          )}

          <ERPCustomerList
            customers={customers}
            pagination={pagination}
            isLoading={isLoading}
            onViewDetail={handleViewDetail}
            onDelete={handleDelete}
            onPageChange={handlePageChange}
          />
        </div>

        <CustomerDeleteDialog
          customer={selectedCustomer}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        />
      </div>
    </div>
  );
}
