'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Edit,
  Eye,
  MoreHorizontal,
  TrendingDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { ContentLoading } from '@/components/common/loading';
import { RelativeTime } from '@/components/common/relative-time';
import { ReturnOrderSearchToolbar } from '@/components/return-orders/return-order-search-toolbar';
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
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
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
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  getReturnOrders,
  useUpdateReturnOrderStatus,
} from '@/lib/api/return-orders';
import { paginationConfig } from '@/lib/config/pagination';
import { queryKeys } from '@/lib/queryKeys';
import {
  type ReturnOrder,
  type ReturnOrderQueryParams,
  type ReturnOrderStatus,
  type ReturnOrderType,
  type ReturnProcessType,
  type ReturnOrderUiStatus,
  getReturnOrderDisplayStatus,
  getReturnOrderPendingRefundAmount,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
} from '@/lib/types/return-order';
import { formatCurrency } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

interface ERPReturnOrderListProps {
  initialParams?: ReturnOrderQueryParams;
  onCreateNew?: () => void;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onViewDetail?: (returnOrder: ReturnOrder) => void;
  onEdit?: (returnOrder: ReturnOrder) => void;
  onDelete?: (returnOrder: ReturnOrder) => void;
  onClearFilters?: () => void;
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

/**
 * ERP风格的退货订单管理列表组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPReturnOrderList({
  initialParams,
  onCreateNew,
  onSearch,
  onFilter,
  onPageChange,
  onDateRangeChange,
  onViewDetail,
  onEdit,
  onDelete,
  onClearFilters,
}: ERPReturnOrderListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ✅ 移除内部 queryParams 状态，完全依赖外部传入的 initialParams
  // ✅ 单一数据源原则：状态统一在父组件管理

  // 取消对话框状态
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [orderToCancel, setOrderToCancel] = React.useState<ReturnOrder | null>(
    null
  );
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const updateStatusMutation = useUpdateReturnOrderStatus({
    onSuccess: () => {
      toast({
        title: '退货已完成',
        description:
          '这张退货单已经处理完成，库存已回补。如需退款，请继续登记退款。',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.returnOrders.all });
      setConfirmingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: '处理失败',
        description: getFriendlyErrorMessage(
          error,
          '退货状态暂时无法更新，请稍后重试'
        ),
        variant: 'destructive',
      });
      setConfirmingId(null);
    },
  });

  // ✅ 默认查询参数（确保类型正确）
  const queryParams: ReturnOrderQueryParams = {
    page: initialParams?.page || 1,
    limit: initialParams?.limit || paginationConfig.defaultPageSize,
    search: initialParams?.search,
    uiStatus: initialParams?.uiStatus,
    status: initialParams?.status,
    type: initialParams?.type,
    processType: initialParams?.processType,
    sortBy: initialParams?.sortBy || 'createdAt',
    sortOrder: initialParams?.sortOrder || 'desc',
    startDate: initialParams?.startDate,
    endDate: initialParams?.endDate,
    includeTest: initialParams?.includeTest,
    includeVoided: initialParams?.includeVoided,
  };

  const updateQueryStringParams = React.useCallback(
    (updates: Partial<ReturnOrderQueryParams>) => {
      if (typeof window === 'undefined') {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      const query = params.toString();
      router.replace(query ? `?${query}` : '?', { scroll: false });
    },
    [router]
  );

  const {
    searchInput,
    isSearching,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
  } = useListSearchController({
    committedValue: queryParams.search,
    onCommit: search => {
      if (onSearch) {
        onSearch(search ?? '');
        return;
      }

      updateQueryStringParams({
        search,
        page: 1,
      });
    },
  });

  // ✅ 获取退货订单列表数据 - 从 HydrationBoundary 自动获取服务端预取的数据
  const {
    data: queryData,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.returnOrders.list(queryParams),
    queryFn: () => getReturnOrders(queryParams),
    // ✅ 移除 initialData - 数据已在 QueryClient 中（通过 HydrationBoundary）
    staleTime: 30 * 1000, // ✅ 30秒内数据视为新鲜，避免频繁请求导致数据闪烁
    refetchOnWindowFocus: false, // 避免窗口聚焦时不必要的刷新
    placeholderData: previousData => previousData, // ✅ 保持上一次数据，避免数据清空
    refetchOnMount: false, // 避免挂载时重新获取
    gcTime: 10 * 60 * 1000, // ✅ 缓存时间10分钟，提升后退/前进体验
  });

  // ✅ 直接使用 queryData，不再使用 mock 数据回退
  const displayData = queryData;

  const statusFilter: ReturnOrderUiStatus | 'all' =
    queryParams.uiStatus ?? 'all';
  const typeFilter: ReturnOrderType | 'all' = queryParams.type ?? 'all';
  const processTypeFilter: ReturnProcessType | 'all' =
    queryParams.processType ?? 'all';
  const includeTest = queryParams.includeTest;
  const includeVoided = queryParams.includeVoided;
  const dateRange: DateRangeValue = {
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
  };
  const isBackgroundFetching = isFetching && !isLoading;

  const getPrimaryActionConfig = React.useCallback(
    (status: ReturnOrderStatus) => {
      if (
        status === 'submitted' ||
        status === 'approved' ||
        status === 'processing'
      ) {
        return {
          nextStatus: 'completed' as const,
          label: '完成退货',
          loadingLabel: '完成中...',
        };
      }

      return null;
    },
    []
  );

  // 取消退货订单mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(
        `/api/return-orders/${orderId}/status`,
        getCsrfTokenHeader({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            status: 'cancelled',
            idempotencyKey: crypto.randomUUID(),
            remarks: '从列表取消退货订单',
          }),
        })
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '取消退货订单失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '退货单已取消',
        description: '这张退货单已取消，后续不会再继续处理。',
        variant: 'success',
      });
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: queryKeys.returnOrders.all });
      setCancelDialogOpen(false);
      setOrderToCancel(null);
    },
    onError: (error: Error) => {
      toast({
        title: '暂时无法取消',
        description: getFriendlyErrorMessage(
          error,
          '这张退货单暂时无法取消，请稍后重试'
        ),
        variant: 'destructive',
      });
    },
  });

  // 处理取消操作
  const handleCancel = React.useCallback((returnOrder: ReturnOrder) => {
    setOrderToCancel(returnOrder);
    setCancelDialogOpen(true);
  }, []);

  // 确认取消
  const confirmCancel = React.useCallback(() => {
    if (orderToCancel) {
      cancelMutation.mutate(orderToCancel.id);
    }
  }, [orderToCancel, cancelMutation]);

  const getPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    return normalizeSearch(searchInput);
  }, [cancelPendingCommit, searchInput]);

  const syncExternalSearch = React.useCallback(
    (search?: string) => {
      if (!onSearch || search === normalizeSearch(queryParams.search)) {
        return;
      }

      onSearch(search ?? '');
    },
    [onSearch, queryParams.search]
  );

  // 处理搜索
  const handleSearch = React.useCallback(
    (value: string) => {
      handleSearchChange(value);
    },
    [handleSearchChange]
  );

  const handleStatusChange = React.useCallback(
    (status: ReturnOrderUiStatus | 'all') => {
      const nextSearch = getPendingSearch();
      if (onFilter) {
        syncExternalSearch(nextSearch);
        onFilter('uiStatus', status === 'all' ? undefined : status);
      } else {
        updateQueryStringParams({
          search: nextSearch,
          uiStatus: status === 'all' ? undefined : status,
          page: 1,
        });
      }
    },
    [getPendingSearch, onFilter, syncExternalSearch, updateQueryStringParams]
  );

  const handleTypeChange = React.useCallback(
    (typeValue: ReturnOrderType | 'all') => {
      const nextSearch = getPendingSearch();
      if (onFilter) {
        syncExternalSearch(nextSearch);
        onFilter('type', typeValue === 'all' ? undefined : typeValue);
      } else {
        updateQueryStringParams({
          search: nextSearch,
          type: typeValue === 'all' ? undefined : typeValue,
          page: 1,
        });
      }
    },
    [getPendingSearch, onFilter, syncExternalSearch, updateQueryStringParams]
  );

  const handleProcessTypeChange = React.useCallback(
    (processTypeValue: ReturnProcessType | 'all') => {
      const nextSearch = getPendingSearch();
      if (onFilter) {
        syncExternalSearch(nextSearch);
        onFilter(
          'processType',
          processTypeValue === 'all' ? undefined : processTypeValue
        );
      } else {
        updateQueryStringParams({
          search: nextSearch,
          processType:
            processTypeValue === 'all' ? undefined : processTypeValue,
          page: 1,
        });
      }
    },
    [getPendingSearch, onFilter, syncExternalSearch, updateQueryStringParams]
  );

  const handleIncludeVoidedToggle = React.useCallback(() => {
    const nextSearch = getPendingSearch();
    const nextValue = !(queryParams.includeVoided === true);
    if (onFilter) {
      syncExternalSearch(nextSearch);
      onFilter('includeVoided', nextValue ? 'true' : undefined);
    } else {
      updateQueryStringParams({
        search: nextSearch,
        includeVoided: nextValue ? true : undefined,
        page: 1,
      });
    }
  }, [
    getPendingSearch,
    onFilter,
    queryParams.includeVoided,
    syncExternalSearch,
    updateQueryStringParams,
  ]);

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      const nextSearch = getPendingSearch();
      if (onDateRangeChange) {
        syncExternalSearch(nextSearch);
        onDateRangeChange(range);
      } else {
        updateQueryStringParams({
          search: nextSearch,
          startDate: range.startDate || undefined,
          endDate: range.endDate || undefined,
          page: 1,
        });
      }
    },
    [
      getPendingSearch,
      onDateRangeChange,
      syncExternalSearch,
      updateQueryStringParams,
    ]
  );

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');

    if (onClearFilters) {
      onClearFilters();
      return;
    }

    onSearch?.('');

    if (onFilter) {
      onFilter('uiStatus', undefined);
      onFilter('type', undefined);
      onFilter('processType', undefined);
      onFilter('includeTest', undefined);
      onFilter('includeVoided', undefined);
    }

    if (onDateRangeChange) {
      onDateRangeChange({});
    }

    if (!onFilter && !onDateRangeChange) {
      updateQueryStringParams({
        search: undefined,
        uiStatus: undefined,
        status: undefined,
        type: undefined,
        processType: undefined,
        startDate: undefined,
        endDate: undefined,
        includeTest: undefined,
        includeVoided: undefined,
        page: 1,
      });
    }
  }, [
    cancelPendingCommit,
    onClearFilters,
    onDateRangeChange,
    onFilter,
    onSearch,
    setSearchInput,
    updateQueryStringParams,
  ]);

  const handlePageChange = React.useCallback(
    (page: number) => {
      const nextSearch = getPendingSearch();

      if (onPageChange) {
        syncExternalSearch(nextSearch);
        onPageChange(page);
        return;
      }

      updateQueryStringParams({
        search: nextSearch,
        page: page > 1 ? page : undefined,
      });
    },
    [
      getPendingSearch,
      onPageChange,
      syncExternalSearch,
      updateQueryStringParams,
    ]
  );

  // 处理新建
  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/return-orders/create');
    }
  };

  // 处理查看详情
  const handleViewDetail = (returnOrder: ReturnOrder) => {
    if (onViewDetail) {
      onViewDetail(returnOrder);
    } else {
      router.push(`/return-orders/${returnOrder.id}`);
    }
  };

  // 处理编辑
  const handleEdit = (returnOrder: ReturnOrder) => {
    if (onEdit) {
      onEdit(returnOrder);
    } else {
      router.push(`/return-orders/${returnOrder.id}/edit`);
    }
  };

  // 处理删除
  const handleDelete = (returnOrder: ReturnOrder) => {
    if (onDelete) {
      onDelete(returnOrder);
    }
  };

  // ✅ 改进的错误处理：显示错误信息并提供重试功能
  if (error) {
    return (
      <Card className="rounded-md border border-border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="text-center">
              <p className="text-lg font-semibold text-[hsl(var(--color-error))]">
                加载退货订单失败
              </p>
              <p className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                {getFriendlyErrorMessage(error, '请稍后重试')}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="mt-2"
            >
              <TrendingDown className="mr-2 h-4 w-4" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <ReturnOrderSearchToolbar
        searchValue={searchInput}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        processTypeFilter={processTypeFilter}
        includeTest={includeTest}
        includeVoided={includeVoided}
        dateRange={dateRange}
        isSearching={isSearching || isBackgroundFetching}
        onSearch={handleSearch}
        onStatusChange={handleStatusChange}
        onTypeChange={handleTypeChange}
        onProcessTypeChange={handleProcessTypeChange}
        onIncludeVoidedToggle={handleIncludeVoidedToggle}
        onDateRangeChange={handleDateRangeChange}
        onClearFilters={handleClearFilters}
      />

      {/* 数据表格 */}
      <div className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>退货单号</TableHead>
              <TableHead>关联销售单</TableHead>
              <TableHead>客户名称</TableHead>
              <TableHead>退货类型</TableHead>
              <TableHead>处理方式</TableHead>
              <TableHead>实际退款金额</TableHead>
              <TableHead>订单状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <ContentLoading text="加载退货订单数据..." />
                </TableCell>
              </TableRow>
            ) : displayData?.data.returnOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-8">
                  <EmptyState
                    title="暂无退货订单"
                    action={
                      <Button onClick={handleCreateNew}>新建退货单</Button>
                    }
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              displayData?.data.returnOrders.map((returnOrder: ReturnOrder) => (
                <TableRow
                  key={returnOrder.id}
                  className="cursor-pointer"
                  onClick={() => handleViewDetail(returnOrder)}
                >
                  <TableCell className="font-mono font-medium text-[hsl(var(--color-primary))]">
                    <CopyableText text={returnOrder.returnNumber} />
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono">
                    {returnOrder.salesOrder?.orderNumber ? (
                      <CopyableText text={returnOrder.salesOrder.orderNumber} />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {returnOrder.customer?.name || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {RETURN_ORDER_TYPE_LABELS[returnOrder.type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {RETURN_PROCESS_TYPE_LABELS[returnOrder.processType]}
                  </TableCell>
                  <TableCell className="font-mono">
                    {(() => {
                      const actualAmount =
                        typeof returnOrder.refundAmount === 'number'
                          ? returnOrder.refundAmount
                          : returnOrder.totalAmount;
                      const hasAdjustment =
                        Math.abs(actualAmount - returnOrder.totalAmount) >
                        0.005;
                      const pendingRefundAmount =
                        getReturnOrderPendingRefundAmount(returnOrder);

                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{formatCurrency(actualAmount)}</span>
                          {hasAdjustment && (
                            <span className="text-muted-foreground text-xs">
                              原退货金额{' '}
                              {formatCurrency(returnOrder.totalAmount)}
                            </span>
                          )}
                          {pendingRefundAmount > 0.005 && (
                            <span className="text-xs text-[hsl(var(--color-warning))]">
                              待退款 {formatCurrency(pendingRefundAmount)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getReturnOrderDisplayStatus(returnOrder).variant}
                    >
                      {getReturnOrderDisplayStatus(returnOrder).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <RelativeTime date={returnOrder.createdAt} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {(() => {
                        const actionConfig = getPrimaryActionConfig(
                          returnOrder.status
                        );

                        if (!actionConfig) {
                          return null;
                        }

                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={e => {
                              e.stopPropagation();
                              setConfirmingId(returnOrder.id);
                              updateStatusMutation.mutate({
                                id: returnOrder.id,
                                status: actionConfig.nextStatus,
                              });
                            }}
                            disabled={confirmingId === returnOrder.id}
                          >
                            {confirmingId === returnOrder.id ? (
                              <span className="flex items-center gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3 animate-spin" />
                                {actionConfig.loadingLabel}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                {actionConfig.label}
                              </span>
                            )}
                          </Button>
                        );
                      })()}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation();
                              handleViewDetail(returnOrder);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          {['draft', 'submitted'].includes(
                            returnOrder.status
                          ) && (
                            <DropdownMenuItem
                              onClick={e => {
                                e.stopPropagation();
                                handleEdit(returnOrder);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                          )}
                          {/* 确认后（approved 及以后）不允许再取消 */}
                          {['draft', 'submitted'].includes(
                            returnOrder.status
                          ) && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={e => {
                                e.stopPropagation();
                                handleCancel(returnOrder);
                              }}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              取消退货
                            </DropdownMenuItem>
                          )}
                          {onDelete && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={e => {
                                e.stopPropagation();
                                handleDelete(returnOrder);
                              }}
                            >
                              <TrendingDown className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 分页组件 */}
        {displayData?.data.pagination &&
          displayData.data.pagination.total > 0 && (
            <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
              <Pagination
                pagination={displayData.data.pagination}
                onPageChange={handlePageChange}
                showRange
                showTotal
              />
            </div>
          )}
      </div>

      {/* 取消确认对话框 */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定取消这张退货单吗？</AlertDialogTitle>
            <AlertDialogDescription>
              退货单 <strong>{orderToCancel?.returnNumber}</strong>{' '}
              取消后将不再继续处理。
              <br />
              <br />
              取消后：
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>这张退货单会变成“已取消”</li>
                <li>往来余额不会再按这张退货单继续处理</li>
                <li>单据记录会保留，方便后续查询</li>
                <li>取消后不能恢复</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              我再想想
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? '处理中...' : '确认取消退货单'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
