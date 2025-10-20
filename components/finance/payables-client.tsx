'use client';

import { CheckCircle, Clock, DollarSign } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { usePayableRecords } from '@/lib/api/payables';
import {
  type PayableRecordDetail,
  type PayableRecordQuery,
  type PayableSourceType,
  type PayableStatus,
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_VARIANTS,
} from '@/lib/types/payable';
import { formatCurrency } from '@/lib/utils/format';

const isValidSortField = (
  value: string | undefined
): value is PayableRecordQuery['sortBy'] =>
  value === 'createdAt' ||
  value === 'payableAmount' ||
  value === 'remainingAmount';

const areQueriesEqual = (a: PayableRecordQuery, b: PayableRecordQuery) =>
  a.page === b.page &&
  a.limit === b.limit &&
  a.search === b.search &&
  a.status === b.status &&
  a.sourceType === b.sourceType &&
  a.sortBy === b.sortBy &&
  a.sortOrder === b.sortOrder &&
  a.startDate === b.startDate &&
  a.endDate === b.endDate;

interface PayablesClientProps {
  initialStatistics: {
    totalPayables: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    pendingCount: number;
    partialCount: number;
    paidCount: number;
  };
  initialParams?: PayableRecordQuery;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
}

/**
 * 应付款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function PayablesClient({
  initialStatistics,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onDateRangeChange: externalOnDateRangeChange,
  onPageChange: externalOnPageChange,
}: PayablesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const derivedQuery = React.useMemo<PayableRecordQuery>(() => {
    const rawPage =
      typeof initialParams?.page === 'number'
        ? initialParams.page
        : Number.parseInt(searchParams.get('page') || '1', 10);

    const rawLimit =
      typeof initialParams?.limit === 'number'
        ? initialParams.limit
        : Number.parseInt(searchParams.get('limit') || '20', 10);

    const rawSearch =
      typeof initialParams?.search === 'string'
        ? initialParams.search
        : (searchParams.get('search') ?? undefined);

    const rawStatus =
      initialParams?.status ??
      ((searchParams.get('status') as PayableStatus) || undefined);

    const rawSourceType =
      initialParams?.sourceType ??
      ((searchParams.get('sourceType') as PayableSourceType) || undefined);

    const sortByFromParams = searchParams.get('sortBy') || undefined;
    const rawSortBy =
      initialParams?.sortBy ??
      (isValidSortField(sortByFromParams) ? sortByFromParams : undefined);

    const rawSortOrder =
      initialParams?.sortOrder ??
      (searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc');

    const rawStartDate =
      initialParams?.startDate ?? searchParams.get('startDate') ?? undefined;
    const rawEndDate =
      initialParams?.endDate ?? searchParams.get('endDate') ?? undefined;

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;

    const normalizedSearch =
      typeof rawSearch === 'string' && rawSearch.trim().length > 0
        ? rawSearch.trim()
        : undefined;

    const sortBy = rawSortBy ?? 'createdAt';
    const sortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';

    return {
      page,
      limit,
      search: normalizedSearch,
      status: rawStatus,
      sourceType: rawSourceType,
      sortBy,
      sortOrder,
      startDate: rawStartDate || undefined,
      endDate: rawEndDate || undefined,
    };
  }, [initialParams, searchParams]);

  const [query, setQuery] = React.useState<PayableRecordQuery>(derivedQuery);

  React.useEffect(() => {
    setQuery(prev =>
      areQueriesEqual(prev, derivedQuery) ? prev : derivedQuery
    );
  }, [derivedQuery]);

  // 获取应付款记录列表
  const { data: payablesData, isLoading: payablesLoading } =
    usePayableRecords(query);

  const payables = payablesData?.data ?? [];
  const pagination = payablesData?.pagination;

  // 处理搜索
  const handleSearch = React.useCallback(
    (search: string) => {
      const trimmed = search.trim();
      setQuery(prev => {
        const next: PayableRecordQuery = {
          ...prev,
          search: trimmed ? trimmed : undefined,
          page: 1,
        };
        return areQueriesEqual(prev, next) ? prev : next;
      });

      externalOnSearch?.(search);
    },
    [externalOnSearch]
  );

  // 统一处理筛选器变更
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      setQuery(prev => {
        const next: PayableRecordQuery = { ...prev };
        let changed = false;

        if (key === 'status') {
          const nextStatus =
            value === 'all' || !value ? undefined : (value as PayableStatus);
          if (next.status !== nextStatus) {
            next.status = nextStatus;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'sourceType') {
          const nextSource =
            value === 'all' || !value
              ? undefined
              : (value as PayableSourceType);
          if (next.sourceType !== nextSource) {
            next.sourceType = nextSource;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'sortBy') {
          const nextSort = isValidSortField(value) ? value : 'createdAt';
          if (next.sortBy !== nextSort) {
            next.sortBy = nextSort;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'sortOrder') {
          const nextOrder = value === 'asc' ? 'asc' : 'desc';
          if (next.sortOrder !== nextOrder) {
            next.sortOrder = nextOrder;
            next.page = 1;
            changed = true;
          }
        } else if (key === 'limit') {
          const parsed = value ? Number.parseInt(value, 10) : NaN;
          if (Number.isFinite(parsed) && parsed > 0 && next.limit !== parsed) {
            next.limit = parsed;
            next.page = 1;
            changed = true;
          }
        } else {
          return prev;
        }

        if (!changed) {
          return prev;
        }

        return next;
      });

      externalOnFilter?.(key, value);
    },
    [externalOnFilter]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      setQuery(prev => {
        const next: PayableRecordQuery = {
          ...prev,
          startDate: range.startDate,
          endDate: range.endDate,
          page: 1,
        };

        return areQueriesEqual(prev, next) ? prev : next;
      });

      externalOnDateRangeChange?.(range);
    },
    [externalOnDateRangeChange]
  );

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      setQuery(prev => {
        if (prev.page === newPage) {
          return prev;
        }
        return { ...prev, page: newPage };
      });

      if (externalOnPageChange) {
        externalOnPageChange(newPage);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [externalOnPageChange]
  );

  const statistics = initialStatistics;
  const totalTrackedCount =
    statistics.pendingCount + statistics.partialCount + statistics.paidCount;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应付金额</CardTitle>
            <DollarSign className="h-4 w-4 text-[hsl(var(--color-error))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-error))]">
              {formatCurrency(statistics.totalPayables)}
            </div>
            <p className="text-muted-foreground text-xs">
              共 {totalTrackedCount} 个应付订单
            </p>
            <p className="text-muted-foreground text-xs">
              待付款 {statistics.pendingCount} · 部分付款{' '}
              {statistics.partialCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已付金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-[hsl(var(--color-success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(statistics.totalPaidAmount)}
            </div>
            <p className="text-muted-foreground text-xs">
              付款率{' '}
              {statistics.totalPayables > 0
                ? Math.round(
                    (statistics.totalPaidAmount / statistics.totalPayables) *
                      100
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">剩余应付</CardTitle>
            <Clock className="h-4 w-4 text-[hsl(var(--color-warning))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
              {formatCurrency(statistics.totalRemainingAmount)}
            </div>
            <p className="text-muted-foreground text-xs">待付款金额</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card className="border border-[hsl(var(--color-border-secondary))]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[280px] flex-1">
              <UnifiedSearchBar
                searchValue={query.search || ''}
                onSearchChange={handleSearch}
                searchPlaceholder="搜索应付款单号或供应商名称..."
                debounceDelay={400}
                filters={[
                  {
                    key: 'status',
                    label: '状态',
                    options: [
                      { label: '全部状态', value: 'all' },
                      { label: '待付款', value: 'pending' },
                      { label: '部分付款', value: 'partial' },
                      { label: '已付款', value: 'paid' },
                      { label: '已取消', value: 'cancelled' },
                    ],
                    width: 'w-[140px]',
                  },
                  {
                    key: 'sourceType',
                    label: '来源类型',
                    options: [
                      { label: '全部来源', value: 'all' },
                      { label: '采购订单', value: 'purchase_order' },
                      { label: '厂家发货', value: 'factory_shipment' },
                      { label: '服务费用', value: 'service' },
                      { label: '其他', value: 'other' },
                    ],
                    width: 'w-[140px]',
                  },
                  {
                    key: 'sortBy',
                    label: '排序',
                    options: [
                      { label: '创建时间', value: 'createdAt' },
                      { label: '应付金额', value: 'payableAmount' },
                      { label: '剩余金额', value: 'remainingAmount' },
                    ],
                    width: 'w-[140px]',
                  },
                  {
                    key: 'sortOrder',
                    label: '排序方向',
                    options: [
                      { label: '降序', value: 'desc' },
                      { label: '升序', value: 'asc' },
                    ],
                    width: 'w-[100px]',
                  },
                ]}
                filterValues={{
                  status: query.status || 'all',
                  sourceType: query.sourceType || 'all',
                  sortBy: query.sortBy || 'createdAt',
                  sortOrder: query.sortOrder,
                }}
                onFilterChange={handleFilterChange}
              />
            </div>
            <DateRangePicker
              value={{
                startDate: query.startDate,
                endDate: query.endDate,
              }}
              onChange={handleDateRangeChange}
              label=""
              placeholder="选择单据日期范围"
              showPresets
              className="min-w-[220px]"
            />
          </div>

          {/* 应付款列表 */}
          <div className="mt-6 space-y-4">
            {payablesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : payables.length === 0 ? (
              <EmptyState
                icon={<DollarSign className="text-muted-foreground h-8 w-8" />}
                title="暂无应付款记录"
                compact
              />
            ) : (
              payables.map((payable: PayableRecordDetail) => (
                <Card
                  key={payable.id}
                  className="transition-shadow hover:shadow-[var(--shadow-medium)]"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">
                            {payable.payableNumber}
                          </h3>
                          <Badge
                            variant={PAYABLE_STATUS_VARIANTS[payable.status]}
                          >
                            {PAYABLE_STATUS_LABELS[payable.status]}
                          </Badge>
                          <Badge variant="outline">
                            {PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          供应商：{payable.supplier.name}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                          <span>
                            创建时间：
                            {new Date(payable.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {payable.sourceNumber && (
                          <p className="text-muted-foreground text-sm">
                            来源单号：{payable.sourceNumber}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 text-right">
                        <div>
                          <p className="text-muted-foreground text-sm">
                            应付金额
                          </p>
                          <p className="font-semibold">
                            {formatCurrency(payable.payableAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            已付金额
                          </p>
                          <p className="font-semibold text-[hsl(var(--color-success))]">
                            {formatCurrency(payable.paidAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            待付金额
                          </p>
                          <p className="font-semibold text-[hsl(var(--color-warning))]">
                            {formatCurrency(payable.remainingAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/finance/payables/${payable.id}`)
                        }
                      >
                        查看详情
                      </Button>
                      {payable.remainingAmount > 0 && (
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/finance/payments-out/create?payableId=${payable.id}`
                            )
                          }
                        >
                          付款
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* 分页 */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              共 {pagination?.total || 0} 条记录
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(query.page || 1) <= 1 || payablesLoading}
                onClick={() => handlePageChange((query.page || 1) - 1)}
              >
                上一页
              </Button>
              <span className="text-muted-foreground text-sm">
                第 {query.page || 1} / {pagination?.totalPages || 1} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  (query.page || 1) >= (pagination?.totalPages || 1) ||
                  payablesLoading
                }
                onClick={() => handlePageChange((query.page || 1) + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
