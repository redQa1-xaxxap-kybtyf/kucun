'use client';

import { DollarSign, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PaymentsClient } from '@/components/finance/payments-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
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
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-success))] shadow-lg shadow-green-600/30">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    收款记录
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    管理销售订单的收款记录，跟踪收款状态和金额
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payments/export">
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Link>
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
