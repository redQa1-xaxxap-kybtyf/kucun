'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { useUrlSearchParams } from '@/hooks/url-search-params';
import { FINANCE_RECEIVABLES_STALE_TIME_MS } from '@/lib/constants/cache';
import { queryKeys } from '@/lib/queryKeys';
import { receivablesParamsSchema } from '@/lib/schemas/receivables-params';
import type {
  PaymentStatus,
  ReceivableItem,
  ReceivablesResult,
} from '@/lib/services/receivables-service';

import type { ReceivablesQueryParams, SortOrder } from './types';

type ReceivablesQueryResponse = { data: ReceivablesResult };

export type PaymentDialogOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  roundingAdjustment: number;
  paidAmount: number;
  remainingAmount: number;
};

export type ReceivablesControllerResult = {
  queryParams: ReceivablesQueryParams;
  currentData: ReceivablesResult;
  isLoading: boolean;
  isFetching: boolean;
  searchValue: string;
  isSearching: boolean;
  error: unknown;
  handleSearch: (value: string) => void;
  handleFilterChange: (key: string, value: string | undefined) => void;
  handleDateRangeChange: (range: DateRangeValue) => void;
  handlePageChange: (page: number) => void;
  handleOpenPaymentDialog: (receivable: ReceivableItem) => void;
  isPaymentDialogOpen: boolean;
  setIsPaymentDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedOrder: PaymentDialogOrder | null;
};

/**
 * 应收账款控制器 Hook
 *
 * ✅ 重构：使用 useUrlSearchParams Hook 统一管理URL参数
 * ✅ Next.js 15.4 + React 19 最佳实践
 */
export function useReceivablesController({
  initialData,
  initialParams,
}: {
  initialData: ReceivablesResult;
  initialParams?: ReceivablesQueryParams;
}): ReceivablesControllerResult {
  // ✅ 使用统一的URL参数管理Hook
  const { params: queryParams, updateParams } = useUrlSearchParams(
    receivablesParamsSchema,
    {
      basePath: '/finance/receivables',
      debounceMs: 0,
      shallow: true,
      initialParams,
    }
  );

  const [searchInput, setSearchInput] = React.useState(
    queryParams.search ?? ''
  );
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [isSearching, setIsSearching] = React.useState(false);

  React.useEffect(() => {
    setSearchInput(queryParams.search ?? '');
  }, [queryParams.search]);

  const { data, isLoading, isFetching, error } = useReceivablesQuery(
    queryParams,
    initialData
  );
  const paymentDialogState = usePaymentDialogState();
  const { handleFilterChange, handleDateRangeChange, handlePageChange } =
    useReceivablesHandlers(updateParams);

  React.useEffect(() => {
    if (!isSearching) {
      return;
    }
    if (!isLoading && !isFetching) {
      setIsSearching(false);
    }
  }, [isSearching, isLoading, isFetching]);

  React.useEffect(
    () => () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    },
    []
  );

  const handleSearch = React.useCallback(
    (value: string) => {
      const trimmed = value.trimStart();
      setSearchInput(trimmed);

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      if (trimmed === '') {
        setIsSearching(false);
        updateParams({ search: undefined, page: 1 });
        return;
      }

      setIsSearching(true);

      searchTimerRef.current = setTimeout(() => {
        updateParams({ search: trimmed, page: 1 });
        searchTimerRef.current = null;
      }, 300);
    },
    [updateParams]
  );

  const currentData = data?.data || initialData;

  return {
    queryParams,
    currentData,
    isLoading,
    isFetching,
    searchValue: searchInput,
    isSearching,
    error,
    handleSearch,
    handleFilterChange,
    handleDateRangeChange,
    handlePageChange,
    handleOpenPaymentDialog: paymentDialogState.openPaymentDialog,
    isPaymentDialogOpen: paymentDialogState.isPaymentDialogOpen,
    setIsPaymentDialogOpen: paymentDialogState.setIsPaymentDialogOpen,
    selectedOrder: paymentDialogState.selectedOrder,
  };
}

function useReceivablesQuery(
  queryParams: ReceivablesQueryParams,
  initialData: ReceivablesResult
) {
  return useQuery<ReceivablesQueryResponse>({
    queryKey: queryKeys.finance.receivablesList(queryParams),
    queryFn: () => fetchReceivables(queryParams),
    initialData: { data: initialData },
    staleTime: FINANCE_RECEIVABLES_STALE_TIME_MS,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && /4\d{2}/.test(error.message)) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

function usePaymentDialogState() {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] =
    React.useState<PaymentDialogOrder | null>(null);

  const openPaymentDialog = React.useCallback((receivable: ReceivableItem) => {
    setSelectedOrder({
      id: receivable.id,
      orderNumber: receivable.orderNumber,
      customerId: receivable.customerId,
      customerName: receivable.customerName,
      totalAmount: receivable.totalAmount,
      roundingAdjustment: receivable.roundingAdjustment ?? 0,
      paidAmount: Math.max(
        0,
        (receivable.paidAmount ?? 0) + (receivable.paymentRoundingAmount ?? 0)
      ),
      remainingAmount: receivable.remainingAmount,
    });
    setIsPaymentDialogOpen(true);
  }, []);

  return {
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    selectedOrder,
    openPaymentDialog,
  };
}

/**
 * ✅ 重构：使用 updateParams 简化事件处理
 */
function useReceivablesHandlers(
  updateParams: (updates: Partial<ReceivablesQueryParams>) => void
) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'paymentStatus') {
        updateParams({
          paymentStatus:
            !value || value === 'all' ? undefined : (value as PaymentStatus),
          page: 1,
        });
      } else if (key === 'sortBy') {
        updateParams({
          sortBy: (value || 'createdAt') as ReceivablesQueryParams['sortBy'],
          page: 1,
        });
      } else if (key === 'sortOrder') {
        updateParams({
          sortOrder: ((value as SortOrder) || 'desc') as SortOrder,
          page: 1,
        });
      }
    },
    [updateParams]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      updateParams({
        startDate: range.startDate,
        endDate: range.endDate,
        page: 1,
      });
    },
    [updateParams]
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      updateParams({ page });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [updateParams]
  );

  return {
    handleFilterChange,
    handleDateRangeChange,
    handlePageChange,
  };
}

async function fetchReceivables(
  queryParams: ReceivablesQueryParams
): Promise<ReceivablesQueryResponse> {
  const params = new URLSearchParams();
  params.set('page', queryParams.page.toString());
  params.set('limit', queryParams.limit.toString());

  if (queryParams.search) {
    params.set('search', queryParams.search);
  }
  if (queryParams.paymentStatus) {
    params.set('paymentStatus', queryParams.paymentStatus);
    params.set('status', queryParams.paymentStatus);
  }
  if (queryParams.startDate) {
    params.set('startDate', queryParams.startDate);
  }
  if (queryParams.endDate) {
    params.set('endDate', queryParams.endDate);
  }
  params.set('sortBy', queryParams.sortBy);
  params.set('sortOrder', queryParams.sortOrder);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`/api/finance/receivables?${params}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || errorData.message || '获取应收账款失败';
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw error;
    }
    throw new Error('获取应收账款失败');
  }
}
