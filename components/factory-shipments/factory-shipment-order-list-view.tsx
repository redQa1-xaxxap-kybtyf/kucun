'use client';

import {
  AlertCircle,
  Anchor,
  Edit,
  Eye,
  MoreHorizontal,
  Package,
  Trash2,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ConfirmShipmentDialog } from '@/components/factory-shipments/confirm-shipment-dialog';
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
  useTriggerFactoryShipmentShippingQuery,
  useUpdateFactoryShipmentOrderStatus,
} from '@/lib/api/factory-shipments';
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
  getShippingQueryStatusVariant,
} from '@/lib/utils/factory-shipment-helpers';

const MANUAL_QUERY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
            <TableRow>
              <TableHead className="w-[130px] min-w-[130px]">
                订单编号
              </TableHead>
              <TableHead className="min-w-[120px]">客户</TableHead>
              <TableHead className="hidden min-w-[220px] md:table-cell">
                客户地址
              </TableHead>
              <TableHead className="w-[140px] min-w-[140px]">
                集装箱号码
              </TableHead>
              <TableHead className="min-w-[120px]">船运公司</TableHead>
              <TableHead className="w-[130px] min-w-[130px]">
                运输状态
              </TableHead>
              <TableHead className="w-[140px] min-w-[140px]">状态</TableHead>
              <TableHead className="w-[110px] min-w-[110px] text-right">
                订单金额
              </TableHead>
              <TableHead className="w-[110px] min-w-[110px] text-right">
                应收金额
              </TableHead>
              <TableHead className="w-[110px] min-w-[110px] text-right">
                应付金额
              </TableHead>
              <TableHead className="hidden w-[110px] min-w-[110px] lg:table-cell">
                发货时间
              </TableHead>
              <TableHead className="hidden w-[110px] min-w-[110px] xl:table-cell">
                预计到达
              </TableHead>
              <TableHead className="hidden w-[110px] min-w-[110px] md:table-cell">
                创建时间
              </TableHead>
              <TableHead className="w-[80px] min-w-[80px] text-center">
                操作
              </TableHead>
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
  const manualQueryMutation = useTriggerFactoryShipmentShippingQuery();
  const confirmArrivalMutation = useUpdateFactoryShipmentOrderStatus();
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isShippingCompanyDialogOpen, setIsShippingCompanyDialogOpen] =
    React.useState(false);
  const [isConfirmShipmentDialogOpen, setIsConfirmShipmentDialogOpen] =
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

      // 检查订单状态：已发货、运输中和已到港的订单不允许修改集装箱号
      if (
        order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
        order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
        order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
      ) {
        toast({
          title: '无法编辑',
          description: '已发货、运输中或已到港的订单不能修改集装箱号',
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

      // 业务规则1：已到港的订单不允许修改船运公司
      if (order.status === FACTORY_SHIPMENT_STATUS.ARRIVED) {
        toast({
          title: '无法修改船运公司',
          description: '已到港的订单不允许修改船运公司',
          variant: 'destructive',
        });
        return;
      }

      // 业务规则2：如果订单已经进行过物流查询，不允许修改船运公司
      if (order.lastShippingQueryAt) {
        toast({
          title: '无法修改船运公司',
          description:
            '订单已进行物流查询，不允许修改船运公司。如需修改，请联系管理员。',
          variant: 'destructive',
        });
        return;
      }

      setIsShippingCompanyDialogOpen(true);
    },
    [order.lastShippingQueryAt, order.status, toast]
  );

  const handleShippingCompanyDialogClose = React.useCallback(() => {
    setIsShippingCompanyDialogOpen(false);
  }, []);

  const handleShippingCompanyEditSuccess = React.useCallback(() => {
    setIsShippingCompanyDialogOpen(false);
  }, []);

  const lastQueryTimestamp = order.lastShippingQueryAt
    ? new Date(order.lastShippingQueryAt).getTime()
    : null;
  const nowMs = Date.now();
  const timeSinceLastQuery =
    lastQueryTimestamp !== null ? nowMs - lastQueryTimestamp : null;
  const remainingCooldownMs =
    timeSinceLastQuery !== null
      ? MANUAL_QUERY_COOLDOWN_MS - timeSinceLastQuery
      : 0;
  const isCoolingDown = remainingCooldownMs > 0;
  const hasShippingCompany = Boolean(order.shippingCompany?.trim());
  const isShipped = order.status === FACTORY_SHIPMENT_STATUS.SHIPPED;

  // 判断是否可以编辑物流信息（集装箱号和船运公司）
  const canEditShippingInfo = !(
    order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
    order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
    order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
  );

  // 判断是否可以编辑船运公司（额外检查是否已查询）
  const canEditShippingCompany =
    canEditShippingInfo && !order.lastShippingQueryAt;

  // 手动查询按钮显示逻辑：
  // 1. 必须是已发货状态
  // 2. 必须有物流公司
  // 3. 没有预计到达时间（查询成功后会有）
  // 4. 从未手动查询过（lastShippingQueryAt 为空）
  // 一旦手动查询过一次，无论成功失败，按钮永久隐藏
  const hasNeverBeenManuallyQueried = !order.lastShippingQueryAt;
  const showManualQueryButton =
    !order.estimatedArrival &&
    hasShippingCompany &&
    isShipped &&
    hasNeverBeenManuallyQueried;
  const canTriggerManualQuery =
    showManualQueryButton && !isCoolingDown && !manualQueryMutation.isPending;

  let manualQueryDisabledReason: string | undefined;
  if (isCoolingDown) {
    const remainingMinutes = Math.ceil(remainingCooldownMs / 60000);
    manualQueryDisabledReason = `请 ${remainingMinutes} 分钟后再尝试`;
  } else if (manualQueryMutation.isPending) {
    manualQueryDisabledReason = '查询提交中...';
  }

  const handleManualQuery = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!canTriggerManualQuery) {
        return;
      }

      manualQueryMutation.mutate(order.id, {
        onSuccess: result => {
          toast({
            title: '运输查询已提交',
            description: result?.message || '系统将尽快返回最新的预计到达时间',
            variant: 'success',
          });
        },
        onError: error => {
          toast({
            title: '运输查询提交失败',
            description:
              error instanceof Error ? error.message : '请稍后重试或联系管理员',
            variant: 'destructive',
          });
        },
      });
    },
    [
      canTriggerManualQuery,
      manualQueryMutation,
      manualQueryMutation.isPending,
      order.id,
      toast,
    ]
  );

  const handleConfirmShipmentClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setIsConfirmShipmentDialogOpen(true);
    },
    []
  );

  const handleConfirmShipmentDialogClose = React.useCallback(() => {
    setIsConfirmShipmentDialogOpen(false);
  }, []);

  const handleConfirmShipmentSuccess = React.useCallback(() => {
    setIsConfirmShipmentDialogOpen(false);
  }, []);

  // 确认到港按钮显示逻辑
  // 1. 运输状态为"已到港"、"靠泊"或"锚泊"
  // 2. 订单状态不是 arrived（已到港）
  const canConfirmArrival =
    order.latestShippingStatus &&
    (order.latestShippingStatus.includes('已到港') ||
      order.latestShippingStatus.includes('靠泊') ||
      order.latestShippingStatus.includes('锚泊')) &&
    order.status !== FACTORY_SHIPMENT_STATUS.ARRIVED &&
    order.status !== FACTORY_SHIPMENT_STATUS.CANCELLED;

  const handleConfirmArrival = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();

      if (!canConfirmArrival) {
        return;
      }

      // 生成幂等性键
      const idempotencyKey = crypto.randomUUID();

      confirmArrivalMutation.mutate(
        {
          id: order.id,
          data: {
            idempotencyKey,
            status: FACTORY_SHIPMENT_STATUS.ARRIVED,
            arrivalDate: new Date().toISOString(),
          },
        },
        {
          onSuccess: () => {
            toast({
              title: '确认到港成功',
              description: `订单 ${order.orderNumber} 已确认到港`,
              variant: 'success',
            });
          },
          onError: (error: Error) => {
            toast({
              title: '确认到港失败',
              description: error.message || '请稍后重试或联系管理员',
              variant: 'destructive',
            });
          },
        }
      );
    },
    [
      canConfirmArrival,
      confirmArrivalMutation,
      order.id,
      order.orderNumber,
      toast,
    ]
  );

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
        <TableCell className="w-[130px] px-4 py-3 font-mono text-sm font-medium text-[hsl(var(--color-primary))]">
          <Link
            href={`/factory-shipments/${order.id}`}
            prefetch={false}
            className="hover:underline"
            onClick={event => event.stopPropagation()}
            title={order.orderNumber}
          >
            <span className="block truncate">{order.orderNumber}</span>
          </Link>
        </TableCell>
        <TableCell
          className="px-4 py-3 font-medium text-[hsl(var(--color-text-primary))]"
          title={order.customer?.name || '-'}
        >
          <span className="block max-w-[200px] truncate">
            {order.customer?.name || '-'}
          </span>
        </TableCell>
        <TableCell
          className="hidden w-[240px] px-4 py-3 text-[hsl(var(--color-text-secondary))] md:table-cell"
          title={order.customer?.address || '未填写'}
        >
          <span className="block max-w-[220px] truncate text-sm">
            {order.customer?.address || '未填写'}
          </span>
        </TableCell>
        <TableCell
          className={`w-[140px] px-4 py-3 text-[hsl(var(--color-text-secondary))] ${
            // 已发货、运输中和已到港的订单不允许编辑
            order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
            order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
            order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
              ? 'cursor-not-allowed'
              : 'cursor-pointer'
          }`}
          onClick={handleContainerNumberClick}
          title={
            order.containerNumber ||
            (order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
            order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
            order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
              ? '不可填写'
              : '点击填写')
          }
        >
          <span
            className={`transition-colors ${
              // 已发货、运输中和已到港的订单显示为不可编辑状态
              order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
              order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
              order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
                ? 'text-[hsl(var(--color-text-tertiary))]'
                : 'hover:text-[hsl(var(--color-primary))]'
            }`}
          >
            {order.containerNumber ? (
              <span className="flex items-center gap-1">
                <span className="block max-w-[110px] truncate">
                  {order.containerNumber}
                </span>
                {order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
                order.status === FACTORY_SHIPMENT_STATUS.ARRIVED ? (
                  // 不可编辑状态：锁定图标
                  <Edit className="h-3 w-3 flex-shrink-0 opacity-30" />
                ) : (
                  // 可编辑状态：可点击的编辑图标
                  <Edit className="h-3 w-3 flex-shrink-0 opacity-60 hover:opacity-100" />
                )}
              </span>
            ) : (
              <span
                className={`flex items-center gap-1 ${
                  order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                  order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
                  order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
                    ? 'text-[hsl(var(--color-text-tertiary))]'
                    : 'text-[hsl(var(--color-text-tertiary))] hover:text-[hsl(var(--color-primary))]'
                }`}
              >
                {order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
                order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
                  ? '不可填写'
                  : '点击填写'}
                <Edit
                  className={`h-3 w-3 ${
                    order.status === FACTORY_SHIPMENT_STATUS.SHIPPED ||
                    order.status === FACTORY_SHIPMENT_STATUS.IN_TRANSIT ||
                    order.status === FACTORY_SHIPMENT_STATUS.ARRIVED
                      ? 'opacity-30'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                />
              </span>
            )}
          </span>
        </TableCell>
        <TableCell
          className={`px-4 py-3 text-[hsl(var(--color-text-secondary))] ${
            canEditShippingCompany
              ? 'cursor-pointer'
              : 'cursor-not-allowed opacity-60'
          }`}
          onClick={handleShippingCompanyClick}
          title={
            !canEditShippingInfo
              ? '已发货、运输中或已到港的订单不可修改'
              : order.lastShippingQueryAt
                ? '已查询，不可修改'
                : order.shippingCompany || '点击输入'
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                canEditShippingCompany
                  ? 'transition-colors hover:text-[hsl(var(--color-primary))]'
                  : ''
              }
            >
              {order.shippingCompany ? (
                <span className="flex items-center gap-1">
                  <span className="block max-w-[150px] truncate">
                    {order.shippingCompany}
                  </span>
                  {canEditShippingCompany ? (
                    <Edit className="h-3 w-3 flex-shrink-0 opacity-60 hover:opacity-100" />
                  ) : (
                    <Edit className="h-3 w-3 flex-shrink-0 opacity-30" />
                  )}
                </span>
              ) : (
                <span
                  className={`flex items-center gap-1 ${
                    canEditShippingCompany
                      ? 'text-[hsl(var(--color-text-tertiary))] hover:text-[hsl(var(--color-primary))]'
                      : 'text-[hsl(var(--color-text-tertiary))]'
                  }`}
                >
                  点击输入
                  <Edit
                    className={`h-3 w-3 ${
                      canEditShippingCompany
                        ? 'opacity-60 hover:opacity-100'
                        : 'opacity-30'
                    }`}
                  />
                </span>
              )}
            </span>
            {/* 已发货但缺少船公司信息的角标提示 */}
            {order.status === 'shipped' &&
              order.containerNumber &&
              !order.shippingCompany &&
              !order.lastShippingQueryAt && (
                <Badge
                  variant="outline"
                  className="border-yellow-500 text-xs text-yellow-700"
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  待补充
                </Badge>
              )}
            {/* 已查询锁定提示 */}
            {order.lastShippingQueryAt && (
              <Badge
                variant="outline"
                className="border-gray-400 text-xs text-gray-600"
              >
                已锁定
              </Badge>
            )}
          </div>
        </TableCell>

        {/* 运输状态列 */}
        <TableCell className="w-[130px] px-4 py-3">
          {order.latestShippingStatus ? (
            <Badge
              variant={getShippingQueryStatusVariant(
                order.latestShippingStatus
              )}
              className="text-xs font-medium"
            >
              {order.latestShippingStatus}
            </Badge>
          ) : (
            <span className="text-[hsl(var(--color-text-tertiary))]">
              未查询
            </span>
          )}
        </TableCell>

        <TableCell className="w-[170px] px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
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
              {order.status === FACTORY_SHIPMENT_STATUS.CONFIRMED && (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-6 bg-[hsl(var(--color-primary))] px-2 text-xs text-white shadow-sm hover:bg-[hsl(var(--color-primary-dark))]"
                  onClick={handleConfirmShipmentClick}
                >
                  <Truck className="mr-1 h-3 w-3" />
                  确认发货
                </Button>
              )}
            </div>
            {showManualQueryButton && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 justify-start px-2 text-xs"
                disabled={!canTriggerManualQuery}
                onClick={handleManualQuery}
                title={
                  !canTriggerManualQuery && manualQueryDisabledReason
                    ? manualQueryDisabledReason
                    : '提交手动查询'
                }
              >
                {manualQueryMutation.isPending ? '查询提交中...' : '手动查询'}
              </Button>
            )}
            {canConfirmArrival && (
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-7 justify-start bg-[hsl(var(--color-success))] px-2 text-xs text-white shadow-sm hover:bg-[hsl(var(--color-success-hover))]"
                disabled={confirmArrivalMutation.isPending}
                onClick={handleConfirmArrival}
                title="确认订单已到港"
              >
                <Anchor className="mr-1 h-3 w-3" />
                {confirmArrivalMutation.isPending ? '确认中...' : '确认到港'}
              </Button>
            )}
          </div>
        </TableCell>
        <TableCell className="w-[110px] px-4 py-3 text-right text-[hsl(var(--color-text-primary))] tabular-nums">
          {formatAmount(order.totalAmount)}
        </TableCell>
        <TableCell className="w-[110px] px-4 py-3 text-right text-[hsl(var(--color-text-primary))] tabular-nums">
          <div className="flex flex-col items-end gap-1 leading-tight">
            <span className="font-semibold text-[hsl(var(--color-primary))]">
              {formatAmount(order.receivableAmount)}
            </span>
            {order.depositAmount > 0 && (
              <span className="text-xs font-medium text-[hsl(var(--color-warning))]">
                定金 {formatAmount(order.depositAmount)}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="w-[110px] px-4 py-3 text-right text-[hsl(var(--color-text-primary))] tabular-nums">
          {formatAmount(order.costAmount || 0)}
        </TableCell>
        <TableCell className="hidden w-[110px] px-4 py-3 text-[hsl(var(--color-text-secondary))] lg:table-cell">
          {order.shipmentDate ? (
            <span className="whitespace-nowrap">
              {formatDateTime(order.shipmentDate)}
            </span>
          ) : (
            <span className="text-[hsl(var(--color-text-tertiary))]">
              未发货
            </span>
          )}
        </TableCell>
        <TableCell className="hidden w-[110px] px-4 py-3 text-[hsl(var(--color-text-secondary))] xl:table-cell">
          {order.estimatedArrival ? (
            <span className="whitespace-nowrap">
              {formatDateTime(order.estimatedArrival)}
            </span>
          ) : (
            <span className="text-[hsl(var(--color-text-tertiary))]">
              未设置
            </span>
          )}
        </TableCell>
        <TableCell className="hidden w-[110px] px-4 py-3 text-[hsl(var(--color-text-secondary))] md:table-cell">
          <span className="whitespace-nowrap">
            {formatDate(order.createdAt)}
          </span>
        </TableCell>
        <TableCell className="w-[80px] px-4 py-3 text-center">
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
          lastShippingQueryAt: order.lastShippingQueryAt,
        }}
        open={isShippingCompanyDialogOpen}
        onOpenChange={handleShippingCompanyDialogClose}
        onSuccess={handleShippingCompanyEditSuccess}
      />

      {/* 确认发货对话框 */}
      <ConfirmShipmentDialog
        orderId={order.id}
        orderNumber={order.orderNumber}
        containerNumber={order.containerNumber}
        shippingCompany={order.shippingCompany}
        open={isConfirmShipmentDialogOpen}
        onOpenChange={handleConfirmShipmentDialogClose}
        onSuccess={handleConfirmShipmentSuccess}
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
