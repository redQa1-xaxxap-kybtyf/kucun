'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { ERPSalesOrderList } from '@/components/sales-orders/erp-sales-order-list';
import { SalesOrderPageHeader } from '@/components/sales-orders/sales-order-page-header';
import type { SalesOrderQueryParams } from '@/lib/types/sales-order';

interface SalesOrdersPageClientProps {
  initialParams: SalesOrderQueryParams;
}

type LatestQueryState = {
  search: string;
  status?: SalesOrderQueryParams['status'];
  customerId: string;
  sortBy: SalesOrderQueryParams['sortBy'];
  sortOrder: 'asc' | 'desc';
  page: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

/**
 * 销售订单页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 *
 * ✅ 修复：移除 initialData prop，使用 HydrationBoundary
 */
export function SalesOrdersPageClient({
  initialParams,
}: SalesOrdersPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // ✅ 只保留 searchInput 状态用于输入框显示，其他状态直接使用 initialParams
  const [searchInput, setSearchInput] = React.useState(
    initialParams.search || ''
  );

  // ✅ 使用 ref 存储最新的查询参数，与 initialParams 保持同步
  const latestParamsRef = React.useRef<LatestQueryState>({
    search: initialParams.search || '',
    status: initialParams.status,
    customerId: initialParams.customerId || '',
    sortBy: initialParams.sortBy || 'createdAt',
    sortOrder: initialParams.sortOrder || 'desc',
    page: initialParams.page || 1,
    limit: initialParams.limit,
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
  });

  // ✅ 同步 initialParams 到 latestParamsRef 和 searchInput
  React.useEffect(() => {
    const nextSearch = initialParams.search || '';

    // 同步 ref（用于 replaceURL）
    latestParamsRef.current = {
      search: nextSearch,
      status: initialParams.status,
      customerId: initialParams.customerId || '',
      sortBy: initialParams.sortBy || 'createdAt',
      sortOrder: initialParams.sortOrder || 'desc',
      page: initialParams.page || 1,
      limit: initialParams.limit,
      startDate: initialParams.startDate,
      endDate: initialParams.endDate,
    };

    // 同步搜索框显示值
    setSearchInput(nextSearch);
  }, [
    initialParams.search,
    initialParams.status,
    initialParams.customerId,
    initialParams.sortBy,
    initialParams.sortOrder,
    initialParams.page,
    initialParams.limit,
    initialParams.startDate,
    initialParams.endDate,
  ]);

  const replaceURL = React.useCallback(
    (overrides?: Partial<LatestQueryState>) => {
      const next = { ...latestParamsRef.current, ...overrides };
      const params = new URLSearchParams();

      if (next.search) {
        params.set('search', next.search);
      }
      if (next.status) {
        params.set('status', next.status);
      }
      if (next.customerId) {
        params.set('customerId', next.customerId);
      }
      if (next.sortBy) {
        params.set('sortBy', next.sortBy);
      }
      if (next.sortOrder) {
        params.set('sortOrder', next.sortOrder);
      }
      if (next.page > 1) {
        params.set('page', next.page.toString());
      }
      if (typeof next.limit === 'number') {
        params.set('limit', next.limit.toString());
      }
      if (next.startDate) {
        params.set('startDate', next.startDate);
      }
      if (next.endDate) {
        params.set('endDate', next.endDate);
      }

      const queryString = params.toString();
      const newUrl = queryString
        ? `/sales-orders?${queryString}`
        : '/sales-orders';

      startTransition(() => {
        router.replace(newUrl, { scroll: false });
      });
    },
    [router, startTransition]
  );

  const debouncedApplySearch = useDebouncedCallback((value: string) => {
    const overrides: Partial<LatestQueryState> = { search: value, page: 1 };
    latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
    replaceURL(overrides);
  }, 300);

  React.useEffect(
    () => () => {
      debouncedApplySearch.cancel();
    },
    [debouncedApplySearch]
  );

  // 搜索处理 - 输入框即时更新，实际请求在防抖后触发
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchInput(value);

      if (value === '') {
        // 清空搜索时立即执行，取消防抖
        debouncedApplySearch.cancel();
        const overrides: Partial<LatestQueryState> = { search: '', page: 1 };
        latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
        replaceURL(overrides);
        return;
      }

      // 非空搜索使用防抖
      debouncedApplySearch(value);
    },
    [debouncedApplySearch, replaceURL]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const overrides: Partial<LatestQueryState> = { page: 1 };

      if (key === 'status') {
        overrides.status =
          value && value !== 'all'
            ? (value as SalesOrderQueryParams['status'])
            : undefined;
      } else if (key === 'customerId') {
        overrides.customerId = value || '';
      } else if (key === 'sortBy') {
        overrides.sortBy =
          (value as SalesOrderQueryParams['sortBy']) || 'createdAt';
      } else if (key === 'sortOrder') {
        overrides.sortOrder = (value as 'asc' | 'desc') || 'desc';
      } else if (key === 'startDate') {
        overrides.startDate = value;
      } else if (key === 'endDate') {
        overrides.endDate = value;
      } else if (key === 'dateRange') {
        // 处理日期范围批量更新
        try {
          const { startDate, endDate } = JSON.parse(value || '{}');
          overrides.startDate = startDate;
          overrides.endDate = endDate;
        } catch (error) {
          console.error('❌ 解析日期范围失败:', error);
        }
      }

      latestParamsRef.current = { ...latestParamsRef.current, ...overrides };

      replaceURL(overrides);
    },
    [replaceURL]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      if (nextPage === latestParamsRef.current.page) {
        return;
      }

      const overrides: Partial<LatestQueryState> = { page: nextPage };
      latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
      replaceURL(overrides);
    },
    [replaceURL]
  );

  // ✅ 构建当前查询参数（直接使用 initialParams，避免状态不同步）
  const currentQueryParams: SalesOrderQueryParams = React.useMemo(
    () => ({
      search: initialParams.search,
      status: initialParams.status,
      customerId: initialParams.customerId,
      sortBy: initialParams.sortBy,
      sortOrder: initialParams.sortOrder,
      page: initialParams.page,
      limit: initialParams.limit,
      startDate: initialParams.startDate,
      endDate: initialParams.endDate,
    }),
    [
      initialParams.search,
      initialParams.status,
      initialParams.customerId,
      initialParams.sortBy,
      initialParams.sortOrder,
      initialParams.page,
      initialParams.limit,
      initialParams.startDate,
      initialParams.endDate,
    ]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-6 flex-shrink-0">
        <SalesOrderPageHeader />
      </div>
      <div className="flex-1">
        <ERPSalesOrderList
          initialParams={currentQueryParams}
          searchValue={searchInput}
          onSearch={handleSearch}
          onFilter={handleFilter}
          onPageChange={handlePageChange}
          onOrderSelect={order => {
            router.push(`/sales-orders/${order.id}`);
          }}
        />
      </div>
    </div>
  );
}
