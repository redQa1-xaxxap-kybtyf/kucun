'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Edit,
  Eye,
  MoreHorizontal,
  Package,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ContentLoading } from '@/components/common/loading';
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
import { useUpdateReturnOrderStatus } from '@/lib/api/return-orders';
import { queryKeys } from '@/lib/queryKeys';
import {
  RETURN_ORDER_TYPE_LABELS,
  getReturnOrderDisplayStatus,
  getReturnOrderPendingRefundAmount,
  type ReturnOrder,
} from '@/lib/types/return-order';
import { formatCurrency } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/datetime';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

import { ErrorStateCard } from './return-order-list.error';
import type { ReturnOrderListViewProps } from './return-order-list.types';

export function ReturnOrderListView({
  searchValue,
  statusFilter,
  typeFilter,
  processTypeFilter,
  includeTest,
  includeVoided,
  dateRange,
  isSearching,
  onSearch,
  onStatusChange,
  onTypeChange,
  onProcessTypeChange,
  onIncludeTestToggle,
  onIncludeVoidedToggle,
  onDateRangeChange,
  onClearFilters,
  orders,
  isLoading,
  error,
  pagination,
  onPageChange,
  onDeleteRequest,
  onOrderSelect,
  onRetry,
}: ReturnOrderListViewProps) {
  if (isLoading) {
    return <ContentLoading text="加载退货订单..." />;
  }

  if (error) {
    return <ErrorStateCard onRetry={onRetry} />;
  }

  return (
    <div className="space-y-4">
      <ReturnOrderSearchToolbar
        searchValue={searchValue}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        processTypeFilter={processTypeFilter}
        includeTest={includeTest}
        includeVoided={includeVoided}
        dateRange={dateRange}
        isSearching={isSearching}
        onSearch={onSearch}
        onStatusChange={onStatusChange}
        onTypeChange={onTypeChange}
        onProcessTypeChange={onProcessTypeChange}
        onIncludeTestToggle={onIncludeTestToggle}
        onIncludeVoidedToggle={onIncludeVoidedToggle}
        onDateRangeChange={onDateRangeChange}
        onClearFilters={onClearFilters}
      />

      <ReturnOrderTable
        orders={orders}
        onDeleteRequest={onDeleteRequest}
        onOrderSelect={onOrderSelect}
      />

      {pagination && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.totalCount,
              totalPages: pagination.totalPages,
            }}
            onPageChange={onPageChange}
            showRange
            showTotal
          />
        </div>
      )}
    </div>
  );
}

interface ReturnOrderTableProps {
  orders: ReturnOrder[];
  onDeleteRequest: (order: ReturnOrder) => void;
  onOrderSelect?: (order: ReturnOrder) => void;
}

