'use client';

/* eslint-disable max-lines, max-lines-per-function */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Ban,
  Clock,
  Edit,
  Eye,
  MoreHorizontal,
  Package,
  Trash2,
  Truck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { SearchFilterCard } from '@/components/common/search-filter-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import {
  SALES_ORDER_STATUS_LABELS,
  TRANSFER_MODE_LABELS,
  type SalesOrder,
  type SalesOrderQueryParams,
  type SalesOrderStatus,
} from '@/lib/types/sales-order';

const NON_CANCELABLE_STATUSES: SalesOrderStatus[] = [
  'shipped',
  'completed',
  'cancelled',
];

interface ERPSalesOrderListProps {
  onOrderSelect?: (order: SalesOrder) => void;
  initialParams?: SalesOrderQueryParams;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  isSearching?: boolean; // ✅ 新增：搜索状态指示
  onClearFilters?: () => void;
}

/**
 * ERP风格销售订单列表组件
 * 符合中国ERP系统的标准布局和用户体验
 *
 * ✅ 修复：使用 HydrationBoundary 而不是 initialData prop
 */
export function ERPSalesOrderList({
  onOrderSelect,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onPageChange: externalOnPageChange,
  searchValue,
  isSearching = false,
  onClearFilters: externalOnClearFilters,
}: ERPSalesOrderListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showEditWarning, setShowEditWarning] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<SalesOrder | null>(
    null
  );
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(
    null
  );
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);
  const [orderPendingCancel, setOrderPendingCancel] =
    React.useState<SalesOrder | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [orderPendingDelete, setOrderPendingDelete] =
    React.useState<SalesOrder | null>(null);
  const [deletingOrderId, setDeletingOrderId] = React.useState<string | null>(
    null
  );

  const statusFilterValue = initialParams?.status ?? undefined;
  const normalizedStatus = statusFilterValue;

  // 检查是否有活跃筛选条件
  const hasActiveFilters = React.useMemo(
    () =>
      Boolean(
        normalizedStatus ||
          initialParams?.customerId ||
          initialParams?.startDate ||
          initialParams?.endDate ||
          initialParams?.orderType ||
          initialParams?.hasReturns
      ),
    [
      normalizedStatus,
      initialParams?.customerId,
      initialParams?.startDate,
      initialParams?.endDate,
      initialParams?.orderType,
      initialParams?.hasReturns,
    ]
  );

  // 清空所有筛选条件
  const handleClearFilters = React.useCallback(() => {
    if (externalOnClearFilters) {
      externalOnClearFilters();
      return;
    }

    // 重置所有筛选条件为 undefined
    externalOnFilter?.('status', undefined);
    externalOnFilter?.('customerId', undefined);
    externalOnFilter?.('startDate', undefined);
    externalOnFilter?.('endDate', undefined);
    externalOnFilter?.('orderType', undefined);
    externalOnFilter?.('hasReturns', undefined);
    externalOnFilter?.(
      'dateRange',
      JSON.stringify({ startDate: undefined, endDate: undefined })
    );
  }, [externalOnClearFilters, externalOnFilter]);

  // 切换订单类型（调货订单）
  const handleToggleTransferOrders = React.useCallback(() => {
    const isTransferActive = initialParams?.orderType === 'TRANSFER';
    externalOnFilter?.('orderType', isTransferActive ? undefined : 'TRANSFER');
  }, [externalOnFilter, initialParams?.orderType]);

  // 切换有退货订单
  const handleToggleHasReturns = React.useCallback(() => {
    const currentValue = initialParams?.hasReturns === true;
    const nextValue = !currentValue;
    externalOnFilter?.('hasReturns', String(nextValue));
  }, [externalOnFilter, initialParams?.hasReturns]);

  // ✅ 移除内部 queryParams 状态，完全依赖外部传入的 initialParams
  // ✅ 单一数据源原则：状态统一在父组件管理

  // ✅ 默认查询参数（确保类型正确）
  const queryParams: SalesOrderQueryParams = {
    page: initialParams?.page || 1,
    limit: initialParams?.limit || 20,
    search: initialParams?.search,
    status: normalizedStatus,
    customerId: initialParams?.customerId,
    sortBy: initialParams?.sortBy || 'createdAt',
    sortOrder: initialParams?.sortOrder || 'desc',
    startDate: initialParams?.startDate,
    endDate: initialParams?.endDate,
    orderType: initialParams?.orderType,
    hasReturns: initialParams?.hasReturns,
  };

  // ✅ 获取销售订单列表数据 - 从 HydrationBoundary 自动获取服务端预取的数据
  const { data, isLoading, error, isRefetching } = useQuery({
    queryKey: salesOrderQueryKeys.list(queryParams),
    queryFn: () => getSalesOrders(queryParams),
    // ✅ 移除 initialData - 数据已在 QueryClient 中（通过 HydrationBoundary）
    staleTime: 30 * 1000, // ✅ 30秒内数据视为新鲜，避免频繁请求导致数据闪烁
    refetchOnWindowFocus: false, // 避免窗口聚焦时不必要的刷新
    placeholderData: previousData => previousData, // ✅ 保持上一次数据，避免数据清空
    refetchOnMount: false, // 避免挂载时重新获取
    gcTime: 10 * 60 * 1000, // ✅ 缓存时间10分钟，提升后退/前进体验
  });

  // 区分首次加载和后台刷新
  const isInitialLoading = isLoading && !data;

  // 搜索处理 - 直接使用外部传入的处理函数
  const handleSearch = React.useCallback(
    (value: string) => {
      if (externalOnSearch) {
        externalOnSearch(value);
      }
    },
    [externalOnSearch]
  );

  // 筛选处理 - 直接使用外部传入的处理函数
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (externalOnFilter) {
        externalOnFilter(key, value);
      }
    },
    [externalOnFilter]
  );

  // 分页处理 - 直接使用外部传入的处理函数
  const handlePageChange = React.useCallback(
    (page: number) => {
      if (externalOnPageChange) {
        externalOnPageChange(page);
      }
    },
    [externalOnPageChange]
  );

  // 订单状态更新 mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      newStatus,
    }: {
      orderId: string;
      newStatus: string;
    }) => {
      const response = await fetch(`/api/sales-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新订单状态失败');
      }
      return response.json();
    },
    onSuccess: () => {
      // ✅ 关键修复：使用 refetchQueries 强制立即重新获取数据
      // invalidateQueries 只是标记为过期，不会立即刷新（受 staleTime 影响）
      // refetchQueries 会强制立即重新获取，无论 staleTime 如何设置
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });

      // ✅ 同时刷新应收款缓存
      // 因为订单状态变更会影响应收款数据
      queryClient.refetchQueries({
        queryKey: ['finance', 'receivables'],
        type: 'active',
      });

      toast({
        title: '操作成功',
        description: '订单状态已更新',
        variant: 'success',
      });
      setUpdatingOrderId(null);
    },
    onError: (error: Error) => {
      toast({
        title: '操作失败',
        description: error.message,
        variant: 'destructive',
      });
      setUpdatingOrderId(null);
    },
  });

  // 确认发货处理函数
  const handleConfirmShipment = React.useCallback(
    (order: SalesOrder, e: React.MouseEvent) => {
      e.stopPropagation();
      if (order.status !== 'confirmed') {
        toast({
          title: '操作失败',
          description: '只有已确认的订单才能发货',
          variant: 'destructive',
        });
        return;
      }
      setUpdatingOrderId(order.id);
      updateStatusMutation.mutate({ orderId: order.id, newStatus: 'shipped' });
    },
    [toast, updateStatusMutation]
  );

  const isOrderCancelable = React.useCallback(
    (status: SalesOrderStatus) => !NON_CANCELABLE_STATUSES.includes(status),
    []
  );

  const handleCancelOrderClick = React.useCallback(
    (order: SalesOrder, event: React.MouseEvent) => {
      event.stopPropagation();
      if (!isOrderCancelable(order.status)) {
        toast({
          title: '操作受限',
          description: '只有未发货的订单才能取消',
          variant: 'destructive',
        });
        return;
      }
      setOrderPendingCancel(order);
      setCancelConfirmOpen(true);
    },
    [isOrderCancelable, toast]
  );

  const handleConfirmCancelOrder = React.useCallback(() => {
    if (!orderPendingCancel) {
      return;
    }
    const orderId = orderPendingCancel.id;
    setUpdatingOrderId(orderId);
    updateStatusMutation.mutate({ orderId, newStatus: 'cancelled' });
    setCancelConfirmOpen(false);
    setOrderPendingCancel(null);
  }, [orderPendingCancel, updateStatusMutation]);

  const handleCancelDialogOpenChange = React.useCallback((open: boolean) => {
    setCancelConfirmOpen(open);
    if (!open) {
      setOrderPendingCancel(null);
    }
  }, []);

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/sales-orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '删除订单失败');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      toast({
        title: '删除成功',
        description: '销售订单已删除',
        variant: 'success',
      });
      setDeletingOrderId(null);
      setOrderPendingDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
      setDeletingOrderId(null);
    },
    onSettled: () => {
      setDeleteConfirmOpen(false);
    },
  });

  const handleDeleteOrderClick = React.useCallback(
    (order: SalesOrder, event: React.MouseEvent) => {
      event.stopPropagation();
      if (order.status !== 'cancelled') {
        toast({
          title: '操作受限',
          description: '仅已取消的订单支持删除',
          variant: 'destructive',
        });
        return;
      }
      setOrderPendingDelete(order);
      setDeleteConfirmOpen(true);
    },
    [toast]
  );

  const handleConfirmDeleteOrder = React.useCallback(() => {
    if (!orderPendingDelete) {
      return;
    }
    const orderId = orderPendingDelete.id;
    setDeletingOrderId(orderId);
    deleteOrderMutation.mutate(orderId);
  }, [deleteOrderMutation, orderPendingDelete]);

  const handleDeleteDialogOpenChange = React.useCallback((open: boolean) => {
    setDeleteConfirmOpen(open);
    if (!open) {
      setOrderPendingDelete(null);
    }
  }, []);

  // ✅ 日期筛选逻辑已移至统一的 DateRangePicker 组件
  // 移除了 getActiveDateRange 和 handleDateRangeFilter 函数
  // 现在使用 DateRangePicker 的内置快捷预设功能

  // 状态标签渲染 - 自定义颜色，更符合ERP风格
  const getStatusBadge = (status: string) => {
    const statusStyles: Record<SalesOrderStatus, string> = {
      draft:
        'border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-secondary))]',
      confirmed:
        'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]',
      shipped:
        'border-[hsl(var(--color-info))] bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]',
      completed:
        'border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
      cancelled:
        'border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
    };

    const className =
      statusStyles[status as SalesOrderStatus] ||
      'border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-secondary))]';

    return (
      <Badge variant="outline" className={`text-xs font-medium ${className}`}>
        {SALES_ORDER_STATUS_LABELS[status as SalesOrderStatus] || status}
      </Badge>
    );
  };

  // 格式化金额
  const formatAmount = (amount?: number) => {
    if (!amount) {
      return '￥0.00';
    }
    return `￥${amount.toFixed(2)}`;
  };

  // 获取收款状态Badge
  const getPaymentStatusBadge = (order: SalesOrder) => {
    const paidAmount = order.paidAmount || 0;
    const remainingAmount = order.remainingAmount || 0;

    // 已取消的订单不显示收款状态
    if (order.status === 'cancelled') {
      return (
        <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
          -
        </span>
      );
    }

    // 草稿状态显示"待确认"
    if (order.status === 'draft') {
      return (
        <Badge
          variant="outline"
          className="border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] text-xs font-medium text-[hsl(var(--color-text-secondary))]"
        >
          待确认
        </Badge>
      );
    }

    // 已确认但未发货显示"待发货"
    if (order.status === 'confirmed') {
      return (
        <Badge
          variant="outline"
          className="border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))] text-xs font-medium text-[hsl(var(--color-primary))]"
        >
          待发货
        </Badge>
      );
    }

    // 已完成订单
    if (order.status === 'completed') {
      return (
        <Badge
          variant="outline"
          className="border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-xs font-medium text-[hsl(var(--color-success))]"
        >
          已完成
        </Badge>
      );
    }

    // 已发货订单，显示收款状态
    // 未收款
    if (paidAmount === 0) {
      return (
        <Badge
          variant="outline"
          className="border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] text-xs font-medium text-[hsl(var(--color-error))]"
        >
          未收款
        </Badge>
      );
    }

    // 部分收款
    if (remainingAmount > 0.01) {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-yellow-300 bg-yellow-50 text-yellow-700"
        >
          <Clock className="h-3 w-3" />
          部分收款
        </Badge>
      );
    }

    // 全部收款
    return (
      <Badge
        variant="outline"
        className="border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-xs font-medium text-[hsl(var(--color-success))]"
      >
        已收款
      </Badge>
    );
  };

  // 格式化日期时间（显示日期和时分）
  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (error) {
    return (
      <div className="bg-card rounded border p-4">
        <div className="text-center text-red-600">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索筛选卡片 */}
      <SearchFilterCard
        searchValue={searchValue ?? initialParams?.search ?? ''}
        onSearchChange={handleSearch}
        searchPlaceholder="搜索订单号、客户名称、产品编码..."
        isSearching={isSearching || isRefetching}
        // 筛选器配置
        filters={[
          {
            key: 'status',
            label: '订单状态',
            options: [
              { label: '草稿', value: 'draft' },
              { label: '已确认', value: 'confirmed' },
              { label: '已发货', value: 'shipped' },
              { label: '已完成', value: 'completed' },
              { label: '已取消', value: 'cancelled' },
            ],
            width: 'w-[120px]',
          },
          {
            key: 'sortBy',
            label: '排序方式',
            options: [
              { label: '创建时间', value: 'createdAt' },
              { label: '订单金额', value: 'totalAmount' },
              { label: '发货时间', value: 'shippedAt' },
              { label: '更新时间', value: 'updatedAt' },
              { label: '订单号', value: 'orderNumber' },
            ],
            width: 'w-[120px]',
          },
        ]}
        filterValues={{
          status: statusFilterValue || 'all',
          sortBy: initialParams?.sortBy || 'createdAt',
        }}
        onFilterChange={handleFilterChange}
        // 日期范围筛选
        dateRangeFilter={{
          key: 'dateRange',
          label: '订单日期',
          value: {
            startDate: initialParams?.startDate,
            endDate: initialParams?.endDate,
          },
          onChange: ({ startDate, endDate }) => {
            const dateRangeJson = JSON.stringify({ startDate, endDate });
            externalOnFilter?.('dateRange', dateRangeJson);
          },
          placeholder: '选择订单日期',
        }}
        // Toggle 按钮
        toggleButtons={[
          {
            key: 'transferOrders',
            label: '调货订单',
            icon: <Truck className="mr-1 h-3 w-3" />,
            active: initialParams?.orderType === 'TRANSFER',
            onClick: handleToggleTransferOrders,
          },
          {
            key: 'hasReturns',
            label: '有退货',
            icon: <Package className="mr-1 h-3 w-3" />,
            active: !!initialParams?.hasReturns,
            onClick: handleToggleHasReturns,
          },
        ]}
        // 清空筛选
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        variant="elevated"
      />

      {/* 数据表格 */}
      <div
        className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>客户名称</TableHead>
              <TableHead>客户地址</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">订单金额</TableHead>
              <TableHead>收款状态</TableHead>
              <TableHead>发货时间</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-16">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading ? (
              // 首次加载状态：显示骨架屏
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="h-8 text-xs">加载中...</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                </TableRow>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map(order => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => {
                    if (onOrderSelect) {
                      onOrderSelect(order);
                      return;
                    }
                    router.push(`/sales-orders/${order.id}`);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (onOrderSelect) {
                        onOrderSelect(order);
                      } else {
                        router.push(`/sales-orders/${order.id}`);
                      }
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <TableCell className="h-8 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono font-semibold text-[hsl(var(--color-primary))] transition-colors hover:text-[hsl(var(--color-primary-hover))]">
                        {order.orderNumber}
                      </span>
                      {order.orderType === 'TRANSFER' && (
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant="outline"
                            className="border-sky-200 bg-sky-50 text-sky-700"
                          >
                            调货销售
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="border-amber-200 bg-amber-50 text-amber-700"
                          >
                            {TRANSFER_MODE_LABELS[order.transferMode] ??
                              order.transferMode}
                          </Badge>
                        </div>
                      )}
                      {order.hasReturnOrder && (
                        <Badge
                          variant="outline"
                          className="w-fit border-rose-200 bg-rose-50 text-rose-700"
                        >
                          已发生退货
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[hsl(var(--color-text-primary))]">
                        {order.customer?.name || '-'}
                      </span>
                      <span className="text-[hsl(var(--color-text-tertiary))]">
                        {order.customer?.phone || '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
                    {order.customer?.address ? (
                      <span>{order.customer?.address}</span>
                    ) : (
                      <span className="text-[hsl(var(--color-text-tertiary))]">
                        -
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.status)}
                      {order.status === 'confirmed' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={e => handleConfirmShipment(order, e)}
                          disabled={updatingOrderId === order.id}
                          className="h-6 bg-[hsl(var(--color-primary))] px-2 text-xs text-white shadow-sm hover:bg-[hsl(var(--color-primary-dark))]"
                        >
                          <Truck className="mr-1 h-3 w-3" />
                          {updatingOrderId === order.id
                            ? '处理中...'
                            : '确认发货'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="h-8 text-right text-xs font-semibold text-[hsl(var(--color-success))]">
                    {formatAmount(order.totalAmount)}
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    {getPaymentStatusBadge(order)}
                  </TableCell>
                  <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
                    {order.shippedAt ? (
                      <span className="font-medium text-[hsl(var(--color-primary))]">
                        {formatDateTime(order.shippedAt)}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--color-text-tertiary))]">
                        -
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                  <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
                    {formatDateTime(order.updatedAt)}
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/sales-orders/${order.id}`);
                          }}
                          className="text-xs"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          查看
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            if (order.status === 'draft') {
                              router.push(`/sales-orders/${order.id}/edit`);
                            } else {
                              setSelectedOrder(order);
                              setShowEditWarning(true);
                            }
                          }}
                          className="text-xs"
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          编辑
                        </DropdownMenuItem>
                        {isOrderCancelable(order.status) && (
                          <DropdownMenuItem
                            onClick={event =>
                              handleCancelOrderClick(order, event)
                            }
                            className="text-xs text-[hsl(var(--color-error))]"
                          >
                            <Ban className="mr-1 h-3 w-3" />
                            取消
                          </DropdownMenuItem>
                        )}
                        {order.status === 'cancelled' && (
                          <DropdownMenuItem
                            onClick={event =>
                              handleDeleteOrderClick(order, event)
                            }
                            className="text-xs text-[hsl(var(--color-error))]"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            删除
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="p-8">
                  <EmptyState title="暂无销售订单数据" compact />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* 分页组件 */}
        {data?.pagination && (
          <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
            <Pagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              showRange
              showTotal
            />
          </div>
        )}
      </div>

      {/* 取消订单确认模态框 */}
      <AlertDialog
        open={cancelConfirmOpen}
        onOpenChange={handleCancelDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-error-light))]">
                <Ban className="h-5 w-5 text-[hsl(var(--color-error))]" />
              </div>
              <AlertDialogTitle>确认取消订单</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-4 text-sm leading-6 text-[hsl(var(--color-text-secondary))]">
              确定要取消订单{' '}
              <strong className="text-[hsl(var(--color-error))]">
                {orderPendingCancel?.orderNumber}
              </strong>
              吗？
              <br />
              取消后，该订单状态将变为
              <strong>已取消</strong>，无法继续发货或收款。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留订单</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancelOrder}
              disabled={
                !!orderPendingCancel &&
                updatingOrderId === orderPendingCancel.id
              }
            >
              {orderPendingCancel && updatingOrderId === orderPendingCancel.id
                ? '正在取消...'
                : '确认取消'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除订单确认模态框 */}
      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-error-light))]">
                <Trash2 className="h-5 w-5 text-[hsl(var(--color-error))]" />
              </div>
              <AlertDialogTitle>永久删除订单</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-4 text-sm leading-6 text-[hsl(var(--color-text-secondary))]">
              将永久删除订单{' '}
              <strong className="text-[hsl(var(--color-error))]">
                {orderPendingDelete?.orderNumber}
              </strong>
              ，以及相关的明细和费用记录。
              <br />
              此操作不可撤销，请确认已经完成所有必要的记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留订单</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteOrder}
              disabled={
                !!orderPendingDelete &&
                deletingOrderId === orderPendingDelete.id
              }
            >
              {orderPendingDelete && deletingOrderId === orderPendingDelete.id
                ? '正在删除...'
                : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑警告模态框 */}
      <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-warning-light))]">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--color-warning))]" />
              </div>
              <AlertDialogTitle>无法编辑订单</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-4">
              订单号 <strong>{selectedOrder?.orderNumber}</strong> 的状态为
              &ldquo;
              <strong>
                {selectedOrder?.status === 'confirmed'
                  ? '已确认'
                  : selectedOrder?.status === 'shipped'
                    ? '已发货'
                    : selectedOrder?.status === 'completed'
                      ? '已完成'
                      : selectedOrder?.status === 'cancelled'
                        ? '已取消'
                        : selectedOrder?.status}
              </strong>
              &rdquo;，只有<strong>草稿状态</strong>的订单才能编辑。
              <br />
              <br />
              如需修改订单信息，请联系管理员或创建退货单。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>知道了</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedOrder) {
                  router.push(`/sales-orders/${selectedOrder.id}`);
                }
              }}
            >
              查看详情
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
