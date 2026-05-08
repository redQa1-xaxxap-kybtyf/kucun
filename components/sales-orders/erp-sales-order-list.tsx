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
  Loader2,
  MoreHorizontal,
  Trash2,
  Truck,
  Undo2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { SalesOrderSearchToolbar } from '@/components/sales-orders/sales-order-search-toolbar';
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
  SAMPLE_SETTLEMENT_TYPE_LABELS,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_VARIANTS,
  TRANSFER_MODE_LABELS,
  type SalesOrder,
  type SalesOrderQueryParams,
  type SalesOrderStatus,
} from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';
import {
  getCurrentPathWithSearch,
  withReturnTo,
} from '@/lib/utils/sales-order-navigation';
import { shouldCreateReceivableForOrder } from '@/lib/utils/sample-order';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

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
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = React.useState(false);
  const [orderPendingWithdraw, setOrderPendingWithdraw] =
    React.useState<SalesOrder | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [orderPendingDelete, setOrderPendingDelete] =
    React.useState<SalesOrder | null>(null);
  const [deletingOrderId, setDeletingOrderId] = React.useState<string | null>(
    null
  );
  const { exportToImage, isExportingImage } = useSalesOrderExport();

  const isHistoryView = initialParams?.recordScope === 'history';
  const normalizedStatus = initialParams?.status;

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
    externalOnFilter?.('isSampleOrder', undefined);
    externalOnFilter?.('hasReturns', undefined);
    externalOnFilter?.('includeTest', undefined);
    externalOnFilter?.('includeVoided', undefined);
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
      userId: initialParams?.userId,
      sortBy: initialParams?.sortBy || 'orderDate',
      sortOrder: initialParams?.sortOrder || 'desc',
      startDate: initialParams?.startDate,
      endDate: initialParams?.endDate,
      orderType: initialParams?.orderType,
      isSampleOrder: initialParams?.isSampleOrder,
      hasReturns: initialParams?.hasReturns,
      recordScope: initialParams?.recordScope,
      includeTest: initialParams?.includeTest,
      includeVoided: initialParams?.includeVoided,
    }),
    [
      initialParams?.page,
      initialParams?.limit,
      initialParams?.search,
      normalizedStatus,
      initialParams?.customerId,
      initialParams?.userId,
      initialParams?.sortBy,
      initialParams?.sortOrder,
      initialParams?.startDate,
      initialParams?.endDate,
      initialParams?.orderType,
      initialParams?.isSampleOrder,
      initialParams?.hasReturns,
      initialParams?.recordScope,
      initialParams?.includeTest,
      initialParams?.includeVoided,
    ]
  );

  // ✅ 获取销售订单列表数据 - 从 HydrationBoundary 自动获取服务端预取的数据
  const { data, isLoading, isFetching, error } = useQuery({
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
  const isListRefreshing = !isInitialLoading && (isFetching || isSearching);

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
    onSuccess: result => {
      toast({
        title: '操作成功',
        description: result.message || '订单状态已更新',
        variant: 'success',
      });
      setUpdatingOrderId(null);
      setWithdrawConfirmOpen(false);
      setOrderPendingWithdraw(null);

      // ✅ 缓存自动刷新，无需手动调用 refetchQueries
      // useUpdateSalesOrderStatus Hook 已经处理了所有缓存刷新逻辑：
      // - 立即刷新: 销售订单详情、列表、统计
      // - 延迟刷新: 库存、客户、产品、仪表盘、财务（包括应收款）
    },
    onError: (error: Error) => {
      toast({
        title: '操作失败',
        description: getFriendlyErrorMessage(
          error,
          '操作暂时未完成，请稍后重试'
        ),
        variant: 'destructive',
      });
      setUpdatingOrderId(null);
    },
  });

  // 确认发货处理函数
  const handleOpenOrder = React.useCallback(
    (order: SalesOrder) => {
      if (onOrderSelect) {
        onOrderSelect(order);
        return;
      }

      router.push(
        withReturnTo(
          `/sales-orders/${order.id}`,
          getCurrentPathWithSearch() ?? '/sales-orders'
        )
      );
    },
    [onOrderSelect, router]
  );

  const handleEditOrder = React.useCallback(
    (order: SalesOrder) => {
      if (order.status === 'draft') {
        router.push(
          withReturnTo(
            `/sales-orders/${order.id}/edit`,
            getCurrentPathWithSearch() ?? '/sales-orders'
          )
        );
        return;
      }

      setSelectedOrder(order);
      setShowEditWarning(true);
    },
    [router]
  );

  const handleExportOrderImage = React.useCallback(
    async (order: SalesOrder) => {
      try {
        await exportToImage({
          orderId: order.id,
          orderNumber: order.orderNumber || '',
          backgroundColor: '#ffffff',
          scale: 2,
        });
      } catch (err) {
        toast({
          title: '导出失败',
          description: getFriendlyErrorMessage(
            err,
            '图片暂时无法导出，请稍后重试'
          ),
          variant: 'destructive',
        });
      }
    },
    [exportToImage, toast]
  );

  const handleConfirmShipment = React.useCallback(
    (order: SalesOrder) => {
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

  const getCancelOrderBlockReason = React.useCallback(
    (order: SalesOrder) => {
      if (!isOrderCancelable(order.status)) {
        return '只有未发货的订单才能取消';
      }
      if ((order.paidAmount ?? 0) > 0) {
        return '订单已存在收款或预收款抵扣，不能直接取消';
      }
      if (Number(order.prepaymentAmount ?? 0) > 0) {
        return '订单已使用预收款抵扣，不能直接取消';
      }
      return undefined;
    },
    [isOrderCancelable]
  );

  const getWithdrawConfirmationBlockReason = React.useCallback(
    (order: SalesOrder) => {
      if (order.status !== 'confirmed') {
        return '只有已确认且未发货的订单才能撤回确认';
      }
      if (order.orderType === 'TRANSFER') {
        return '调货销售暂不支持撤回确认，请直接取消后重开';
      }
      if (order.hasReturnOrder) {
        return '订单已发生退货，不能撤回确认';
      }
      if ((order.paidAmount ?? 0) > 0) {
        return '订单已存在收款记录，不能撤回确认';
      }
      if (Number(order.prepaymentAmount ?? 0) > 0) {
        return '订单已使用预收款抵扣，不能撤回确认，请直接取消后重开';
      }
      return undefined;
    },
    []
  );

  const handleWithdrawOrderClick = React.useCallback(
    (order: SalesOrder) => {
      const blockReason = getWithdrawConfirmationBlockReason(order);
      if (blockReason) {
        toast({
          title: '暂不能撤回确认',
          description: blockReason,
          variant: 'destructive',
        });
        return;
      }

      setOrderPendingWithdraw(order);
      setWithdrawConfirmOpen(true);
    },
    [getWithdrawConfirmationBlockReason, toast]
  );

  const handleConfirmWithdrawOrder = React.useCallback(() => {
    if (!orderPendingWithdraw) {
      return;
    }

    const orderId = orderPendingWithdraw.id;
    setUpdatingOrderId(orderId);
    updateStatusMutation.mutate({
      id: orderId,
      status: 'draft',
      idempotencyKey: crypto.randomUUID(),
    });
  }, [orderPendingWithdraw, updateStatusMutation]);

  const handleWithdrawDialogOpenChange = React.useCallback((open: boolean) => {
    setWithdrawConfirmOpen(open);
    if (!open) {
      setOrderPendingWithdraw(null);
    }
  }, []);

  const handleCancelOrderClick = React.useCallback(
    (order: SalesOrder) => {
      const blockReason = getCancelOrderBlockReason(order);
      if (blockReason) {
        toast({
          title: '操作受限',
          description: blockReason,
          variant: 'destructive',
        });
        return;
      }
      setOrderPendingCancel(order);
      setCancelConfirmOpen(true);
    },
    [getCancelOrderBlockReason, toast]
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
        description: getFriendlyErrorMessage(
          error,
          '这张销售单暂时无法删除，请稍后重试'
        ),
        variant: 'destructive',
      });
      setDeletingOrderId(null);
    },
    onSettled: () => {
      setDeleteConfirmOpen(false);
    },
  });

  const handleDeleteOrderClick = React.useCallback(
    (order: SalesOrder) => {
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

  const renderOrderActionMenuItems = React.useCallback(
    (order: SalesOrder) => (
      <>
        <DropdownMenuItem
          onClick={event => {
            event.stopPropagation();
            handleOpenOrder(order);
          }}
          className="text-xs"
        >
          <Eye className="mr-1 h-3 w-3" />
          查看
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={event => {
            event.stopPropagation();
            handleEditOrder(order);
          }}
          className="text-xs"
        >
          <Edit className="mr-1 h-3 w-3" />
          编辑
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async event => {
            event.stopPropagation();
            await handleExportOrderImage(order);
          }}
          disabled={isExportingImage}
          className="text-xs"
        >
          <Download className="mr-1 h-3 w-3" />
          {isExportingImage ? '生成图片中...' : '导出图片'}
        </DropdownMenuItem>
        {isOrderCancelable(order.status) && (
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              handleCancelOrderClick(order);
            }}
            className="text-xs text-[hsl(var(--color-error))]"
          >
            <Ban className="mr-1 h-3 w-3" />
            取消
          </DropdownMenuItem>
        )}
        {order.status === 'confirmed' && (
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              handleWithdrawOrderClick(order);
            }}
            className="text-xs"
          >
            <Undo2 className="mr-1 h-3 w-3" />
            撤回确认
          </DropdownMenuItem>
        )}
        {order.status === 'cancelled' && (
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              handleDeleteOrderClick(order);
            }}
            className="text-xs text-[hsl(var(--color-error))]"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            删除
          </DropdownMenuItem>
        )}
      </>
    ),
    [
      handleCancelOrderClick,
      handleDeleteOrderClick,
      handleEditOrder,
      handleExportOrderImage,
      handleOpenOrder,
      handleWithdrawOrderClick,
      isExportingImage,
      isOrderCancelable,
    ]
  );

  // ✅ 日期筛选逻辑已移至统一的 DateRangePicker 组件
  // 移除了 getActiveDateRange 和 handleDateRangeFilter 函数
  // 现在使用 DateRangePicker 的内置快捷预设功能

  // 状态标签渲染 - 自定义颜色，更符合ERP风格
  const getStatusBadge = (status: string) => {
    const variant =
      SALES_ORDER_STATUS_VARIANTS[status as SalesOrderStatus] ?? 'outline';
    return (
      <Badge variant={variant} className="text-xs font-medium">
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

  // 列表展示用：客户名 + 电话尾 4 位（中国销售扫读习惯）
  const formatCustomerWithPhoneTail = (
    name?: string | null,
    phone?: string | null
  ) => {
    const trimmedName = name?.trim() || '-';
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length >= 4) {
      return `${trimmedName} (${digits.slice(-4)})`;
    }
    return trimmedName;
  };

  // 列表展示用：≥1 万折算为"X.XX万"，≥1 亿为"X.XX亿"，便于扫读
  const formatAmountCompact = (amount?: number | unknown) => {
    if (amount === null || amount === undefined) {
      return '￥0.00';
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
      return '￥0.00';
    }
    const abs = Math.abs(numAmount);
    const sign = numAmount < 0 ? '-' : '';
    if (abs >= 100_000_000) {
      return `￥${sign}${(abs / 100_000_000).toFixed(2)}亿`;
    }
    if (abs >= 10_000) {
      return `￥${sign}${(abs / 10_000).toFixed(2)}万`;
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

    if (!shouldCreateReceivableForOrder(order)) {
      return (
        <Badge
          variant="outline"
          className="border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))] text-xs font-medium text-[hsl(var(--color-primary))]"
        >
          无需收款
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
          页面暂时无法打开：{getFriendlyErrorMessage(error, '请稍后重试')}
        </div>
      </div>
    );
  }

  const emptyStateTitle = isHistoryView
    ? '暂无历史销售记录'
    : '暂无销售订单数据';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 搜索筛选卡片 */}
      <SalesOrderSearchToolbar
        queryParams={queryParams}
        searchValue={searchValue}
        onSearch={handleSearch}
        onFilter={handleFilterChange}
        onClearFilters={handleClearFilters}
        isSearching={isSearching || isFetching}
      />

      {/* 数据表格 */}
      <div
        className="relative overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm"
        aria-busy={isInitialLoading || isListRefreshing}
      >
        {isListRefreshing && (
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center border-b border-[hsl(var(--color-border-primary))] bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
            正在更新
          </div>
        )}

        {/* 桌面端：表格视图，支持横向滚动 */}
        <div
          className={cn(
            'hidden transition-opacity lg:block',
            isListRefreshing && 'opacity-60'
          )}
        >
          <div className="overflow-x-auto">
            <Table className="lg:min-w-[920px] xl:min-w-[1060px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px] min-w-[180px] whitespace-nowrap">
                    订单号
                  </TableHead>
                  <TableHead className="w-[220px] min-w-[220px] whitespace-nowrap xl:w-[260px] xl:min-w-[260px]">
                    客户
                  </TableHead>
                  <TableHead className="w-[150px] min-w-[150px] whitespace-nowrap xl:w-[170px] xl:min-w-[170px]">
                    订单状态
                  </TableHead>
                  <TableHead className="w-[120px] min-w-[120px] text-right whitespace-nowrap">
                    订单金额
                  </TableHead>
                  <TableHead className="w-[120px] min-w-[120px] whitespace-nowrap">
                    收款状态
                  </TableHead>
                  <TableHead className="hidden w-[180px] min-w-[180px] whitespace-nowrap xl:table-cell">
                    日期
                  </TableHead>
                  <TableHead className="w-[140px] min-w-[140px] whitespace-nowrap">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInitialLoading ? (
                  // 首次加载状态：显示骨架屏
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-8 text-xs">加载中</TableCell>
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
                      onClick={() => handleOpenOrder(order)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleOpenOrder(order);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <TableCell className="h-8 min-w-[180px] text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-semibold text-[hsl(var(--color-primary))] transition-colors hover:text-[hsl(var(--color-primary-hover))]">
                            <CopyableText text={order.orderNumber} />
                          </span>
                          {order.isSampleOrder && (
                            <Badge
                              variant="outline"
                              className="w-fit border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-700"
                            >
                              {
                                SAMPLE_SETTLEMENT_TYPE_LABELS[
                                  order.sampleSettlementType ?? 'FREE'
                                ]
                              }
                            </Badge>
                          )}
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
                          {/* 1024-1280 区间隐藏独立日期列时，补一行紧凑日期 */}
                          <span className="text-[10px] text-[hsl(var(--color-text-tertiary))] xl:hidden">
                            {formatDate(order.orderDate || order.createdAt)}
                            {order.shippedAt
                              ? ` · 发 ${formatDate(order.shippedAt)}`
                              : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="h-8 min-w-[260px] text-xs">
                        <div className="flex flex-col gap-1">
                          <span
                            className="font-medium text-[hsl(var(--color-text-primary))]"
                            title={order.customer?.phone || undefined}
                          >
                            {formatCustomerWithPhoneTail(
                              order.customer?.name,
                              order.customer?.phone
                            )}
                          </span>
                          {order.customer?.address && (
                            <span
                              className="max-w-[240px] truncate text-[hsl(var(--color-text-tertiary))]"
                              title={order.customer.address}
                            >
                              {order.customer.address}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="h-8 min-w-[170px] text-xs">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(order.status)}
                          {order.status === 'confirmed' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={e => {
                                e.stopPropagation();
                                handleConfirmShipment(order);
                              }}
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
                      <TableCell
                        className="h-8 text-right text-xs font-semibold whitespace-nowrap text-[hsl(var(--color-success))]"
                        title={formatAmount(order.totalAmount)}
                      >
                        {formatAmountCompact(order.totalAmount)}
                      </TableCell>
                      <TableCell className="h-8 text-xs whitespace-nowrap">
                        {getPaymentStatusBadge(order)}
                      </TableCell>
                      <TableCell className="hidden h-8 text-xs whitespace-nowrap text-[hsl(var(--color-text-secondary))] xl:table-cell">
                        <div className="flex flex-col gap-1">
                          <span>
                            销售：
                            {formatDate(order.orderDate || order.createdAt)}
                          </span>
                          {order.shippedAt ? (
                            <span className="text-[hsl(var(--color-primary))]">
                              发货：{formatDate(order.shippedAt)}
                            </span>
                          ) : (
                            <span className="text-[hsl(var(--color-text-tertiary))]">
                              未发货
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="h-8 text-xs">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs font-semibold text-[hsl(var(--color-primary))]"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenOrder(order);
                            }}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            查看
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={e => e.stopPropagation()}
                                aria-label="更多操作"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {renderOrderActionMenuItems(order)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="p-8">
                      <EmptyState title={emptyStateTitle} compact />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 移动端：卡片视图 */}
        <div
          className={cn(
            'space-y-3 px-3 py-3 transition-opacity lg:hidden',
            isListRefreshing && 'opacity-60'
          )}
        >
          {isInitialLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`sales-order-card-skeleton-${index}`}
                className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm"
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
            data.data.map(order => (
              <div
                key={order.id}
                className="cursor-pointer rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm"
                onClick={() => handleOpenOrder(order)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenOrder(order);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-[hsl(var(--color-primary))]">
                      {order.orderNumber}
                    </div>
                    <div
                      className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]"
                      title={order.customer?.phone || undefined}
                    >
                      {formatCustomerWithPhoneTail(
                        order.customer?.name,
                        order.customer?.phone
                      )}
                    </div>
                    {order.customer?.address && (
                      <div className="mt-0.5 truncate text-xs text-[hsl(var(--color-text-tertiary))]">
                        {order.customer.address}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {order.isSampleOrder && (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-xs font-medium text-amber-700"
                        >
                          {
                            SAMPLE_SETTLEMENT_TYPE_LABELS[
                              order.sampleSettlementType ?? 'FREE'
                            ]
                          }
                        </Badge>
                      )}
                      {order.orderType === 'TRANSFER' && (
                        <Badge variant="info" className="text-xs font-medium">
                          调货销售
                        </Badge>
                      )}
                      {order.hasReturnOrder && (
                        <Badge
                          variant="destructive"
                          className="text-xs font-medium"
                        >
                          已发生退货
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[hsl(var(--color-bg-secondary))] px-3 py-2 text-xs text-[hsl(var(--color-text-secondary))] sm:shrink-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                    <div
                      className="font-semibold text-[hsl(var(--color-success))]"
                      title={formatAmount(order.totalAmount)}
                    >
                      金额：{formatAmountCompact(order.totalAmount)}
                    </div>
                    <div className="mt-1 flex sm:justify-end">
                      {getPaymentStatusBadge(order)}
                    </div>
                    <div className="mt-1 break-all text-[hsl(var(--color-text-tertiary))] sm:break-normal">
                      销售日期：
                      {formatDate(order.orderDate || order.createdAt)}
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
                        className="h-9 px-3 text-xs font-bold"
                        onClick={e => {
                          e.stopPropagation();
                          handleConfirmShipment(order);
                        }}
                        disabled={updatingOrderId === order.id}
                      >
                        <Truck className="mr-1 h-3.5 w-3.5" />
                        {updatingOrderId === order.id
                          ? '处理中...'
                          : '确认发货'}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 px-0 text-slate-500"
                          onClick={event => event.stopPropagation()}
                          aria-label="更多操作"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {renderOrderActionMenuItems(order)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title={emptyStateTitle} compact />
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
              disabled={isListRefreshing}
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

      <AlertDialog
        open={withdrawConfirmOpen}
        onOpenChange={handleWithdrawDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <Undo2 className="h-5 w-5 text-amber-600" />
              </div>
              <AlertDialogTitle>确认撤回为草稿</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-4 text-sm leading-6 text-[hsl(var(--color-text-secondary))]">
              确定要将订单 <strong>{orderPendingWithdraw?.orderNumber}</strong>{' '}
              撤回为草稿吗？
              <br />
              撤回后可重新修改订单，预留库存会恢复，相关待收记录也会一并关闭。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>暂不撤回</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmWithdrawOrder}
              disabled={
                !!orderPendingWithdraw &&
                updatingOrderId === orderPendingWithdraw.id
              }
            >
              {orderPendingWithdraw &&
              updatingOrderId === orderPendingWithdraw.id
                ? '正在撤回...'
                : '确认撤回'}
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
                  router.push(
                    withReturnTo(
                      `/sales-orders/${selectedOrder.id}`,
                      getCurrentPathWithSearch() ?? '/sales-orders'
                    )
                  );
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