function ReturnOrderTable({
  orders,
  onDeleteRequest,
  onOrderSelect,
}: ReturnOrderTableProps) {
  if (orders.length === 0) {
    return (
      <div className="card-shadow-medium flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] py-10">
        <Package className="h-12 w-12 text-[hsl(var(--color-text-tertiary))]" />
        <h3 className="mt-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
          暂无退货订单
        </h3>
      </div>
    );
  }

  return (
    <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
      {/* 桌面端：表格视图，支持横向滚动 */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="card-shadow-light">
              <TableRow>
                <TableHead>退货单号</TableHead>
                <TableHead>关联销售单</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>退货类型</TableHead>
                <TableHead className="text-right">实际退款金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <ReturnOrderRow
                  key={order.id}
                  order={order}
                  onOrderSelect={onOrderSelect}
                  onDeleteRequest={onDeleteRequest}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 移动端：卡片视图 */}
      <div className="space-y-3 px-3 py-3 md:hidden">
        {orders.map(order => {
          const displayStatus = getReturnOrderDisplayStatus(order);
          const pendingRefundAmount = getReturnOrderPendingRefundAmount(order);
          const handleCardClick = () => {
            if (onOrderSelect) {
              onOrderSelect(order);
              return;
            }
            window.location.href = `/return-orders/${order.id}`;
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
                    {order.returnNumber}
                  </div>
                  <div className="mt-0.5 text-xs text-[hsl(var(--color-text-secondary))]">
                    销售订单：{order.salesOrder?.orderNumber || '无关联'}
                  </div>
                  <div className="mt-0.5 text-xs text-[hsl(var(--color-text-secondary))]">
                    客户：{order.customer?.name || '-'}
                  </div>
                  <div className="mt-0.5 text-xs text-[hsl(var(--color-text-secondary))]">
                    退货类型：{RETURN_ORDER_TYPE_LABELS[order.type]}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                  <div className="font-semibold text-[hsl(var(--color-success))]">
                    金额：
                    {formatCurrency(
                      typeof order.refundAmount === 'number'
                        ? order.refundAmount
                        : order.totalAmount
                    )}
                  </div>
                  <div className="mt-1 flex justify-end">
                    <Badge
                      variant={displayStatus.variant}
                      className="text-[10px] font-medium"
                    >
                      {displayStatus.label}
                    </Badge>
                  </div>
                  {pendingRefundAmount > 0.005 && (
                    <div className="mt-1 text-[hsl(var(--color-warning))]">
                      待退款：{formatCurrency(pendingRefundAmount)}
                    </div>
                  )}
                  <div className="mt-1 text-[hsl(var(--color-text-tertiary))]">
                    创建时间：{formatDateTime(order.createdAt)}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 text-[11px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={event => {
                    event.stopPropagation();
                    handleCardClick();
                  }}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  查看
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={event => {
                    event.stopPropagation();
                    onDeleteRequest(order);
                  }}
                >
                  <TrendingDown className="mr-1 h-3 w-3" />
                  删除
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ReturnOrderRowProps {
  order: ReturnOrder;
  onOrderSelect?: (order: ReturnOrder) => void;
  onDeleteRequest: (order: ReturnOrder) => void;
}

function ReturnOrderRow({
  order,
  onOrderSelect,
  onDeleteRequest,
}: ReturnOrderRowProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateStatusMutation = useUpdateReturnOrderStatus();

  const handleNavigate = React.useCallback(() => {
    if (onOrderSelect) {
      onOrderSelect(order);
      return;
    }
    router.push(`/return-orders/${order.id}`);
  }, [onOrderSelect, order, router]);

  const handleDelete = React.useCallback(() => {
    onDeleteRequest(order);
  }, [onDeleteRequest, order]);

  const formatRefundAmount = React.useCallback((o: ReturnOrder) => {
    const pendingRefundAmount = getReturnOrderPendingRefundAmount(o);
    const actualAmount =
      typeof o.refundAmount === 'number' ? o.refundAmount : o.totalAmount;
    const hasAdjustment = Math.abs(actualAmount - o.totalAmount) > 0.005;

    return (
      <div className="flex flex-col items-end gap-0.5">
        <span>{formatCurrency(actualAmount)}</span>
        {hasAdjustment && (
          <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
            原退货金额 {formatCurrency(o.totalAmount)}
          </span>
        )}
        {pendingRefundAmount > 0.005 && (
          <span className="text-xs text-[hsl(var(--color-warning))]">
            待退款 {formatCurrency(pendingRefundAmount)}
          </span>
        )}
      </div>
    );
  }, []);

  const handleComplete = React.useCallback(() => {
    setIsConfirming(true);
    updateStatusMutation.mutate(
      {
        id: order.id,
        status: 'completed',
      },
      {
        onSuccess: () => {
          setIsConfirming(false);
          const successDescription =
            order.processType === 'refund'
              ? '这张退货单已经处理完成，库存已回补。如需退款，请继续登记退款。'
              : '这张退货单已经处理完成，库存已回补。';
          toast({
            title: '退货已完成',
            description: successDescription,
            variant: 'success',
          });
          // 刷新退货订单相关的列表/统计缓存，而不整页刷新
          queryClient.invalidateQueries({
            queryKey: queryKeys.returnOrders.all,
          });
        },
        onError: (error: Error) => {
          setIsConfirming(false);
          toast({
            title: '处理失败',
            description: getFriendlyErrorMessage(
              error,
              '退货状态暂时无法更新，请稍后重试'
            ),
            variant: 'destructive',
          });
        },
      }
    );
  }, [order.id, order.processType, queryClient, toast, updateStatusMutation]);

  const displayStatus = getReturnOrderDisplayStatus(order);
  const canComplete = ['submitted', 'approved', 'processing'].includes(
    order.status
  );

  return (
    <TableRow
      className="cursor-pointer border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
      onClick={handleNavigate}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleNavigate();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <TableCell className="font-mono font-medium text-[hsl(var(--color-primary))]">
        <Link
          href={`/return-orders/${order.id}`}
          prefetch={false}
          className="hover:underline"
          onClick={event => event.stopPropagation()}
        >
          {order.returnNumber}
        </Link>
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {order.salesOrder?.orderNumber || (
          <span className="text-[hsl(var(--color-text-tertiary))]">无关联</span>
        )}
      </TableCell>
      <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
        {order.customer?.name || '-'}
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {RETURN_ORDER_TYPE_LABELS[order.type]}
      </TableCell>
      <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
        {formatRefundAmount(order)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge
            variant={displayStatus.variant}
            className="text-xs font-medium"
          >
            {displayStatus.label}
          </Badge>
          {canComplete && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={event => {
                event.stopPropagation();
                handleComplete();
              }}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <span className="flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3 animate-spin" />
                  完成中...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  完成退货
                </span>
              )}
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {formatDateTime(order.createdAt)}
      </TableCell>
      <TableCell>
        <ReturnOrderActionMenu order={order} onDeleteRequest={handleDelete} />
      </TableCell>
    </TableRow>
  );
}

interface ReturnOrderActionMenuProps {
  order: ReturnOrder;
  onDeleteRequest: () => void;
}

function ReturnOrderActionMenu({
  order,
  onDeleteRequest,
}: ReturnOrderActionMenuProps) {
  const router = useRouter();
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const { toast } = useToast();

  const handleConfirmCancel = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/return-orders/${order.id}/status`, {
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

      toast({
        title: '退货单已取消',
        description: '这张退货单已取消，后续不会再继续处理。',
        variant: 'success',
      });
      setCancelDialogOpen(false);

      // 触发数据刷新
      window.location.reload();
    } catch (error) {
      toast({
        title: '暂时无法取消',
        description: getFriendlyErrorMessage(
          error,
          '这张退货单暂时无法取消，请稍后再试。'
        ),
        variant: 'destructive',
      });
    }
  }, [order.id, toast]);

  const canEdit = ['draft', 'submitted'].includes(order.status);
  // 确认后（approved 及之后）不允许再取消
  const canCancel = ['draft', 'submitted'].includes(order.status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={event => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              router.push(`/return-orders/${order.id}`);
            }}
          >
            <Eye className="mr-2 h-4 w-4" />
            查看
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                router.push(`/return-orders/${order.id}/edit`);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                setCancelDialogOpen(true);
              }}
              className="text-[hsl(var(--color-warning))]"
            >
              <TrendingDown className="mr-2 h-4 w-4" />
              取消
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onDeleteRequest();
            }}
            className="text-[hsl(var(--color-error))]"
          >
            <TrendingDown className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定取消这张退货单吗？</AlertDialogTitle>
            <AlertDialogDescription>
              退货单 <strong>{order.returnNumber}</strong> 取消后将不再继续处理。
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
            <AlertDialogCancel>我再想想</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认取消退货单
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
