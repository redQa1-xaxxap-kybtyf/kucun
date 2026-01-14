'use client';

/* eslint-disable max-lines, max-lines-per-function */

import { useQuery } from '@tanstack/react-query';
import {
    AlertCircle,
    Ban,
    Clock,
    Download,
    Edit,
    Eye,
    MoreHorizontal,
    Package,
    Trash2,
    Truck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
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
import { useSalesOrderExport } from '@/hooks/use-sales-order-export';
import {
    getSalesOrders,
    salesOrderQueryKeys,
    useDeleteSalesOrder,
    useUpdateSalesOrderStatus,
} from '@/lib/api/sales-orders';
import {
    SALES_ORDER_STATUS_LABELS,
    TRANSFER_MODE_LABELS,
    type SalesOrder,
    type SalesOrderQueryParams,
    type SalesOrderStatus,
} from '@/lib/types/sales-order';
import { formatDateTime } from '@/lib/utils/datetime';

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
  const { exportToImage, isExportingImage } = useSalesOrderExport();

  const statusFilterValue = initialParams?.status ?? undefined;
  const normalizedStatus = statusFilterValue;

  // 检查是否有活跃筛选条件
  // ✅ P1修复: 将搜索词纳入活跃筛选判断
  const hasActiveFilters = React.useMemo(
    () =>
      Boolean(
        normalizedStatus ||
          initialParams?.customerId ||
          initialParams?.startDate ||
          initialParams?.endDate ||
          initialParams?.orderType ||
          initialParams?.hasReturns ||
          // ✅ P1修复: 搜索词也算活跃筛选
          initialParams?.search ||
          searchValue
      ),
    [
      normalizedStatus,
      initialParams?.customerId,
      initialParams?.startDate,
      initialParams?.endDate,
      initialParams?.orderType,
      initialParams?.hasReturns,
      initialParams?.search,
      searchValue,
    ]
  );

  // 清空所有筛选条件
  // ✅ P1修复: 清空筛选时也清空搜索词
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

    // ✅ P1修复: 清空搜索词
    // 修复前：清空筛选不会清空搜索词，导致用户困惑
    // 修复后：清空筛选时同时清空搜索词，恢复到初始状态
    if (externalOnSearch) {
      externalOnSearch('');
    }
  }, [externalOnClearFilters, externalOnFilter, externalOnSearch]);

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

  // ✅ 使用 useMemo 包裹 queryParams，确保引用稳定，避免无限请求风暴
  const queryParams: SalesOrderQueryParams = React.useMemo(
    () => ({
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
    }),
    [
      initialParams?.page,
      initialParams?.limit,
      initialParams?.search,
      normalizedStatus,
      initialParams?.customerId,
      initialParams?.sortBy,
      initialParams?.sortOrder,
      initialParams?.startDate,
      initialParams?.endDate,
      initialParams?.orderType,
      initialParams?.hasReturns,
    ]
  );

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

  // ✅ 使用新的 useUpdateSalesOrderStatus Hook，自动处理缓存刷新
  const updateStatusMutation = useUpdateSalesOrderStatus({
    onSuccess: () => {
      toast({
        title: '操作成功',
        description: '订单状态已更新',
        variant: 'success',
      });
      setUpdatingOrderId(null);

      // ✅ 缓存自动刷新，无需手动调用 refetchQueries
      // useUpdateSalesOrderStatus Hook 已经处理了所有缓存刷新逻辑：
      // - 立即刷新: 销售订单详情、列表、统计
      // - 延迟刷新: 库存、客户、产品、仪表盘、财务（包括应收款）
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
      updateStatusMutation.mutate({
        id: order.id,
        status: 'shipped',
        idempotencyKey: crypto.randomUUID(),
      });
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
    updateStatusMutation.mutate({
      id: orderId,
      status: 'cancelled',
      idempotencyKey: crypto.randomUUID(),
    });
    setCancelConfirmOpen(false);
    setOrderPendingCancel(null);
  }, [orderPendingCancel, updateStatusMutation]);

  const handleCancelDialogOpenChange = React.useCallback((open: boolean) => {
    setCancelConfirmOpen(open);
    if (!open) {
      setOrderPendingCancel(null);
    }
  }, []);

  // ✅ 使用新的 useDeleteSalesOrder Hook，自动处理缓存刷新
  const deleteOrderMutation = useDeleteSalesOrder({
    onSuccess: () => {
      toast({
        title: '删除成功',
        description: '销售订单已删除',
        variant: 'success',
      });
      setDeletingOrderId(null);
      setOrderPendingDelete(null);

      // ✅ 缓存自动刷新，无需手动调用 refetchQueries
      // useDeleteSalesOrder Hook 已经处理了所有缓存刷新逻辑：
      // - 立即刷新: 销售订单列表、统计
      // - 移除缓存: 销售订单详情
      // - 延迟刷新: 库存、客户、产品、仪表盘、财务（包括应收款、应付款）
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

  // 格式化金额 - 处理 Prisma Decimal 类型
  const formatAmount = (amount?: number | unknown) => {
    if (amount === null || amount === undefined) {
      return '￥0.00';
    }
    // 确保转换为 JavaScript number 类型（处理 Prisma Decimal）
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
      return '￥0.00';
    }
    return `￥${numAmount.toFixed(2)}`;
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
    <div className="space-y-4 sm:space-y-6">
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
        variant="pro"
        compact={true}
      />

      {/* 数据表格 */}
      <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
        {/* 桌面端：表格视图，支持横向滚动 */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
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
                  <TableHead className="w-24">操作</TableHead>
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
                      className="cursor-pointer border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
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
                            <CopyableText text={order.orderNumber} />
                          </span>
                          {order.orderType === 'TRANSFER' && (
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="info">调货销售</Badge>
                              <Badge variant="warning">
                                {TRANSFER_MODE_LABELS[order.transferMode] ??
                                  order.transferMode}
                              </Badge>
                              {!order.supplierId && (
                                <Badge variant="destructive" className="w-fit">
                                  缺少供应商
                                </Badge>
                              )}
                            </div>
                          )}
                          {order.hasReturnOrder && (
                            <Badge variant="destructive" className="w-fit">
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
                        <RelativeTime date={order.createdAt} />
                      </TableCell>
                      <TableCell className="h-8 text-xs text-[hsl(var(--color-text-secondary))]">
                        <RelativeTime date={order.updatedAt} />
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
                          <DropdownMenuContent align="end" className="w-40">
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
                            <DropdownMenuItem
                              onClick={async e => {
                                e.stopPropagation();
                                // 列表页导出图片：直接请求详情接口并渲染隐藏模板
                                try {
                                  const response = await fetch(
                                    `/api/sales-orders/${order.id}`,
                                    { credentials: 'include' }
                                  );
                                  const result = await response.json();
                                  if (!response.ok || !result.success) {
                                    throw new Error(
                                      result.error || '获取订单详情失败'
                                    );
                                  }

                                  // 动态创建隐藏容器，使用与详情页相同的打印模板
                                  const container =
                                    document.createElement('div');
                                  container.style.position = 'absolute';
                                  container.style.left = '-9999px';
                                  container.style.top = '0';
                                  container.id = `sales-order-print-list-${order.id}`;
                                  document.body.appendChild(container);

                                  // 懒加载打印模板组件
                                  const { SalesOrderPrintTemplate } =
                                    await import(
                                      '@/app/(dashboard)/sales-orders/[id]/components/SalesOrderPrintTemplate'
                                    );
                                  const { createRoot } = await import(
                                    'react-dom/client'
                                  );

                                  const root = createRoot(container);
                                  root.render(
                                    <SalesOrderPrintTemplate
                                      order={result.data}
                                    />
                                  );

                                  // 等待一帧让浏览器完成渲染
                                  await new Promise(resolve =>
                                    requestAnimationFrame(() => resolve(null))
                                  );

                                  await exportToImage(container, {
                                    orderId: order.id,
                                    orderNumber: order.orderNumber || '',
                                    backgroundColor: '#ffffff',
                                    scale: 2,
                                  });

                                  root.unmount();
                                  document.body.removeChild(container);
                                } catch (err) {
                                  toast({
                                    title: '导出失败',
                                    description:
                                      err instanceof Error
                                        ? err.message
                                        : '导出图片失败',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                              disabled={isExportingImage}
                              className="text-xs"
                            >
                              <Download className="mr-1 h-3 w-3" />
                              {isExportingImage ? '生成图片中...' : '导出图片'}
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
          </div>
        </div>

        {/* 移动端：卡片视图 */}
        <div className="space-y-3 px-3 py-3 md:hidden">
          {isInitialLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`sales-order-card-skeleton-${index}`}
                className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-3 w-28 rounded bg-[hsl(var(--color-bg-tertiary))]" />
                    <div className="h-3 w-24 rounded bg-[hsl(var(--color-bg-tertiary))]" />
                    <div className="h-3 w-40 rounded bg-[hsl(var(--color-bg-tertiary))]" />
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-3 w-20 rounded bg-[hsl(var(--color-bg-tertiary))]" />
                    <div className="h-3 w-16 rounded bg-[hsl(var(--color-bg-tertiary))]" />
                  </div>
                </div>
              </div>
            ))
          ) : data?.data && data.data.length > 0 ? (
            data.data.map(order => {
              const handleCardClick = () => {
                if (onOrderSelect) {
                  onOrderSelect(order);
                  return;
                }
                router.push(`/sales-orders/${order.id}`);
              };

              return (
                <div
                  key={order.id}
                  className="card-shadow-light cursor-pointer rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3"
                  onClick={handleCardClick}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleCardClick();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs font-semibold text-[hsl(var(--color-primary))]">
                        {order.orderNumber}
                      </div>
                      <div className="mt-0.5 text-xs text-[hsl(var(--color-text-secondary))]">
                        客户：{order.customer?.name || '-'}
                      </div>
                      <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                        电话：{order.customer?.phone || '-'}
                      </div>
                      <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                        地址：{order.customer?.address || '暂无客户地址'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {order.orderType === 'TRANSFER' && (
                          <Badge variant="info" className="text-xs font-bold">
                            调货销售
                          </Badge>
                        )}
                        {order.hasReturnOrder && (
                          <Badge variant="destructive" className="text-xs font-bold">
                            已发生退货
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                      <div className="font-semibold text-[hsl(var(--color-success))]">
                        金额：{formatAmount(order.totalAmount)}
                      </div>
                      <div className="mt-1 flex justify-end">
                        {getPaymentStatusBadge(order)}
                      </div>
                      <div className="mt-1 text-[hsl(var(--color-text-tertiary))]">
                        创建时间：{formatDateTime(order.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="text-[hsl(var(--color-text-tertiary))]">
                        状态：
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      {order.status === 'confirmed' && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-2 text-xs font-bold"
                          onClick={e => {
                            e.stopPropagation();
                            handleConfirmShipment(order, e);
                          }}
                          disabled={updatingOrderId === order.id}
                        >
                          <Truck className="mr-1 h-3 w-3" />
                          {updatingOrderId === order.id
                            ? '处理中...'
                            : '确认发货'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1 text-xs font-bold text-slate-500"
                        onClick={e => {
                          e.stopPropagation();
                          router.push(`/sales-orders/${order.id}`);
                        }}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        查看
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState title="暂无销售订单数据" compact />
          )}
        </div>

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
