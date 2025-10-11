'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit, Eye, MoreHorizontal, Trash2, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useToast } from '@/components/ui/use-toast';

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
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import {
  SALES_ORDER_STATUS_LABELS,
  type SalesOrder,
  type SalesOrderQueryParams,
  type SalesOrderStatus,
} from '@/lib/types/sales-order';

interface ERPSalesOrderListProps {
  onOrderSelect?: (order: SalesOrder) => void;
  initialParams?: SalesOrderQueryParams;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
  searchValue?: string;
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
}: ERPSalesOrderListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showEditWarning, setShowEditWarning] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<SalesOrder | null>(
    null
  );
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);

  // ✅ 移除内部 queryParams 状态，完全依赖外部传入的 initialParams
  // ✅ 单一数据源原则：状态统一在父组件管理

  // ✅ 默认查询参数（确保类型正确）
  const queryParams: SalesOrderQueryParams = {
    page: initialParams?.page || 1,
    limit: initialParams?.limit || 20,
    search: initialParams?.search,
    status: initialParams?.status,
    customerId: initialParams?.customerId,
    sortBy: initialParams?.sortBy || 'createdAt',
    sortOrder: initialParams?.sortOrder || 'desc',
    startDate: initialParams?.startDate,
    endDate: initialParams?.endDate,
  };

  // ✅ 获取销售订单列表数据 - 从 HydrationBoundary 自动获取服务端预取的数据
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: salesOrderQueryKeys.list(queryParams),
    queryFn: () => getSalesOrders(queryParams),
    // ✅ 移除 initialData - 数据已在 QueryClient 中（通过 HydrationBoundary）
    staleTime: 30 * 1000, // ✅ 30秒内数据视为新鲜，避免频繁请求导致数据闪烁
    refetchOnWindowFocus: false, // 避免窗口聚焦时不必要的刷新
    placeholderData: previousData => previousData, // ✅ 保持上一次数据，避免数据清空
    refetchOnMount: false, // 避免挂载时重新获取
    gcTime: 10 * 60 * 1000, // ✅ 缓存时间10分钟，提升后退/前进体验
  });

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
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
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
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });
      toast({
        title: '操作成功',
        description: '订单状态已更新',
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

  // 计算当前选中的日期范围类型
  const getActiveDateRange = React.useCallback(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    const weekStart = startOfWeek.toISOString().split('T')[0];

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStart = startOfMonth.toISOString().split('T')[0];

    const { startDate, endDate } = initialParams || {};

    if (!startDate && !endDate) {
      return 'all';
    }
    if (startDate === today && endDate === today) {
      return 'today';
    }
    if (startDate === yesterdayStr && endDate === yesterdayStr) {
      return 'yesterday';
    }
    if (startDate === weekStart && endDate === today) {
      return 'thisWeek';
    }
    if (startDate === monthStart && endDate === today) {
      return 'thisMonth';
    }
    return null;
  }, [initialParams]);

  const activeDateRange = getActiveDateRange();

  // 时间范围筛选处理
  const handleDateRangeFilter = React.useCallback(
    (range: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'all') => {
      if (!externalOnFilter) {
        return;
      }

      const now = new Date();
      let startDate: string | undefined;
      let endDate: string | undefined;

      switch (range) {
        case 'today':
          startDate = endDate = now.toISOString().split('T')[0];
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = endDate = yesterday.toISOString().split('T')[0];
          break;
        case 'thisWeek': {
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // 周一为第一天
          startOfWeek.setDate(diff);
          startDate = startOfWeek.toISOString().split('T')[0];
          endDate = now.toISOString().split('T')[0];
          break;
        }
        case 'thisMonth':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = startOfMonth.toISOString().split('T')[0];
          endDate = now.toISOString().split('T')[0];
          break;
        case 'all':
          startDate = undefined;
          endDate = undefined;
          break;
      }

      const dateRangeJson = JSON.stringify({ startDate, endDate });
      externalOnFilter('dateRange', dateRangeJson);
    },
    [externalOnFilter]
  );

  // 状态标签渲染 - 自定义颜色，更符合ERP风格
  const getStatusBadge = (status: string) => {
    const statusStyles: Record<SalesOrderStatus, string> = {
      draft:
        'border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-secondary))]',
      pending:
        'border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
      confirmed:
        'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]',
      processing:
        'border-[hsl(var(--color-purple))] bg-[hsl(var(--color-purple-light))] text-[hsl(var(--color-purple))]',
      shipped:
        'border-[hsl(var(--color-info))] bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]',
      delivered:
        'border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
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
      return '¥0.00';
    }
    return `¥${amount.toFixed(2)}`;
  };

  // 获取收款状态Badge
  const getPaymentStatusBadge = (order: SalesOrder) => {
    const paidAmount = order.paidAmount || 0;
    const remainingAmount = order.remainingAmount || 0;
    const totalAmount = order.totalAmount || 0;

    // 未发货的订单不显示收款状态
    if (order.status !== 'shipped' && order.status !== 'delivered' && order.status !== 'completed') {
      return <span className="text-xs text-[hsl(var(--color-text-tertiary))]">-</span>;
    }

    // 已完成订单
    if (order.status === 'completed') {
      return (
        <Badge
          variant="outline"
          className="text-xs font-medium border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]"
        >
          已完成
        </Badge>
      );
    }

    // 未收款
    if (paidAmount === 0) {
      return (
        <Badge
          variant="outline"
          className="text-xs font-medium border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]"
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
          className="text-xs font-medium border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]"
        >
          部分收款
        </Badge>
      );
    }

    // 全部收款
    return (
      <Badge
        variant="outline"
        className="text-xs font-medium border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]"
      >
        已收款
      </Badge>
    );
  };

  // 格式化日期（只显示日期）
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

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
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          {/* ✅ 加载指示器：提升用户体验 */}
          {isFetching && (
            <div className="mb-2 flex items-center gap-2 text-xs text-[hsl(var(--color-primary))]">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-[hsl(var(--color-primary))] border-t-transparent"></div>
              <span>搜索中...</span>
            </div>
          )}

          {/* 搜索栏和时间筛选按钮的组合布局 */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            {/* 搜索栏区域 */}
            <div className="flex-1">
              <UnifiedSearchBar
                // 搜索配置
                searchValue={searchValue ?? initialParams?.search ?? ''}
                onSearchChange={handleSearch}
                searchPlaceholder="搜索订单号或客户名称..."
                debounceDelay={400}
                compact={true}
                // 筛选器配置
                filters={[
                  {
                    key: 'status',
                    label: '状态',
                    options: [
                      { label: '全部', value: 'all' },
                      { label: '草稿', value: 'draft' },
                      { label: '已确认', value: 'confirmed' },
                      { label: '已发货', value: 'shipped' },
                      { label: '已完成', value: 'completed' },
                      { label: '已取消', value: 'cancelled' },
                    ],
                    width: 'w-24',
                  },
                  {
                    key: 'sortBy',
                    label: '排序',
                    options: [
                      { label: '创建时间', value: 'createdAt' },
                      { label: '订单号', value: 'orderNumber' },
                      { label: '金额', value: 'totalAmount' },
                      { label: '更新时间', value: 'updatedAt' },
                    ],
                    width: 'w-24',
                  },
                ]}
                filterValues={{
                  status: initialParams?.status || 'all',
                  sortBy: initialParams?.sortBy || 'createdAt',
                }}
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* 时间快捷筛选按钮区域 */}
            <div className="flex flex-col gap-2 lg:w-auto lg:min-w-fit">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeDateRange === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDateRangeFilter('today')}
                  className="h-8 text-xs"
                >
                  今日
                </Button>
                <Button
                  variant={
                    activeDateRange === 'yesterday' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => handleDateRangeFilter('yesterday')}
                  className="h-8 text-xs"
                >
                  昨日
                </Button>
                <Button
                  variant={
                    activeDateRange === 'thisWeek' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => handleDateRangeFilter('thisWeek')}
                  className="h-8 text-xs"
                >
                  本周
                </Button>
                <Button
                  variant={
                    activeDateRange === 'thisMonth' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => handleDateRangeFilter('thisMonth')}
                  className="h-8 text-xs"
                >
                  本月
                </Button>
                <Button
                  variant={activeDateRange === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDateRangeFilter('all')}
                  className="h-8 text-xs"
                >
                  全部
                </Button>
              </div>
            </div>
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
              <TableHead>订单号</TableHead>
              <TableHead>
                客户名称
              </TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">
                订单金额
              </TableHead>
              <TableHead>
                收款状态
              </TableHead>
              <TableHead>
                发货时间
              </TableHead>
              <TableHead>
                创建时间
              </TableHead>
              <TableHead>
                更新时间
              </TableHead>
              <TableHead className="w-16">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // 加载状态
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
                </TableRow>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((order, index) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => onOrderSelect?.(order)}
                >
                  <TableCell className="h-8 font-mono text-xs font-semibold text-[hsl(var(--color-primary))] transition-colors hover:text-[hsl(var(--color-primary-hover))]">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="h-8 text-xs font-medium text-[hsl(var(--color-text-primary))]">
                    {order.customer?.name || (
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
                          className="h-6 px-2 text-xs bg-[hsl(var(--color-primary))] text-white hover:bg-[hsl(var(--color-primary-dark))] shadow-sm"
                        >
                          <Truck className="mr-1 h-3 w-3" />
                          {updatingOrderId === order.id ? '处理中...' : '确认发货'}
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
                      <span className="text-[hsl(var(--color-text-tertiary))]">-</span>
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
                        <DropdownMenuItem
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-[hsl(var(--color-error))]"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-muted-foreground h-20 text-center text-xs"
                >
                  暂无数据
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
