'use client';

import { Download, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { SearchFilterCard } from '@/components/common/search-filter-card';
import { CustomerDeleteDialog } from '@/components/customers/customer-delete-dialog';
import { ERPCustomerList } from '@/components/customers/erp-customer-list';
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
    <div className="flex h-full flex-col overflow-auto p-6">
      {/* 页面标题 */}
      <div className="mb-6 flex-shrink-0">
        <PageHeader
          title="客户管理"
          description="管理客户信息，跟踪客户订单和交易记录"
          icon={<Users className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-purple))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/customers/export">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/customers/create">
                  <Plus className="mr-2 h-4 w-4" />
                  新建客户
                </Link>
              </Button>
            </>
          }
        />
      </div>

      {/* 搜索和筛选 - 固定在顶部 */}
      <div className="mb-6 flex-shrink-0">
        <SearchFilterCard
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="搜索客户名称、电话或地址..."
          filters={[
            {
              key: 'sortBy',
              label: '排序字段',
              options: CUSTOMER_SORT_OPTIONS,
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
        />
      </div>

      {/* 客户列表 */}
      {isError && (
        <div className="border-destructive/50 bg-destructive/5 text-destructive mb-4 rounded border px-4 py-3 text-sm">
          加载客户列表失败：
          {error instanceof Error ? error.message : '发生未知错误'}
        </div>
      )}

      <div className="flex-1">
        <ERPCustomerList
          customers={customers}
          pagination={pagination}
          isLoading={isLoading}
          onViewDetail={handleViewDetail}
          onDelete={handleDelete}
          onPageChange={handlePageChange}
        />
      </div>

      {/* 对话框组件 */}
      <CustomerDeleteDialog
        customer={selectedCustomer}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
