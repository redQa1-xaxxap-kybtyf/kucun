'use client';

import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PaymentsClient } from '@/components/finance/payments-client';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { useFinanceExport } from '@/hooks/use-finance-export';
import type { PaymentStatus } from '@/lib/types/payment';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: PaymentStatus;
  remarks?: string;
  receiptNumber?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    roundingAdjustment: number; // ✅ 新增: 订单抹零金额
    paidAmount: number;
    pendingAmount: number;
    remainingAmount: number;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentsQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: PaymentStatus;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

interface PaymentsPageClientProps {
  initialData: {
    payments: PaymentRecord[];
    statistics: {
      totalAmount: number;
      confirmedAmount: number;
      pendingAmount: number;
      recordCount: number;
      collectionRate: number;
      currentMonthCollectionRate?: number | null;
      previousMonthCollectionRate?: number | null;
      collectionRateChange?: number | null;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: PaymentsQueryParams;
}

/**
 * 收款记录页面客户端组件
 * 负责用户交互和状态管理
 */
export function PaymentsPageClient({
  initialData,
  initialParams,
}: PaymentsPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const { exportData, isExporting } = useFinanceExport();

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState<PaymentStatus | undefined>(
    initialParams.status
  );
  const [paymentMethod, setPaymentMethod] = React.useState(
    initialParams.paymentMethod
  );
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState<string | undefined>(
    initialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    initialParams.endDate
  );

  const handleExport = React.useCallback(() => {
    // 导出使用当前筛选条件，但一次性导出最多 50,000 条记录
    const filters: PaymentsQueryParams = {
      page: 1,
      limit: 50000,
      search: search || undefined,
      status,
      paymentMethod,
      sortBy: sortBy || 'createdAt',
      sortOrder,
      startDate,
      endDate,
    };

    exportData('/api/finance/payments/export', {
      format: 'excel',
      // 导出接口接收通用的 Record<string, unknown>，这里显式转换类型
      filters: filters as unknown as Record<string, unknown>,
    });
  }, [
    exportData,
    search,
    status,
    paymentMethod,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  ]);

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: PaymentsQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (filters.paymentMethod) {
          params.set('paymentMethod', filters.paymentMethod);
        }
        if (filters.sortBy) {
          params.set('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set('sortOrder', filters.sortOrder);
        }
        if (filters.startDate) {
          params.set('startDate', filters.startDate);
        }
        if (filters.endDate) {
          params.set('endDate', filters.endDate);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/finance/payments?${params.toString()}`);
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
        paymentMethod,
        sortBy,
        sortOrder,
        page: 1,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      initialParams,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      let nextStatus = status;
      let nextPaymentMethod = paymentMethod;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;

      if (key === 'status') {
        nextStatus =
          value && value !== 'all' ? (value as PaymentStatus) : undefined;
        setStatus(nextStatus);
      } else if (key === 'paymentMethod') {
        nextPaymentMethod = value;
        setPaymentMethod(value);
      } else if (key === 'sortBy') {
        nextSortBy = value || 'createdAt';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = (value as 'asc' | 'desc') || 'desc';
        setSortOrder(nextSortOrder);
      }

      const nextFilters: PaymentsQueryParams = {
        ...initialParams,
        page: 1,
        status: nextStatus,
        paymentMethod: nextPaymentMethod,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
        startDate,
        endDate,
      };

      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (nextFilters.status) {
          params.set('status', nextFilters.status);
        }
        if (nextFilters.paymentMethod) {
          params.set('paymentMethod', nextFilters.paymentMethod);
        }
        if (nextFilters.sortBy) {
          params.set('sortBy', nextFilters.sortBy);
        }
        if (nextFilters.sortOrder) {
          params.set('sortOrder', nextFilters.sortOrder);
        }
        if (nextFilters.startDate) {
          params.set('startDate', nextFilters.startDate);
        }
        if (nextFilters.endDate) {
          params.set('endDate', nextFilters.endDate);
        }
        if (nextFilters.limit) {
          params.set('limit', nextFilters.limit.toString());
        }

        router.push(`/finance/payments?${params.toString()}`);
      });
    },
    [
      router,
      search,
      initialParams,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
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
        if (paymentMethod) {
          params.set('paymentMethod', paymentMethod);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        if (startDate) {
          params.set('startDate', startDate);
        }
        if (endDate) {
          params.set('endDate', endDate);
        }
        if (page > 1) {
          params.set('page', page.toString());
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.push(`/finance/payments?${params.toString()}`);
      });
    },
    [
      router,
      search,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      initialParams.limit,
    ]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      const nextStart = range.startDate || undefined;
      const nextEnd = range.endDate || undefined;

      setStartDate(nextStart);
      setEndDate(nextEnd);

      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (status) {
          params.set('status', status);
        }
        if (paymentMethod) {
          params.set('paymentMethod', paymentMethod);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }
        if (nextStart) {
          params.set('startDate', nextStart);
        }
        if (nextEnd) {
          params.set('endDate', nextEnd);
        }

        router.push(`/finance/payments?${params.toString()}`);
      });
    },
    [
      router,
      search,
      status,
      paymentMethod,
      sortBy,
      sortOrder,
      initialParams.limit,
    ]
  );

  const handleRefresh = React.useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-success))] shadow-lg shadow-green-600/30 sm:h-12 sm:w-12">
                  <ChineseYuan className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl sm:font-bold">
                    收款记录
                  </h1>
                  <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                    管理销售订单的收款记录，跟踪收款状态和金额
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? '导出中...' : '导出'}
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payments/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建收款
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 客户端交互组件 */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          }
        >
          <PaymentsClient
            initialData={initialData}
            initialParams={initialParams}
            onSearch={handleSearch}
            onFilter={handleFilter}
            onDateRangeChange={handleDateRangeChange}
            onPageChange={handlePageChange}
            onRefresh={handleRefresh}
          />
        </Suspense>
      </div>
    </div>
  );
}
