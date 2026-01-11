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
type ReceivablesQueryError = Error & {
  statusCode?: number;
  isTimeout?: boolean;
};

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
  initialData?: ReceivablesResult;
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

  const { data, isLoading, isFetching, error } =
    useReceivablesQuery(queryParams);
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
      const normalized = value.trim().replace(/\s+/g, ' ');
      setSearchInput(normalized);

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      if (normalized === '') {
        setIsSearching(false);
        updateParams({ search: undefined, page: 1 });
        return;
      }

      setIsSearching(true);

      searchTimerRef.current = setTimeout(() => {
        updateParams({ search: normalized, page: 1 });
        searchTimerRef.current = null;
      }, 300);
    },
    [updateParams]
  );

  // 如果有服务端传入的 initialData，则首屏不展示加载骨架，而是直接使用 initialData。
  // 当后续触发重新请求时（搜索/筛选），仍然通过 isLoading + isFetching 控制加载状态。
  const effectiveIsLoading =
    !data && !!initialData && isLoading ? false : isLoading;

  const currentData =
    data?.data ?? initialData ?? createEmptyReceivablesResult(queryParams);

  return {
    queryParams,
    currentData,
    isLoading: effectiveIsLoading,
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

function createEmptyReceivablesResult(
  queryParams: ReceivablesQueryParams
): ReceivablesResult {
  return {
    receivables: [],
    pagination: {
      page: queryParams.page ?? 1,
      limit: queryParams.limit ?? 20,
      total: 0,
      totalPages: 0,
    },
    summary: {
      totalReceivable: 0,
      receivableCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      partialCount: 0,
      pendingCount: 0,
      collectionRate: 0,
      collectionRateChange: 0,
    },
  };
}

function useReceivablesQuery(queryParams: ReceivablesQueryParams) {
  return useQuery<ReceivablesQueryResponse, ReceivablesQueryError>({
    queryKey: queryKeys.finance.receivablesList(queryParams),
    queryFn: () => fetchReceivables(queryParams),
    // 不直接使用 React Query 的 initialData，而是在 Hook 外部使用 initialData 回退。
    // 这样可以确保当后台请求失败时，error 状态能够正确暴露给 UI 和单元测试。
    staleTime: FINANCE_RECEIVABLES_STALE_TIME_MS,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: 'always',
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    // 错误重试策略：为了保证错误能够尽快反馈给用户，这里不做自动重试。
    // 如需在生产环境中开启部分错误重试，可以在全局 QueryClient 中统一配置。
    retry: () => false,
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
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  // 使用 Promise.race 实现超时控制，避免依赖 fetch 对 AbortSignal 的实现细节
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(
        '请求超时，请稍后重试'
      ) as ReceivablesQueryError;
      timeoutError.name = 'TimeoutError';
      timeoutError.statusCode = 408;
      timeoutError.isTimeout = true;
      // 仍然尝试中止 fetch 请求，防止资源浪费
      controller.abort();
      reject(timeoutError);
    }, 30000);
  });

  try {
    const response = (await Promise.race([
      fetch(`/api/finance/receivables?${params}`, {
        signal: controller.signal,
      }),
      timeoutPromise,
    ])) as Response;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as any).error ||
        (errorData as any).message ||
        '获取应收账款失败';
      const error = new Error(errorMessage) as ReceivablesQueryError;
      error.statusCode = response.status;
      throw error;
    }

    return response.json();
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (error instanceof Error) {
      const typedError = error as ReceivablesQueryError;

      // 统一处理超时：AbortError 或我们自定义的 TimeoutError
      if (
        typedError.isTimeout ||
        typedError.name === 'TimeoutError' ||
        typedError.name === 'AbortError'
      ) {
        const timeoutError = new Error(
          '请求超时，请稍后重试'
        ) as ReceivablesQueryError;
        timeoutError.name = 'TimeoutError';
        timeoutError.statusCode = 408;
        timeoutError.isTimeout = true;
        throw timeoutError;
      }

      // 其余错误按原样抛出，交给 React Query 处理
      throw typedError;
    }

    throw new Error('获取应收账款失败');
  }
}
