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
      debounceMs: 300,
      shallow: true,
      initialParams,
    }
  );

  const { data, isLoading, error } = useReceivablesQuery(queryParams, initialData);
  const paymentDialogState = usePaymentDialogState();
  const handlers = useReceivablesHandlers(updateParams);

  const currentData = data?.data || initialData;

  return {
    queryParams,
    currentData,
    isLoading,
    error,
    ...handlers,
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
    refetchOnWindowFocus: true,
  });
}

function usePaymentDialogState() {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<PaymentDialogOrder | null>(
    null
  );

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

  return { isPaymentDialogOpen, setIsPaymentDialogOpen, selectedOrder, openPaymentDialog };
}

/**
 * ✅ 重构：使用 updateParams 简化事件处理
 */
function useReceivablesHandlers(
  updateParams: (updates: Partial<ReceivablesQueryParams>) => void
) {
  const handleSearch = React.useCallback(
    (value: string) => {
      updateParams({ search: value, page: 1 });
    },
    [updateParams]
  );

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
    handleSearch,
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

  const response = await fetch(`/api/finance/receivables?${params}`);
  if (!response.ok) {
    throw new Error('获取应收账款失败');
  }

  return response.json();
}
