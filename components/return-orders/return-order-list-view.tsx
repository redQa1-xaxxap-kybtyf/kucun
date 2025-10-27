'use client';

import { Edit, Eye, MoreHorizontal, Package, TrendingDown } from 'lucide-react';
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
import {
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
  type ReturnOrder,
  type ReturnOrderStatus,
} from '@/lib/types/return-order';
import { formatCurrency } from '@/lib/utils';
import { getReturnOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { formatDateTime } from '@/lib/utils/datetime';

import { ErrorStateCard } from './return-order-list.error';
import type { ReturnOrderListViewProps } from './return-order-list.types';

export function ReturnOrderListView({
  searchValue,
  statusFilter,
  typeFilter,
  processTypeFilter,
  dateRange,
  isSearching,
  onSearch,
  onStatusChange,
  onTypeChange,
  onProcessTypeChange,
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
        dateRange={dateRange}
        isSearching={isSearching}
        onSearch={onSearch}
        onStatusChange={onStatusChange}
        onTypeChange={onTypeChange}
        onProcessTypeChange={onProcessTypeChange}
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
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] py-10"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <Package className="h-12 w-12 text-[hsl(var(--color-text-tertiary))]" />
        <h3 className="mt-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
          暂无退货订单
        </h3>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <Table>
        <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
          <TableRow>
            <TableHead>退货单号</TableHead>
            <TableHead>关联销售单</TableHead>
            <TableHead>客户</TableHead>
            <TableHead>退货类型</TableHead>
            <TableHead>处理方式</TableHead>
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
              onCancelRequest={onCancelRequest}
              onDeleteRequest={onDeleteRequest}
            />
          ))}
        </TableBody>
      </Table>
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

  const formatRefundAmount = React.useCallback((order: ReturnOrder) => {
    const actualAmount =
      typeof order.refundAmount === 'number'
        ? order.refundAmount
        : order.totalAmount;
    const hasAdjustment = Math.abs(actualAmount - order.totalAmount) > 0.005;
    const remainingAmount =
      typeof order.remainingAmount === 'number'
        ? order.remainingAmount
        : undefined;
    const hasRemaining =
      typeof remainingAmount === 'number' && remainingAmount > 0.005;

    return (
      <div className="flex flex-col items-end gap-0.5">
        <span>{formatCurrency(actualAmount)}</span>
        {hasAdjustment && (
          <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
            原退货金额 {formatCurrency(order.totalAmount)}
          </span>
        )}
        {hasRemaining && (
          <span className="text-xs text-[hsl(var(--color-warning))]">
            待处理 {formatCurrency(remainingAmount)}
          </span>
        )}
      </div>
    );
  }, []);

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
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {RETURN_PROCESS_TYPE_LABELS[order.processType]}
      </TableCell>
      <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
        {formatRefundAmount(order)}
      </TableCell>
      <TableCell>
        <Badge
          variant={getReturnOrderStatusBadgeVariant(order.status)}
          className="text-xs font-medium"
        >
          {RETURN_ORDER_STATUS_LABELS[order.status as ReturnOrderStatus]}
        </Badge>
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
        title: '取消成功',
        description: '退货订单已取消',
      });
      setCancelDialogOpen(false);

      // 触发数据刷新
      window.location.reload();
    } catch (error) {
      toast({
        title: '取消失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  }, [order.id, toast]);

  const canEdit = ['draft', 'submitted'].includes(order.status);
  const canCancel = ['draft', 'submitted', 'approved', 'processing'].includes(
    order.status
  );

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
            <AlertDialogTitle>确认取消退货订单</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要取消退货订单 <strong>{order.returnNumber}</strong> 吗？
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
            <AlertDialogCancel>我再想想</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
