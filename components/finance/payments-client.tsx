'use client';
import { CheckCircle, Clock, TrendingUp } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { PaymentsTableList } from '@/components/finance/payments-table-list';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { useToast } from '@/components/ui/use-toast';
import { useConfirmPayment } from '@/lib/api/payments';
import type { PaymentStatus } from '@/lib/types/payment';
import { formatCurrency } from '@/lib/utils/format';

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

interface PaymentsClientProps {
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
  initialParams?: {
    page: number;
    limit: number;
    search?: string;
    status?: PaymentStatus;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: PaymentStatus | string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
  onRefresh?: () => void;
}

/**
 * 收款率计算 Hook
 */
function useCollectionRateCalculation(statistics: {
  collectionRate?: number | null;
  totalAmount: number;
  confirmedAmount: number;
  currentMonthCollectionRate?: number | null;
  previousMonthCollectionRate?: number | null;
  collectionRateChange?: number | null;
}) {
  const overallCollectionRate =
    typeof statistics.collectionRate === 'number'
      ? statistics.collectionRate
      : statistics.totalAmount > 0
        ? (statistics.confirmedAmount / statistics.totalAmount) * 100
        : 0;

  const currentMonthCollectionRate =
    typeof statistics.currentMonthCollectionRate === 'number'
      ? statistics.currentMonthCollectionRate
      : null;

  const hasPreviousMonthData =
    typeof statistics.previousMonthCollectionRate === 'number';

  const displayedCollectionRate =
    currentMonthCollectionRate ?? overallCollectionRate;

  const collectionRateChange =
    typeof statistics.collectionRateChange === 'number'
      ? statistics.collectionRateChange
      : null;

  const collectionRateChangeLabel = React.useMemo(() => {
    if (!hasPreviousMonthData || collectionRateChange === null) {
      return '暂无上月数据';
    }

    const TOLERANCE = 0.1;
    if (Math.abs(collectionRateChange) < TOLERANCE) {
      return '较上月持平';
    }

    const value = Math.abs(collectionRateChange).toFixed(1);
    return collectionRateChange > 0
      ? `较上月提升 ${value}%`
      : `较上月下降 ${value}%`;
  }, [collectionRateChange, hasPreviousMonthData]);

  return { displayedCollectionRate, collectionRateChangeLabel };
}

/**
 * 事件处理 Hook
 */
function usePaymentEventHandlers({
  externalOnSearch,
  externalOnFilter,
  externalOnPageChange,
  externalOnDateRangeChange,
  externalOnRefresh,
}: {
  externalOnSearch?: (value: string) => void;
  externalOnFilter?: (
    key: string,
    value: PaymentStatus | string | undefined
  ) => void;
  externalOnPageChange?: (page: number) => void;
  externalOnDateRangeChange?: (range: DateRangeValue) => void;
  externalOnRefresh?: () => void;
}) {
  const { toast } = useToast();
  const confirmPaymentMutation = useConfirmPayment();
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const handleSearch = React.useCallback(
    (value: string, setSearchValue: (value: string) => void) => {
      setSearchValue(value);
      externalOnSearch?.(value);
    },
    [externalOnSearch]
  );

  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (!externalOnFilter) return;
      if (value === 'all' || !value) {
        externalOnFilter(key, undefined);
        return;
      }
      externalOnFilter(
        key,
        key === 'status' ? (value as PaymentStatus) : value
      );
    },
    [externalOnFilter]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      externalOnPageChange?.(page);
    },
    [externalOnPageChange]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      externalOnDateRangeChange?.(range);
    },
    [externalOnDateRangeChange]
  );

  const handleConfirm = React.useCallback(
    async (paymentId: string) => {
      try {
        setConfirmingId(paymentId);
        await confirmPaymentMutation.mutateAsync({ id: paymentId });
        toast({
          title: '收款已确认',
          description: '该收款记录已成功确认到账。',
          variant: 'success',
        });
        externalOnRefresh?.();
      } catch (error) {
        toast({
          title: '确认失败',
          description: error instanceof Error ? error.message : '请稍后重试',
          variant: 'destructive',
        });
      } finally {
        setConfirmingId(null);
      }
    },
    [confirmPaymentMutation, toast, externalOnRefresh]
  );

  return {
    confirmingId,
    isConfirming: confirmPaymentMutation.isPending,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    handleDateRangeChange,
    handleConfirm,
  };
}

/**
 * 收款记录客户端交互组件
 */
