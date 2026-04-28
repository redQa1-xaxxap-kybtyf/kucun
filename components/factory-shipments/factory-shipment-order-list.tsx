'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  getFactoryShipmentOrders,
  useCancelFactoryShipmentOrder,
  useDeleteFactoryShipmentOrder,
} from '@/lib/api/factory-shipments';
import { queryKeys } from '@/lib/queryKeys';
import type {
  FactoryShipmentOrder,
  FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import type { FactoryShipmentOrderListParams } from '@/lib/validations/factory-shipment';

import {
  OrderActionDialog,
  type ActionDialogState,
  type OrderActionType,
} from './factory-shipment-order-action-dialog';
import { FactoryShipmentOrderListView } from './factory-shipment-order-list-view';

interface FactoryShipmentQueryParams {
  page?: number;
  limit?: number;
  mode?: 'customer_direct' | 'factory';
  search?: string;
  status?: FactoryShipmentStatus;
  startDate?: Date;
  endDate?: Date;
}

interface FactoryShipmentOrderListProps {
  onOrderSelect?: (order: FactoryShipmentOrder) => void;
  initialParams?: FactoryShipmentQueryParams;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: { startDate?: string; endDate?: string }) => void;
  onPageChange?: (page: number) => void;
}

type FactoryShipmentOrdersQueryResult = {
  orders: FactoryShipmentOrder[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

export function FactoryShipmentOrderList({
  onOrderSelect,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onDateRangeChange: externalOnDateRangeChange,
  onPageChange: externalOnPageChange,
}: FactoryShipmentOrderListProps) {
  const { toast } = useToast();

  const filters = useFactoryShipmentFilters({
    initialParams,
    onSearch: externalOnSearch,
    onFilter: externalOnFilter,
    onDateRangeChange: externalOnDateRangeChange,
    onPageChange: externalOnPageChange,
  });

  const { data, isLoading, isFetching, error, refetch } =
    useFactoryShipmentOrders(filters.queryFilters);

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const isRefreshing = !isLoading && isFetching;

  const cancelOrderMutation = useCancelFactoryShipmentOrder();
  const deleteOrderMutation = useDeleteFactoryShipmentOrder();

  const orderActions = useFactoryShipmentOrderActions({
    toast,
    cancelMutation: cancelOrderMutation,
    deleteMutation: deleteOrderMutation,
  });

  return (
    <>
      <FactoryShipmentOrderListView
        mode={initialParams?.mode}
        searchValue={filters.searchInput}
        statusFilter={filters.statusFilter}
        dateRange={filters.dateRange}
        isSearching={filters.isSearching || (isFetching && !isLoading)}
        onSearch={filters.handleSearch}
        onStatusChange={filters.handleStatusChange}
        onDateRangeChange={filters.handleDateRangeChange}
        onClearFilters={filters.handleClearFilters}
        orders={orders}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error}
        pagination={pagination}
        onPageChange={filters.handlePageChange}
        onCancelRequest={order =>
          orderActions.openActionDialog('cancel', order)
        }
        onDeleteRequest={order =>
          orderActions.openActionDialog('delete', order)
        }
        onOrderSelect={onOrderSelect}
        onRetry={refetch}
      />
      <OrderActionDialog
        action={orderActions.actionDialog}
        onClose={orderActions.closeActionDialog}
        onConfirm={orderActions.handleConfirmAction}
        isPending={orderActions.isActionPending}
      />
    </>
  );
}

interface FactoryShipmentFiltersOptions {
  initialParams?: FactoryShipmentQueryParams;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: { startDate?: string; endDate?: string }) => void;
  onPageChange?: (page: number) => void;
}

function useFactoryShipmentFilters({
  initialParams,
  onSearch,
  onFilter,
  onDateRangeChange,
  onPageChange,
}: FactoryShipmentFiltersOptions) {
  const mode = initialParams?.mode;
  const [committedSearch, setCommittedSearch] = React.useState(
    initialParams?.search ?? ''
  );
  const [statusFilter, setStatusFilter] = React.useState<
    FactoryShipmentStatus | 'all'
  >(initialParams?.status ?? 'all');
  const [dateRange, setDateRange] = React.useState<{
    startDate?: string;
    endDate?: string;
  }>({
    startDate: toDateInputValue(initialParams?.startDate),
    endDate: toDateInputValue(initialParams?.endDate),
  });
  const [currentPage, setCurrentPage] = React.useState(
    initialParams?.page ?? 1
  );
  const pageSize = initialParams?.limit ?? 20;

  React.useEffect(() => {
    setCommittedSearch(initialParams?.search ?? '');
    setStatusFilter(initialParams?.status ?? 'all');
    setDateRange({
      startDate: toDateInputValue(initialParams?.startDate),
      endDate: toDateInputValue(initialParams?.endDate),
    });
    setCurrentPage(initialParams?.page ?? 1);
  }, [
    initialParams?.endDate,
    initialParams?.page,
    initialParams?.search,
    initialParams?.startDate,
    initialParams?.status,
  ]);

  const {
    searchInput,
    isSearching,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
  } = useListSearchController({
    committedValue: committedSearch,
    onCommit: search => {
      const nextSearch = search ?? '';
      setCommittedSearch(nextSearch);
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput) ?? '';
    setCommittedSearch(nextSearch);
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  const handleSearch = React.useCallback(
    (value: string) => {
      setCurrentPage(1);
      onSearch?.(value);
      handleSearchChange(value);
    },
    [handleSearchChange, onSearch]
  );

  const handleStatusChange = React.useCallback(
    (value: FactoryShipmentStatus | 'all') => {
      setStatusFilter(value);
      setCurrentPage(1);
      syncPendingSearch();
      onFilter?.('status', value === 'all' ? undefined : value);
    },
    [onFilter, syncPendingSearch]
  );

  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      setDateRange(range);
      setCurrentPage(1);
      syncPendingSearch();
      onDateRangeChange?.(range);
    },
    [onDateRangeChange, syncPendingSearch]
  );

  const handleClearFilters = React.useCallback(() => {
    // ✅ 修复：完整清空所有筛选条件
    cancelPendingCommit();
    setSearchInput('');
    setStatusFilter('all');
    setDateRange({});
    setCommittedSearch('');
    setCurrentPage(1);

    // ✅ 通知父组件状态变化
    onFilter?.('status', undefined);
    onDateRangeChange?.({});
    onSearch?.(''); // ✅ 新增：通知父组件搜索词已清空
  }, [
    cancelPendingCommit,
    onFilter,
    onDateRangeChange,
    onSearch,
    setSearchInput,
  ]);

  const handlePageChange = React.useCallback(
    (page: number) => {
      setCurrentPage(page);
      syncPendingSearch();
      onPageChange?.(page);
    },
    [onPageChange, syncPendingSearch]
  );

  const queryFilters = React.useMemo(
    () =>
      buildQueryFilters({
        searchTerm: committedSearch,
        statusFilter,
        dateRange,
        currentPage,
        pageSize,
        mode,
      }),
    [committedSearch, statusFilter, dateRange, currentPage, pageSize, mode]
  );

  return {
    searchInput,
    isSearching,
    statusFilter,
    dateRange,
    queryFilters,
    handleSearch,
    handleStatusChange,
    handleDateRangeChange,
    handleClearFilters,
    handlePageChange,
  };
}

