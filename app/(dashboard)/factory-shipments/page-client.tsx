'use client';

import { Download, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { FactoryShipmentOrderList } from '@/components/factory-shipments/factory-shipment-order-list';
import { Button } from '@/components/ui/button';
import type { FactoryShipmentStatus } from '@/lib/types/factory-shipment';

interface FactoryShipmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: FactoryShipmentStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface FactoryShipmentsPageClientProps {
  initialParams: FactoryShipmentQueryParams;
}

/**
 * 厂家发货页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function FactoryShipmentsPageClient({
  initialParams,
}: FactoryShipmentsPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState(initialParams.status);
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: FactoryShipmentQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (filters.sortBy) {
          params.set('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set('sortOrder', filters.sortOrder);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/factory-shipments?${params.toString()}`);
      });
    },
    300
  );

  // 搜索处理 - 立即更新本地状态，防抖更新URL
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        ...initialParams,
        search: value,
        status,
        sortBy,
        sortOrder,
        page: 1,
      });
    },
    [debouncedUpdateURL, initialParams, status, sortBy, sortOrder]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const newFilters = { ...initialParams, [key]: value, page: 1 };

      // 更新本地状态
      if (key === 'status') {
        setStatus(value as FactoryShipmentStatus | undefined);
      } else if (key === 'sortBy') {
        setSortBy(value || 'createdAt');
      } else if (key === 'sortOrder') {
        setSortOrder((value as 'asc' | 'desc') || 'desc');
      }

      // 立即更新URL（筛选不需要防抖）
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (newFilters.status) {
          params.set('status', newFilters.status);
        }
        if (newFilters.sortBy) {
          params.set('sortBy', newFilters.sortBy);
        }
        if (newFilters.sortOrder) {
          params.set('sortOrder', newFilters.sortOrder);
        }
        if (newFilters.limit) {
          params.set('limit', newFilters.limit.toString());
        }

        router.push(`/factory-shipments?${params.toString()}`);
      });
    },
    [router, search, initialParams]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (status) {
          params.set('status', status);
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
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.push(`/factory-shipments?${params.toString()}`);
      });
    },
    [router, search, status, sortBy, sortOrder, initialParams.limit]
  );

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <PageHeader
        title="厂家发货管理"
        description="管理厂家发货订单，跟踪货物运输状态和到货情况"
        icon={<Package className="h-6 w-6 text-white" />}
        variant="solid"
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <Link href="/factory-shipments/export">
                <Download className="mr-2 h-4 w-4" />
                导出
              </Link>
            </Button>
            <Button
              size="lg"
              asChild
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <Link href="/factory-shipments/create">
                <Plus className="mr-2 h-4 w-4" />
                新建发货单
              </Link>
            </Button>
          </>
        }
      />

      {/* 厂家发货列表 */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        }
      >
        <FactoryShipmentOrderList
          initialParams={initialParams}
          onSearch={handleSearch}
          onFilter={handleFilter}
          onPageChange={handlePageChange}
        />
      </Suspense>
    </div>
  );
}