export function PaymentsClient({
  initialData,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onDateRangeChange: externalOnDateRangeChange,
  onPageChange: externalOnPageChange,
  onRefresh: externalOnRefresh,
}: PaymentsClientProps) {
  const { payments, statistics, pagination } = initialData;
  const [searchValue, setSearchValue] = React.useState(
    initialParams?.search ?? ''
  );

  React.useEffect(() => {
    setSearchValue(initialParams?.search ?? '');
  }, [initialParams?.search]);

  const { displayedCollectionRate, collectionRateChangeLabel } =
    useCollectionRateCalculation(statistics);

  const {
    confirmingId,
    isConfirming,
    handleSearch: baseHandleSearch,
    handleFilterChange,
    handlePageChange,
    handleDateRangeChange,
    handleConfirm,
  } = usePaymentEventHandlers({
    externalOnSearch,
    externalOnFilter,
    externalOnPageChange,
    externalOnDateRangeChange,
    externalOnRefresh,
  });

  const handleSearch = React.useCallback(
    (value: string) => baseHandleSearch(value, setSearchValue),
    [baseHandleSearch]
  );

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <PaymentStatisticsCards
        statistics={statistics}
        displayedCollectionRate={displayedCollectionRate}
        collectionRateChangeLabel={collectionRateChangeLabel}
      />

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <PaymentFilters
            searchValue={searchValue}
            initialParams={initialParams}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onDateRangeChange={handleDateRangeChange}
          />

          {/* 收款记录列表 - 表格布局 */}
          <PaymentsTableList
            payments={payments}
            pagination={pagination}
            onPageChange={handlePageChange}
            onConfirm={handleConfirm}
            confirmingId={confirmingId}
            isConfirming={isConfirming}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 统计卡片组件
 */
interface PaymentStatisticsCardsProps {
  statistics: {
    totalAmount: number;
    confirmedAmount: number;
    pendingAmount: number;
    recordCount: number;
  };
  displayedCollectionRate: number;
  collectionRateChangeLabel: string;
}

function PaymentStatisticsCards({
  statistics,
  displayedCollectionRate,
  collectionRateChangeLabel,
}: PaymentStatisticsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总收款金额</CardTitle>
          <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-success))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
            {formatCurrency(statistics.totalAmount)}
          </div>
          <p className="text-muted-foreground text-xs">
            {statistics.recordCount} 条收款记录
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            已确认 / 冲抵金额
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-[hsl(var(--color-primary))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
            {formatCurrency(statistics.confirmedAmount)}
          </div>
          <p className="text-muted-foreground text-xs">
            含预收款冲抵，确认率{' '}
            {statistics.totalAmount > 0
              ? (
                  (statistics.confirmedAmount / statistics.totalAmount) *
                  100
                ).toFixed(1)
              : 0}
            %
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">待确认金额</CardTitle>
          <Clock className="h-4 w-4 text-[hsl(var(--color-warning))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
            {formatCurrency(statistics.pendingAmount)}
          </div>
          <p className="text-muted-foreground text-xs">需要及时确认</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">收款率</CardTitle>
          <TrendingUp className="h-4 w-4 text-[hsl(var(--color-purple))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-purple))]">
            {displayedCollectionRate.toFixed(1)}%
          </div>
          <p className="text-muted-foreground text-xs">
            {collectionRateChangeLabel}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 筛选栏组件
 */
interface PaymentFiltersProps {
  searchValue: string;
  initialParams?: {
    status?: PaymentStatus;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  };
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
}

function PaymentFilters({
  searchValue,
  initialParams,
  onSearch,
  onFilterChange,
  onDateRangeChange,
}: PaymentFiltersProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearch}
      searchPlaceholder="搜索收款单号、客户名称或订单号..."
      // 筛选器配置
      filters={[
        {
          key: 'status',
          label: '状态',
          options: [
            { label: '待确认', value: 'pending' },
            { label: '已确认', value: 'confirmed' },
            { label: '已冲抵', value: 'applied' },
            { label: '已取消', value: 'cancelled' },
          ],
          width: 'w-[140px]',
        },
        {
          key: 'paymentMethod',
          label: '支付方式',
          options: [
            { label: '现金', value: 'cash' },
            { label: '银行转账', value: 'bank_transfer' },
            { label: '支付宝', value: 'alipay' },
            { label: '微信支付', value: 'wechat' },
          ],
          width: 'w-[140px]',
        },
      ]}
      filterValues={{
        status: initialParams?.status || 'all',
        paymentMethod: initialParams?.paymentMethod || 'all',
      }}
      onFilterChange={onFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '收款日期',
        value: {
          startDate: initialParams?.startDate,
          endDate: initialParams?.endDate,
        },
        onChange: onDateRangeChange,
        placeholder: '选择收款日期范围',
      }}
      variant="default"
      compact={true}
    />
  );
}
