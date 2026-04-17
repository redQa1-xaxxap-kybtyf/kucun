'use client';

import { Download, Plus, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { FilterBar } from '@/components/layouts/filter-bar';
import { PageContainer } from '@/components/layouts/page-container';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
import { useCustomersQuery } from '@/hooks/use-customers-query';
import {
  CUSTOMER_SORT_OPTIONS,
  type Customer,
  type CustomerQueryParams,
} from '@/lib/types/customer';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

interface CustomersPageClientProps {
  initialParams: CustomerQueryParams;
}

const ERPCustomerList = dynamic(
  () =>
    import('@/components/customers/erp-customer-list').then(
      mod => mod.ERPCustomerList
    ),
  {
    ssr: false,
    loading: () => <TableSkeleton columns={6} rows={8} showPagination />,
  }
);

const CustomerDeleteDialog = dynamic(
  () =>
    import('@/components/customers/customer-delete-dialog').then(
      mod => mod.CustomerDeleteDialog
    ),
  {
    ssr: false,
    loading: () => null,
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

  const handleClearFilters = () => {
    debouncedUpdateURL.cancel();
    setSearch('');
    setSortBy('createdAt');
    setSortOrder('desc');
    startTransition(() => {
      router.push('/customers');
    });
  };

  return (
    <PageContainer
      title="客户管理"
      description="统一维护客户资料，查看销售、退货和往来情况。"
      icon={<Users className="h-6 w-6 text-white" />}
      actions={
        <>
          <Button
            variant="ghost"
            size="lg"
            asChild
            className="h-12 rounded-2xl border-none bg-white px-6 font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <Link href="/customers/export">
              <Download className="mr-2 h-4 w-4" />
              导出客户列表
            </Link>
          </Button>
          <Button
            size="lg"
            asChild
            className="h-12 rounded-2xl border-none bg-slate-900 px-6 font-semibold text-white shadow-xl transition-all hover:shadow-slate-200 active:scale-95"
          >
            <Link href="/customers/create">
              <Plus className="mr-2 h-4 w-4" />
              新建客户
            </Link>
          </Button>
        </>
      }
      banner={
        <FilterBar
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="搜索客户名称、电话或地址..."
          filters={[
            {
              key: 'sortBy',
              label: '排序依据',
              options: CUSTOMER_SORT_OPTIONS.map(option => ({ ...option })),
              width: 'w-36',
              includeAllOption: false,
              defaultValue: 'createdAt',
            },
            {
              key: 'sortOrder',
              label: '排序方式',
              options: [
                { label: '升序', value: 'asc' },
                { label: '降序', value: 'desc' },
              ],
              width: 'w-28',
              includeAllOption: false,
              defaultValue: 'desc',
            },
          ]}
          filterValues={{
            sortBy,
            sortOrder,
          }}
          onFilterChange={(key, value) => {
            if (key === 'sortBy') {
              handleSortChange(value ?? 'createdAt', sortOrder);
            } else if (key === 'sortOrder') {
              handleSortChange(sortBy, (value as 'asc' | 'desc') ?? 'desc');
            }
          }}
          onClearFilters={handleClearFilters}
        />
      }
      maxWidthClassName="max-w-[1680px]"
      headerClassName="lg:px-10 lg:pt-10 xl:px-14 xl:pt-14"
      bannerClassName="lg:px-10 xl:px-14"
      bodyClassName="space-y-6 lg:px-10 lg:pb-10 xl:px-14 xl:pb-14"
    >
      <div className="relative">
          {isError && (
            <div className="animate-in fade-in slide-in-from-top-4 mb-8 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 px-6 py-4 text-sm font-bold text-rose-600 duration-500">
              <div className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              加载客户数据失败：
              {getFriendlyErrorMessage(error, '请稍后重试')}
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
    </PageContainer>
  );
}
