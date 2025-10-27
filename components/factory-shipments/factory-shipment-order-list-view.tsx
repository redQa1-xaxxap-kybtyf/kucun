'use client';

import { Edit, Eye, MoreHorizontal, Package, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ContentLoading } from '@/components/common/loading';
import { FactoryShipmentSearchToolbar } from '@/components/factory-shipments/factory-shipment-search-toolbar';
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
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import {
  canCancelOrder,
  canDeleteOrder,
  formatAmount,
  formatDate,
  formatDateTime,
  getFactoryShipmentStatusBadgeVariant,
} from '@/lib/utils/factory-shipment-helpers';

import { ErrorStateCard } from './factory-shipment-order-list.error';
import type { FactoryShipmentOrderListViewProps } from './factory-shipment-order-list.types';

export function FactoryShipmentOrderListView({
  searchValue,
  statusFilter,
  dateRange,
  isSearching,
  onSearch,
  onStatusChange,
  onDateRangeChange,
  onClearFilters,
  orders,
  isLoading,
  error,
  pagination,
  onPageChange,
  onCancelRequest,
  onDeleteRequest,
  onOrderSelect,
  onRetry,
}: FactoryShipmentOrderListViewProps) {
  if (isLoading) {
    return <ContentLoading text="加载厂家发货订单..." />;
  }

  if (error) {
    return <ErrorStateCard onRetry={onRetry} />;
  }

  return (
    <div className="space-y-4">
      <FactoryShipmentSearchToolbar
        searchValue={searchValue}
        statusFilter={statusFilter}
        dateRange={dateRange}
        isSearching={isSearching}
        onSearch={onSearch}
        onStatusChange={onStatusChange}
        onDateRangeChange={onDateRangeChange}
        onClearFilters={onClearFilters}
      />

      <FactoryShipmentOrderTable
        orders={orders}
        onCancelRequest={onCancelRequest}
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

interface FactoryShipmentOrderTableProps {
  orders: FactoryShipmentOrder[];
  onCancelRequest: (order: FactoryShipmentOrder) => void;
  onDeleteRequest: (order: FactoryShipmentOrder) => void;
  onOrderSelect?: (order: FactoryShipmentOrder) => void;
}

function FactoryShipmentOrderTable({
  orders,
  onCancelRequest,
  onDeleteRequest,
  onOrderSelect,
}: FactoryShipmentOrderTableProps) {
  if (orders.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] py-10"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <Package className="h-12 w-12 text-[hsl(var(--color-text-tertiary))]" />
        <h3 className="mt-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
          暂无厂家发货订单
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
            <TableHead>订单编号</TableHead>
            <TableHead>集装箱号码</TableHead>
            <TableHead>客户</TableHead>
            <TableHead>船运公司</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">订单金额</TableHead>
            <TableHead className="text-right">应收金额</TableHead>
            <TableHead>发货时间</TableHead>
            <TableHead>预计到达</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map(order => (
            <FactoryShipmentOrderRow
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

interface FactoryShipmentOrderRowProps {
  order: FactoryShipmentOrder;
  onOrderSelect?: (order: FactoryShipmentOrder) => void;
  onCancelRequest: (order: FactoryShipmentOrder) => void;
  onDeleteRequest: (order: FactoryShipmentOrder) => void;
}

function FactoryShipmentOrderRow({
  order,
  onOrderSelect,
  onCancelRequest,
  onDeleteRequest,
}: FactoryShipmentOrderRowProps) {
  const router = useRouter();

  const handleNavigate = React.useCallback(() => {
    if (onOrderSelect) {
      onOrderSelect(order);
      return;
    }
    router.push(`/factory-shipments/${order.id}`);
  }, [onOrderSelect, order, router]);

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
          href={`/factory-shipments/${order.id}`}
          prefetch={false}
          className="hover:underline"
          onClick={event => event.stopPropagation()}
        >
          {order.orderNumber}
        </Link>
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {order.containerNumber || (
          <span className="text-[hsl(var(--color-text-tertiary))]">未填写</span>
        )}
      </TableCell>
      <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
        {order.customer?.name || '-'}
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {order.shippingCompany || (
          <span className="text-[hsl(var(--color-text-tertiary))]">未填写</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={getFactoryShipmentStatusBadgeVariant(order.status)}
          className="text-xs font-medium"
        >
          {
            FACTORY_SHIPMENT_STATUS_LABELS[
              order.status as FactoryShipmentStatus
            ]
          }
        </Badge>
      </TableCell>
      <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
        {formatAmount(order.totalAmount)}
      </TableCell>
      <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
        {formatAmount(order.receivableAmount)}
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {order.shipmentDate ? (
          formatDateTime(order.shipmentDate)
        ) : (
          <span className="text-[hsl(var(--color-text-tertiary))]">未发货</span>
        )}
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {order.estimatedArrival ? (
          formatDateTime(order.estimatedArrival)
        ) : (
          <span className="text-[hsl(var(--color-text-tertiary))]">未设置</span>
        )}
      </TableCell>
      <TableCell className="text-[hsl(var(--color-text-secondary))]">
        {formatDate(order.createdAt)}
      </TableCell>
      <TableCell>
        <OrderActionMenu
          order={order}
          onCancelRequest={onCancelRequest}
          onDeleteRequest={onDeleteRequest}
        />
      </TableCell>
    </TableRow>
  );
}

interface OrderActionMenuProps {
  order: FactoryShipmentOrder;
  onCancelRequest: (order: FactoryShipmentOrder) => void;
  onDeleteRequest: (order: FactoryShipmentOrder) => void;
}

function OrderActionMenu({
  order,
  onCancelRequest,
  onDeleteRequest,
}: OrderActionMenuProps) {
  const router = useRouter();

  return (
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
            router.push(`/factory-shipments/${order.id}`);
          }}
        >
          <Eye className="mr-2 h-4 w-4" />
          查看
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={event => {
            event.stopPropagation();
            router.push(`/factory-shipments/${order.id}/edit`);
          }}
        >
          <Edit className="mr-2 h-4 w-4" />
          编辑
        </DropdownMenuItem>
        {canCancelOrder(order.status) && order.status !== 'draft' && (
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onCancelRequest(order);
            }}
            className="text-[hsl(var(--color-warning))]"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            取消
          </DropdownMenuItem>
        )}
        {canDeleteOrder(order.status) && (
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onDeleteRequest(order);
            }}
            className="text-[hsl(var(--color-error))]"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
