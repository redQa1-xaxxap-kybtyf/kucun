'use client';

import { Plus, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { FilterBar } from '@/components/layouts/filter-bar';
import { PageContainer } from '@/components/layouts/page-container';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
import { useCustomersQuery } from '@/hooks/use-customers-query';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  CUSTOMER_SORT_OPTIONS,
  type Customer,
  type CustomerQueryParams,
} from '@/lib/types/customer';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

interface CustomersPageClientProps {
  initialParams: CustomerQueryParams;
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
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

  // 本地状态管理
  const [committedSearch, setCommittedSearch] = React.useState(
    initialParams.search || ''
  );
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
    setCommittedSearch(initialParams.search || '');
    if (initialParams.sortBy && isSortField(initialParams.sortBy)) {
      setSortBy(initialParams.sortBy);
    } else {
      setSortBy('createdAt');
    }
    setSortOrder(initialParams.sortOrder === 'asc' ? 'asc' : 'desc');
  }, [initialParams, isSortField]);

  const queryParams = React.useMemo(
    () =>
      ({
        page: initialParams.page ?? 1,
        limit: initialParams.limit ?? 10,
        search: normalizeSearch(committedSearch),
        sortBy,
        sortOrder,
        parentCustomerId: initialParams.parentCustomerId,
        region: initialParams.region,
      }) satisfies CustomerQueryParams,
    [committedSearch, initialParams, sortBy, sortOrder]
  );

  const { data, isLoading, isFetching, isError, error } = useCustomersQuery(
    queryParams,
    {
      placeholderData: previousData => previousData,
    }
  );

  const customers = data?.data ?? [];
  const pagination = data?.pagination;
  const isListRefreshing = !isLoading && isFetching;

  const syncUrl = React.useCallback(
    ({
      search,
      sortBy,
      sortOrder,
      page,
    }: {
      search?: string;
      sortBy: SortField;
      sortOrder: 'asc' | 'desc';
      page?: number;
    }) => {
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
      if (page && page > 1) {
        params.set('page', page.toString());
      }
      const queryString = params.toString();
      router.replace(queryString ? `/customers?${queryString}` : '/customers', {
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
        sortBy,
        sortOrder,
      });
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setCommittedSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  // 处理排序 - 更新URL参数触发服务器端重新获取数据
  const handleSortChange = (
    newSortBy: string,
    newSortOrder: 'asc' | 'desc'
  ) => {
    const nextSortBy = isSortField(newSortBy) ? newSortBy : 'createdAt';
    const nextSearch = syncPendingSearch();
    setSortBy(nextSortBy);
    setSortOrder(newSortOrder);
    syncUrl({
      search: nextSearch,
      sortBy: nextSortBy,
      sortOrder: newSortOrder,
    });
  };

  // 处理分页 - 更新URL参数触发服务器端重新获取数据
  const handlePageChange = (page: number) => {
    const nextSearch = syncPendingSearch();
    syncUrl({
      search: nextSearch,
      sortBy,
      sortOrder,
      page,
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
    cancelPendingCommit();
    setSearchInput('');
    setCommittedSearch('');
    setSortBy('createdAt');
    setSortOrder('desc');
    router.replace('/customers', { scroll: false });
  };

  return (
    <PageContainer
      title="客户档案"
      description="维护客户、电话和地址。"
      icon={<Users className="h-6 w-6 text-white" />}
      actions={
        <Button size="lg" asChild className="h-11 rounded-lg px-5">
          <Link href="/customers/create">
            <Plus className="mr-2 h-4 w-4" />
            新建客户
          </Link>
        </Button>
      }
      banner={
        <FilterBar
          searchValue={searchInput}
          onSearchChange={handleSearchChange}
          searchPlaceholder="搜索客户名称、电话、地址"
          isSearching={isSearching || isFetching}
          filters={[
            {
              key: 'sortBy',
              label: '排序字段',
              options: CUSTOMER_SORT_OPTIONS.map(option => ({ ...option })),
              width: 'w-36',
              includeAllOption: false,
              defaultValue: 'createdAt',
            },
            {
              key: 'sortOrder',
              label: '排序顺序',
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
      headerVariant="solid"
      headerClassName="lg:px-6 lg:pt-6 xl:px-10 xl:pt-10"
      bannerClassName="lg:px-6 xl:px-14"
      bodyClassName="space-y-6 lg:px-6 lg:pb-6 xl:px-14 xl:pb-14"
    >
      <div className="relative">
        {isError && (
          <div className="mb-6 flex items-center gap-3 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            <div className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            加载客户数据失败：
            {getFriendlyErrorMessage(error, '请稍后重试')}
          </div>
        )}

        <ERPCustomerList
          customers={customers}
          pagination={pagination}
          isLoading={isLoading}
          isRefreshing={isListRefreshing}
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
