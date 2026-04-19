'use client';

import { Download, Package, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { useFinanceExport } from '@/hooks/use-finance-export';
import type { FactoryShipmentStatus } from '@/lib/types/factory-shipment';

interface FactoryShipmentQueryParams {
  page?: number;
  limit?: number;
  mode?: 'customer_direct' | 'factory';
  search?: string;
  status?: FactoryShipmentStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: Date;
  endDate?: Date;
}

interface FactoryShipmentsPageClientProps {
  initialParams: FactoryShipmentQueryParams;
}

const FactoryShipmentOrderList = dynamic(
  () =>
    import('@/components/factory-shipments/factory-shipment-order-list').then(
      mod => mod.FactoryShipmentOrderList
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    ),
  }
);

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
  const { exportData, isExporting } = useFinanceExport();
  const mode = initialParams.mode;

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState(initialParams.status);
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState(initialParams.startDate);
  const [endDate, setEndDate] = React.useState(initialParams.endDate);

  React.useEffect(() => {
    setSearch(initialParams.search || '');
    setStatus(initialParams.status);
    setSortBy(initialParams.sortBy || 'createdAt');
    setSortOrder(initialParams.sortOrder || 'desc');
    setStartDate(initialParams.startDate);
    setEndDate(initialParams.endDate);
  }, [
    initialParams.endDate,
    initialParams.search,
    initialParams.sortBy,
    initialParams.sortOrder,
    initialParams.startDate,
    initialParams.status,
  ]);

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: FactoryShipmentQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (mode) {
          params.set('mode', mode);
        }
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
        if (filters.startDate) {
          params.set(
            'startDate',
            filters.startDate.toISOString().split('T')[0]
          );
        }
        if (filters.endDate) {
          params.set('endDate', filters.endDate.toISOString().split('T')[0]);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.replace(`/factory-shipments?${params.toString()}`, {
          scroll: false,
        });
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
        startDate,
        endDate,
        page: 1,
      });
    },
    [
      debouncedUpdateURL,
      initialParams,
      status,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
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
        if (mode) {
          params.set('mode', mode);
        }
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
        if (startDate) {
          params.set('startDate', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          params.set('endDate', endDate.toISOString().split('T')[0]);
        }
        if (newFilters.limit) {
          params.set('limit', newFilters.limit.toString());
        }

        router.replace(`/factory-shipments?${params.toString()}`, {
          scroll: false,
        });
      });
    },
    [router, search, initialParams, startDate, endDate, mode]
  );

  // 日期范围处理
  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      const newStartDate = range.startDate
        ? new Date(range.startDate)
        : undefined;
      const newEndDate = range.endDate ? new Date(range.endDate) : undefined;

      setStartDate(newStartDate);
      setEndDate(newEndDate);

      // 立即更新URL
      startTransition(() => {
        const params = new URLSearchParams();
        if (mode) {
          params.set('mode', mode);
        }
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
        if (range.startDate) {
          params.set('startDate', range.startDate);
        }
        if (range.endDate) {
          params.set('endDate', range.endDate);
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.replace(`/factory-shipments?${params.toString()}`, {
          scroll: false,
        });
      });
    },
    [router, search, status, sortBy, sortOrder, initialParams.limit, mode]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (mode) {
          params.set('mode', mode);
        }
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
        if (startDate) {
          params.set('startDate', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          params.set('endDate', endDate.toISOString().split('T')[0]);
        }
        if (page > 1) {
          params.set('page', page.toString());
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.replace(`/factory-shipments?${params.toString()}`, {
          scroll: false,
        });
      });
    },
    [
      router,
      search,
      status,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      initialParams.limit,
      mode,
    ]
  );

  // 导出处理
  const handleExport = React.useCallback(() => {
    exportData('/api/factory-shipments/export', {
      format: 'excel',
      filters: {
        mode,
        status,
        search,
        containerNumber: search,
        orderNumber: search,
        startDate: startDate?.toISOString().split('T')[0],
        endDate: endDate?.toISOString().split('T')[0],
      },
    });
  }, [exportData, status, search, startDate, endDate, mode]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex-shrink-0 sm:mb-6">
        {/* 页面标题 */}
        <PageHeader
          title={mode === 'factory' ? '厂家发货管理' : '客户直发管理'}
          description={
            mode === 'factory'
              ? '管理厂家发货订单，跟踪货物运输状态和到港进度'
              : '管理客户直发订单，跟踪货物运输状态和到港进度'
          }
          icon={<Package className="h-6 w-6 text-white" />}
          variant="solid"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={handleExport}
                disabled={isExporting}
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? '导出中...' : '导出'}
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
      </div>

      <div className="flex-1">
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
            onDateRangeChange={handleDateRangeChange}
            onPageChange={handlePageChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
