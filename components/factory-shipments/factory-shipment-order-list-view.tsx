'use client';

import {
  AlertCircle,
  Edit,
  Eye,
  MoreHorizontal,
  Package,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ContainerNumberEditDialog } from '@/components/factory-shipments/container-number-edit-dialog';
import { FactoryShipmentSearchToolbar } from '@/components/factory-shipments/factory-shipment-search-toolbar';
import { ShippingCompanyEditDialog } from '@/components/factory-shipments/shipping-company-edit-dialog';
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
import {
  FACTORY_SHIPMENT_STATUS,
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
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isShippingCompanyDialogOpen, setIsShippingCompanyDialogOpen] =
    React.useState(false);

  const handleNavigate = React.useCallback(() => {
    if (onOrderSelect) {
      onOrderSelect(order);
      return;
    }
    router.push(`/factory-shipments/${order.id}`);
  }, [onOrderSelect, order, router]);

  // 集装箱号点击处理 - 检查订单状态
  const handleContainerNumberClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();

      // 检查订单状态：已发货和运输中的订单不允许修改集装箱号
      if (
        order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
        order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT
      ) {
        toast({
          title: '无法编辑',
          description: '已发货或运输中的订单不能修改集装箱号',
          variant: 'destructive',
        });
        return;
      }

      setIsEditDialogOpen(true);
    },
    [order.status, toast]
  );

  const handleEditDialogClose = React.useCallback(() => {
    setIsEditDialogOpen(false);
  }, []);

  const handleEditSuccess = React.useCallback(() => {
    setIsEditDialogOpen(false);
  }, []);

  // 船公司名称点击处理
  const handleShippingCompanyClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setIsShippingCompanyDialogOpen(true);
    },
    []
  );

  const handleShippingCompanyDialogClose = React.useCallback(() => {
    setIsShippingCompanyDialogOpen(false);
  }, []);

  const handleShippingCompanyEditSuccess = React.useCallback(() => {
    setIsShippingCompanyDialogOpen(false);
  }, []);

  return (
    <>
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
        <TableCell
          className={`text-[hsl(var(--color-text-secondary))] ${
            // 已发货和运输中的订单不允许编辑
            order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
            order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT
              ? 'cursor-not-allowed'
              : 'cursor-pointer'
          }`}
          onClick={handleContainerNumberClick}
        >
          <span
            className={`transition-colors ${
              // 已发货和运输中的订单显示为不可编辑状态
              order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
              order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT
                ? 'text-[hsl(var(--color-text-tertiary))]'
                : 'hover:text-[hsl(var(--color-primary))]'
            }`}
          >
            {order.containerNumber ? (
              <span className="flex items-center gap-1">
                {order.containerNumber}
                {order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ? (
                  // 不可编辑状态：锁定图标
                  <Edit className="h-3 w-3 opacity-30" />
                ) : (
                  // 可编辑状态：可点击的编辑图标
                  <Edit className="h-3 w-3 opacity-60 hover:opacity-100" />
                )}
              </span>
            ) : (
              <span
                className={`flex items-center gap-1 ${
                  order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                  order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT
                    ? 'text-[hsl(var(--color-text-tertiary))]'
                    : 'text-[hsl(var(--color-text-tertiary))] hover:text-[hsl(var(--color-primary))]'
                }`}
              >
                {order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT
                  ? '不可填写'
                  : '点击填写'}
                <Edit
                  className={`h-3 w-3 ${
                    order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                    order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT
                      ? 'opacity-30'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                />
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
          {order.customer?.name || '-'}
        </TableCell>
        <TableCell
          className="cursor-pointer text-[hsl(var(--color-text-secondary))]"
          onClick={handleShippingCompanyClick}
        >
          <span className="transition-colors hover:text-[hsl(var(--color-primary))]">
            {order.shippingCompany ? (
              <span className="flex items-center gap-1">
                {order.shippingCompany}
                <Edit className="h-3 w-3 opacity-60 hover:opacity-100" />
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[hsl(var(--color-text-tertiary))] hover:text-[hsl(var(--color-primary))]">
                点击输入
                <Edit className="h-3 w-3 opacity-60 hover:opacity-100" />
              </span>
            )}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
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
            {/* 已发货但缺少船公司信息的角标提示 */}
            {order.status === 'shipped' &&
              order.containerNumber &&
              !order.shippingCompany && (
                <Badge
                  variant="outline"
                  className="border-yellow-500 text-xs text-yellow-700"
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  待补充船公司
                </Badge>
              )}
          </div>
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
            <span className="text-[hsl(var(--color-text-tertiary))]">
              未发货
            </span>
          )}
        </TableCell>
        <TableCell className="text-[hsl(var(--color-text-secondary))]">
          {order.estimatedArrival ? (
            formatDateTime(order.estimatedArrival)
          ) : (
            <span className="text-[hsl(var(--color-text-tertiary))]">
              未设置
            </span>
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

      {/* 集装箱号编辑对话框 */}
      <ContainerNumberEditDialog
        order={{
          id: order.id,
          orderNumber: order.orderNumber,
          containerNumber: order.containerNumber,
        }}
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogClose}
        onSuccess={handleEditSuccess}
      />

      {/* 船公司名称编辑对话框 */}
      <ShippingCompanyEditDialog
        order={{
          id: order.id,
          orderNumber: order.orderNumber,
          shippingCompany: order.shippingCompany || null,
        }}
        open={isShippingCompanyDialogOpen}
        onOpenChange={handleShippingCompanyDialogClose}
        onSuccess={handleShippingCompanyEditSuccess}
      />
    </>
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
