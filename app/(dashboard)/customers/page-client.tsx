'use client';

import { Download, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { CustomerDeleteDialog } from '@/components/customers/customer-delete-dialog';
import { CustomerDetailDialog } from '@/components/customers/customer-detail-dialog';
import { CustomerSearchFilters } from '@/components/customers/customer-search-filters';
import { ERPCustomerList } from '@/components/customers/erp-customer-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Customer, CustomerQueryParams } from '@/lib/types/customer';

interface CustomersPageClientProps {
  initialData: {
    data: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: CustomerQueryParams;
}

/**
 * 客户管理页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 * 参考供应商页面实现，使用URL参数管理搜索状态
 */
export function CustomersPageClient({
  initialData,
  initialParams,
}: CustomersPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // 本地状态管理
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );

  // 对话框状态管理
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<
    string | null
  >(null);
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);

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
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      params.set('sortBy', newSortBy);
      params.set('sortOrder', newSortOrder);
      router.push(`/customers?${params.toString()}`);
    });
  };

  // 操作处理函数
  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setDetailDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      {/* 页面标题卡片 - 固定在顶部 */}
      <div className="mb-6 flex-shrink-0">
        <Card className="overflow-hidden">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-purple))] shadow-[0_8px_20px_rgba(114,46,209,0.25)]">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    客户管理
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    管理客户信息，跟踪客户订单和交易记录
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 - 固定在顶部 */}
      <div className="mb-6 flex-shrink-0">
        <CustomerSearchFilters
          searchValue={search}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSearchChange={handleSearch}
          onSortChange={handleSortChange}
        />
      </div>

      {/* 客户列表 */}
      <div className="flex-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          }
        >
          <ERPCustomerList
            initialData={initialData}
            onViewDetail={handleViewDetail}
            onDelete={handleDelete}
          />
        </Suspense>
      </div>

      {/* 对话框组件 */}
      <CustomerDetailDialog
        customerId={selectedCustomerId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <CustomerDeleteDialog
        customer={selectedCustomer}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
