'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Edit, Eye, MoreHorizontal, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ContentLoading } from '@/components/common/loading';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
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
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
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
import { getReturnOrders } from '@/lib/api/return-orders';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import {
  type ReturnOrder,
  type ReturnOrderQueryParams,
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
} from '@/lib/types/return-order';
import { formatCurrency } from '@/lib/utils';
import { getReturnOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { formatDateTime } from '@/lib/utils/datetime';

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
}: ERPReturnOrderListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ✅ 移除内部 queryParams 状态，完全依赖外部传入的 initialParams
  // ✅ 单一数据源原则：状态统一在父组件管理

  // 取消对话框状态
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<ReturnOrder | null>(null);

  // ✅ 默认查询参数（确保类型正确）
  const queryParams: ReturnOrderQueryParams = {
    page: initialParams?.page || 1,
    limit: initialParams?.limit || paginationConfig.defaultPageSize,
    search: initialParams?.search,
    status: initialParams?.status,
    sortBy: initialParams?.sortBy || 'createdAt',
    sortOrder: initialParams?.sortOrder || 'desc',
    startDate: initialParams?.startDate,
    endDate: initialParams?.endDate,
  };

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

  // 取消退货订单mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/return-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'cancelled',
          idempotencyKey: crypto.randomUUID(),
          remarks: '从列表取消退货订单',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '取消退货订单失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '取消成功',
        description: '退货订单已取消',
      });
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: queryKeys.returnOrders.all });
      setCancelDialogOpen(false);
      setOrderToCancel(null);
    },
    onError: (error: Error) => {
      toast({
        title: '取消失败',
        description: error.message,
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

  // 处理搜索
  const handleSearch = React.useCallback(
    (search: string) => {
      if (onSearch) {
        onSearch(search);
      } else {
        setQueryParams(prev => ({
          ...prev,
          search: search || undefined,
          page: 1,
        }));
      }
    },
    [onSearch]
  );

  // 统一处理筛选器变更
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (onFilter) {
        onFilter(key, value);
      }
    },
    [onFilter]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      if (onDateRangeChange) {
        onDateRangeChange(range);
      }
    },
    [onDateRangeChange]
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

  // 获取状态颜色（使用统一的 badge-helpers）
  const getStatusColor = (status: string) =>
    getReturnOrderStatusBadgeVariant(status);

  // ✅ 改进的错误处理：显示错误信息并提供重试功能
  if (error) {
    return (
      <Card className="shadow-lg shadow-gray-200/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="text-center">
              <p className="text-lg font-semibold text-[hsl(var(--color-error))]">
                加载退货订单失败
              </p>
              <p className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                {error instanceof Error ? error.message : '未知错误'}
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
      <Card className="shadow-md shadow-gray-200/50">
        <CardContent className="space-y-4 pt-6">
          {/* ✅ 加载指示器：提升用户体验 */}
          {isFetching && (
            <div className="mb-2 flex items-center gap-2 text-xs text-[hsl(var(--color-primary))]">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-[hsl(var(--color-primary))] border-t-transparent"></div>
              <span>搜索中...</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[280px] flex-1">
              <UnifiedSearchBar
                searchValue={queryParams.search || ''}
                onSearchChange={handleSearch}
                searchPlaceholder="搜索退货单号或客户名称..."
                debounceDelay={400}
                compact
                filters={[
                  {
                    key: 'status',
                    label: '状态',
                    options: [
                      { label: '草稿', value: 'draft' },
                      { label: '已提交', value: 'submitted' },
                      { label: '已审核', value: 'approved' },
                      { label: '已拒绝', value: 'rejected' },
                      { label: '处理中', value: 'processing' },
                      { label: '已完成', value: 'completed' },
                      { label: '已取消', value: 'cancelled' },
                    ],
                    width: 'w-24',
                  },
                ]}
                filterValues={{
                  status: queryParams.status || 'all',
                }}
                onFilterChange={handleFilterChange}
              />
            </div>
            <DateRangePicker
              value={{
                startDate: queryParams.startDate,
                endDate: queryParams.endDate,
              }}
              onChange={handleDateRangeChange}
              label=""
              placeholder="选择退货日期范围"
              showPresets
              className="min-w-[220px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <div
        className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
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
                    title="暂无退货订单数据"
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
                  className="cursor-pointer transition-colors hover:bg-blue-50/50"
                  onClick={() => handleViewDetail(returnOrder)}
                >
                  <TableCell className="font-mono font-medium text-blue-600">
                    {returnOrder.returnNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono">
                    {returnOrder.salesOrder?.orderNumber || '-'}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
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
                      const hasRemaining =
                        typeof returnOrder.remainingAmount === 'number' &&
                        returnOrder.remainingAmount > 0.005;

                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{formatCurrency(actualAmount)}</span>
                          {hasAdjustment && (
                            <span className="text-muted-foreground text-xs">
                              原退货金额{' '}
                              {formatCurrency(returnOrder.totalAmount)}
                            </span>
                          )}
                          {hasRemaining && (
                            <span className="text-xs text-[hsl(var(--color-warning))]">
                              待处理{' '}
                              {formatCurrency(returnOrder.remainingAmount!)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(returnOrder.status)}>
                      {RETURN_ORDER_STATUS_LABELS[returnOrder.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(returnOrder.createdAt)}
                  </TableCell>
                  <TableCell className="text-center">
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
                        {[
                          'draft',
                          'submitted',
                          'approved',
                          'processing',
                        ].includes(returnOrder.status) && (
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
                onPageChange={onPageChange || (() => {})}
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
            <AlertDialogTitle>确认取消退货订单</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要取消退货订单{' '}
              <strong>{orderToCancel?.returnNumber}</strong> 吗？
              <br />
              <br />
              取消后：
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>该退货订单将被标记为已取消状态</li>
                <li>已取消的订单不会影响往来账单余额</li>
                <li>订单记录仍会保留在系统中用于审计追踪</li>
                <li>此操作不可撤销</li>
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
              {cancelMutation.isPending ? '取消中...' : '确认取消'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