function useFactoryShipmentOrders(filters: FactoryShipmentOrderListParams) {
  return useQuery<FactoryShipmentOrdersQueryResult>({
    queryKey: queryKeys.factoryShipments.list(filters),
    queryFn: async () => {
      const response = await getFactoryShipmentOrders(filters);
      return {
        orders: response.data,
        pagination: {
          page: response.page,
          limit: response.limit,
          totalCount: response.total,
          totalPages:
            response.limit > 0 ? Math.ceil(response.total / response.limit) : 0,
        },
      };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData,
    refetchOnMount: false,
    // ✅ 添加轮询机制，每2分钟自动刷新一次
    // 这样可以及时显示自动查询（定时任务）更新的运输状态
    // 2分钟的间隔既能及时更新，又不会造成过多的服务器请求
    refetchInterval: 2 * 60 * 1000, // 2分钟
    // 只在窗口可见时轮询，避免后台浪费资源
    refetchIntervalInBackground: false,
  });
}

interface UseFactoryShipmentOrderActionsOptions {
  toast: ReturnType<typeof useToast>['toast'];
  cancelMutation: ReturnType<typeof useCancelFactoryShipmentOrder>;
  deleteMutation: ReturnType<typeof useDeleteFactoryShipmentOrder>;
}

function useFactoryShipmentOrderActions({
  toast,
  cancelMutation,
  deleteMutation,
}: UseFactoryShipmentOrderActionsOptions) {
  const [actionDialog, setActionDialog] =
    React.useState<ActionDialogState | null>(null);

  const openActionDialog = React.useCallback(
    (type: OrderActionType, order: FactoryShipmentOrder) => {
      setActionDialog({ type, order });
    },
    []
  );

  const closeActionDialog = React.useCallback(() => {
    setActionDialog(null);
  }, []);

  const handleConfirmAction = React.useCallback(async () => {
    if (!actionDialog) {
      return;
    }

    const { type, order } = actionDialog;

    try {
      if (type === 'delete') {
        await deleteMutation.mutateAsync(order.id);
      } else {
        await cancelMutation.mutateAsync(order.id);
      }

      toast({
        title: type === 'delete' ? '删除成功' : '取消成功',
        description: `订单 ${order.orderNumber} 已${type === 'delete' ? '删除' : '取消'}。`,
        variant: 'success',
      });

      setActionDialog(null);
    } catch (error) {
      toast({
        title: '操作失败',
        description:
          error instanceof Error ? error.message : '请求失败，请稍后重试',
        variant: 'destructive',
      });
    }
  }, [actionDialog, cancelMutation, deleteMutation, toast]);

  const isActionPending = cancelMutation.isPending || deleteMutation.isPending;

  return {
    actionDialog,
    openActionDialog,
    closeActionDialog,
    handleConfirmAction,
    isActionPending,
  };
}

interface BuildQueryFiltersArgs {
  searchTerm: string;
  statusFilter: FactoryShipmentStatus | 'all';
  dateRange: { startDate?: string; endDate?: string };
  currentPage: number;
  pageSize: number;
  mode?: 'customer_direct' | 'factory';
}

function buildQueryFilters({
  searchTerm,
  statusFilter,
  dateRange,
  currentPage,
  pageSize,
  mode,
}: BuildQueryFiltersArgs): FactoryShipmentOrderListParams {
  const trimmedSearch = searchTerm.trim();
  const filters: FactoryShipmentOrderListParams = {
    page: currentPage,
    limit: pageSize,
  };
  if (mode) {
    filters.mode = mode;
  }

  // ✅ 修复：使用 search 参数而不是同时传递 containerNumber 和 orderNumber
  // 这样 API 路由会使用 OR 逻辑进行搜索
  if (trimmedSearch) {
    filters.search = trimmedSearch;
  }

  if (statusFilter !== 'all') {
    filters.status = statusFilter;
  }

  const start = toDate(dateRange.startDate);
  if (start) {
    filters.startDate = start;
  }

  const end = toDate(dateRange.endDate);
  if (end) {
    filters.endDate = end;
  }

  return filters;
}

function toDateInputValue(value?: Date | string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

function toDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}
