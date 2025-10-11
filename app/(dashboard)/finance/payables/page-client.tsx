'use client';

import { CreditCard, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PayablesClient } from '@/components/finance/payables-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type {
  PayableRecordDetail,
  PayableSourceType,
  PayableStatus,
} from '@/lib/types/payable';
import { PAYABLE_SORT_OPTIONS } from '@/lib/types/payable';

type PayableSortField = 'createdAt' | 'payableAmount' | 'dueDate' | 'remainingAmount';

const PAYABLE_STATUS_VALUES: PayableStatus[] = [
  'pending',
  'partial',
  'paid',
  'overdue',
  'cancelled',
];

const PAYABLE_SOURCE_VALUES: PayableSourceType[] = [
  'purchase_order',
  'factory_shipment',
  'sales_order',
  'service',
  'other',
];

interface PayablesQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: PayableStatus;
  sourceType?: PayableSourceType;
  sortBy?: PayableSortField;
  sortOrder?: 'asc' | 'desc';
}

interface PayablesPageClientProps {
  initialData: {
    payables: PayableRecordDetail[];
    statistics: {
      totalPayables: number;
      totalPaidAmount: number;
      totalRemainingAmount: number;
      overdueAmount: number;
      pendingCount: number;
      paidCount: number;
      overdueCount: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: PayablesQueryParams;
}

/**
 * 应付款页面客户端组件
 * 负责用户交互和状态管理
 */
export function PayablesPageClient({
  initialData,
  initialParams,
}: PayablesPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  const payableSortValues = React.useMemo(
    () => PAYABLE_SORT_OPTIONS.map(option => option.value),
    []
  );

  const isPayableStatus = React.useCallback(
    (value?: string): value is PayableStatus =>
      !!value && PAYABLE_STATUS_VALUES.includes(value as PayableStatus),
    []
  );

  const isPayableSourceType = React.useCallback(
    (value?: string): value is PayableSourceType =>
      !!value && PAYABLE_SOURCE_VALUES.includes(value as PayableSourceType),
    []
  );

  const isPayableSortField = React.useCallback(
    (value?: string): value is PayableSortField =>
      !!value && payableSortValues.includes(value as PayableSortField),
    [payableSortValues]
  );

  const normalizedInitialParams = React.useMemo<PayablesQueryParams>(() => {
    const next: PayablesQueryParams = {
      page: initialParams.page || 1,
      limit: initialParams.limit || 20,
      search: initialParams.search || '',
      status: undefined,
      sourceType: undefined,
      sortBy: 'createdAt',
      sortOrder: initialParams.sortOrder === 'asc' ? 'asc' : 'desc',
    };

    if (isPayableStatus(initialParams.status)) {
      next.status = initialParams.status;
    }

    if (isPayableSourceType(initialParams.sourceType)) {
      next.sourceType = initialParams.sourceType;
    }

    if (isPayableSortField(initialParams.sortBy)) {
      next.sortBy = initialParams.sortBy;
    }

    return next;
  }, [
    initialParams.limit,
    initialParams.page,
    initialParams.search,
    initialParams.sortBy,
    initialParams.sortOrder,
    initialParams.sourceType,
    initialParams.status,
    isPayableSourceType,
    isPayableSortField,
    isPayableStatus,
  ]);

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(normalizedInitialParams.search || '');
  const [status, setStatus] = React.useState<PayableStatus | undefined>(
    normalizedInitialParams.status
  );
  const [sourceType, setSourceType] = React.useState<
    PayableSourceType | undefined
  >(normalizedInitialParams.sourceType);
  const [sortBy, setSortBy] = React.useState<PayableSortField>(
    normalizedInitialParams.sortBy || 'createdAt'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    normalizedInitialParams.sortOrder || 'desc'
  );

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: PayablesQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (filters.sourceType) {
          params.set('sourceType', filters.sourceType);
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

        router.push(`/finance/payables?${params.toString()}`);
      });
    },
    300
  );

  // 搜索处理 - 立即更新本地状态，防抖更新URL
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        page: 1,
        limit: normalizedInitialParams.limit,
        search: value || undefined,
        status,
        sourceType,
        sortBy,
        sortOrder,
      });
    },
    [
      debouncedUpdateURL,
      normalizedInitialParams.limit,
      sortBy,
      sortOrder,
      sourceType,
      status,
    ]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      let nextStatus = status;
      let nextSourceType = sourceType;
      let nextSortBy = sortBy;
      let nextSortOrder = sortOrder;
      let nextLimit = normalizedInitialParams.limit;

      if (key === 'status') {
        nextStatus = isPayableStatus(value) ? value : undefined;
        setStatus(nextStatus);
      } else if (key === 'sourceType') {
        nextSourceType = isPayableSourceType(value) ? value : undefined;
        setSourceType(nextSourceType);
      } else if (key === 'sortBy') {
        nextSortBy = isPayableSortField(value) ? value : 'createdAt';
        setSortBy(nextSortBy);
      } else if (key === 'sortOrder') {
        nextSortOrder = value === 'asc' ? 'asc' : 'desc';
        setSortOrder(nextSortOrder);
      } else if (key === 'limit') {
        const parsed = value ? Number.parseInt(value, 10) : nextLimit;
        if (Number.isFinite(parsed) && parsed > 0) {
          nextLimit = parsed;
        }
      }

      debouncedUpdateURL(search, {
        page: 1,
        limit: nextLimit,
        search: search || undefined,
        status: nextStatus,
        sourceType: nextSourceType,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      });
    },
    [
      debouncedUpdateURL,
      isPayableSortField,
      isPayableSourceType,
      isPayableStatus,
      normalizedInitialParams.limit,
      search,
      sortBy,
      sortOrder,
      sourceType,
      status,
    ]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      debouncedUpdateURL(search, {
        page,
        limit: normalizedInitialParams.limit,
        search: search || undefined,
        status,
        sourceType,
        sortBy,
        sortOrder,
      });
    },
    [
      debouncedUpdateURL,
      normalizedInitialParams.limit,
      search,
      sortBy,
      sortOrder,
      sourceType,
      status,
    ]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    应付款管理
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    管理供应商应付款和付款记录，跟踪付款状态和逾期情况
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
                  <Link href="/finance/payables/export">
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Link>
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payables/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建应付款
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
          <PayablesClient
            initialData={initialData}
            initialParams={normalizedInitialParams}
            onSearch={handleSearch}
            onFilter={handleFilter}
            onPageChange={handlePageChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
