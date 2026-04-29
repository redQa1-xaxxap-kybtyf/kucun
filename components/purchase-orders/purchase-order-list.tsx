'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CopyButton } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import { PurchaseOrderContainerNumberEditDialog } from '@/components/purchase-orders/purchase-order-container-number-edit-dialog';
import { PurchaseOrderShippingCompanyEditDialog } from '@/components/purchase-orders/purchase-order-shipping-company-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getPurchaseOrders,
  purchaseOrderQueryKeys,
  type PurchaseOrderListParams,
} from '@/lib/api/purchase-orders';
import {
  PURCHASE_ORDER_STATUS,
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';
import { cn } from '@/lib/utils';
import { formatPurchaseOrderSuppliers } from '@/lib/utils/purchase-order-suppliers';

interface PurchaseOrderListProps {
  page?: number;
  limit?: number;
  search?: string;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onPageChange?: (page: number) => void;
}

type EditingContainerOrder = {
  id: string;
  orderNumber: string;
  containerNumber: string | null;
};

type EditingShippingOrder = {
  id: string;
  orderNumber: string;
  shippingCompany: string | null;
};

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '-';
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const STATUS_VARIANTS: Record<
  PurchaseOrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  [PURCHASE_ORDER_STATUS.DRAFT]: 'secondary',
  [PURCHASE_ORDER_STATUS.ORDERED]: 'default',
  [PURCHASE_ORDER_STATUS.SHIPPED]: 'default',
  [PURCHASE_ORDER_STATUS.IN_TRANSIT]: 'default',
  [PURCHASE_ORDER_STATUS.ARRIVED]: 'default',
  [PURCHASE_ORDER_STATUS.COMPLETED]: 'default',
  [PURCHASE_ORDER_STATUS.CANCELLED]: 'destructive',
};

export function PurchaseOrderList({
  page = 1,
  limit = 20,
  search,
  status,
  supplierId,
  startDate,
  endDate,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onPageChange,
}: PurchaseOrderListProps) {
  const queryParams: PurchaseOrderListParams = {
    page,
    limit,
    search,
    status,
    supplierId,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isFetching, error } = useQuery<{
    data: PurchaseOrder[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: purchaseOrderQueryKeys.list(queryParams),
    queryFn: () => getPurchaseOrders(queryParams),
    refetchOnMount: 'always',
    placeholderData: previousData => previousData,
  });

  const [editingContainerOrder, setEditingContainerOrder] =
    React.useState<EditingContainerOrder | null>(null);
  const [editingOrder, setEditingOrder] =
    React.useState<EditingShippingOrder | null>(null);

  const orders = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const isInitialLoading = isLoading && !data;
  const isListRefreshing = !isInitialLoading && isFetching;

  if (error && !data) {
    return (
      <div className="border-destructive bg-destructive/10 rounded-lg border p-6 text-center">
        <p className="text-destructive">采购订单加载失败</p>
      </div>
    );
  }

  return (
    <div
      className="relative space-y-4"
      aria-busy={isInitialLoading || isListRefreshing}
    >
      {isListRefreshing && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center border-b border-[hsl(var(--color-border-primary))] bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
          正在更新
        </div>
      )}

      <div
        className={cn('transition-opacity', isListRefreshing && 'opacity-60')}
      >
        {isInitialLoading ? (
          <PurchaseOrderListSkeleton />
        ) : orders.length === 0 ? (
          <div className="bg-muted/50 rounded-lg border p-12 text-center">
            <p className="text-muted-foreground">暂无采购订单</p>
          </div>
        ) : (
          <>
            <PurchaseOrdersDesktopTable
              orders={orders}
              onEditContainer={setEditingContainerOrder}
              onEditShipping={setEditingOrder}
            />
            <PurchaseOrdersMobileCards orders={orders} />
          </>
        )}
      </div>

      {editingContainerOrder && (
        <PurchaseOrderContainerNumberEditDialog
          order={editingContainerOrder}
          open={Boolean(editingContainerOrder)}
          onOpenChange={open => {
            if (!open) {
              setEditingContainerOrder(null);
            }
          }}
          onSuccess={() => {
            setEditingContainerOrder(null);
          }}
        />
      )}

      {editingOrder && (
        <PurchaseOrderShippingCompanyEditDialog
          order={editingOrder}
          open={Boolean(editingOrder)}
          onOpenChange={open => {
            if (!open) {
              setEditingOrder(null);
            }
          }}
          onSuccess={() => {
            setEditingOrder(null);
          }}
        />
      )}

      {onPageChange && total > 0 && !isInitialLoading && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={{
              page,
              limit,
              total,
              totalPages,
            }}
            onPageChange={onPageChange}
            showRange
            showTotal
            disabled={isListRefreshing}
          />
        </div>
      )}
    </div>
  );
}

function PurchaseOrdersDesktopTable({
  orders,
  onEditContainer,
  onEditShipping,
}: {
  orders: PurchaseOrder[];
  onEditContainer: (order: EditingContainerOrder) => void;
  onEditShipping: (order: EditingShippingOrder) => void;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>订单号</TableHead>
            <TableHead>供应商</TableHead>
            <TableHead>集装箱号</TableHead>
            <TableHead>船运公司</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">产品总额</TableHead>
            <TableHead className="text-right">费用总额</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map(order => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-1">
                  <Link
                    href={`/purchase-orders/${order.id}`}
                    className="text-[hsl(var(--color-primary))] hover:underline"
                    title={`查看采购订单 ${order.orderNumber}`}
                  >
                    {order.orderNumber}
                  </Link>
                  <CopyButton text={order.orderNumber} iconSize="sm" />
                </span>
              </TableCell>
              <TableCell>
                {formatPurchaseOrderSuppliers(order.items || [])}
              </TableCell>
              <TableCell>
                <EditableTextButton
                  value={order.containerNumber}
                  emptyText="点击输入"
                  titleText="点击输入集装箱号"
                  onClick={() =>
                    onEditContainer({
                      id: order.id,
                      orderNumber: order.orderNumber,
                      containerNumber: order.containerNumber ?? null,
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <EditableTextButton
                  value={order.shippingCompany}
                  emptyText="点击输入"
                  titleText="点击输入船运公司"
                  onClick={() =>
                    onEditShipping({
                      id: order.id,
                      orderNumber: order.orderNumber,
                      shippingCompany: order.shippingCompany ?? null,
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <PurchaseOrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(order.totalAmount)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(order.expenseAmount)}
              </TableCell>
              <TableCell>
                <RelativeTime date={order.createdAt} />
              </TableCell>
              <TableCell>
                <div className="flex justify-center gap-2">
                  <Link href={`/purchase-orders/${order.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  {order.status === PURCHASE_ORDER_STATUS.DRAFT && (
                    <Link href={`/purchase-orders/${order.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PurchaseOrdersMobileCards({ orders }: { orders: PurchaseOrder[] }) {
  return (
    <div className="space-y-3 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 md:hidden">
      {orders.map(order => {
        const handleCardClick = () => {
          window.location.href = `/purchase-orders/${order.id}`;
        };

        return (
          <div
            key={order.id}
            className="cursor-pointer rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm"
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
                  供应商：{formatPurchaseOrderSuppliers(order.items || [])}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  集装箱：{order.containerNumber || '未填写'}
                </div>
                <div className="mt-0.5 text-xs font-bold text-slate-500">
                  船运公司：{order.shippingCompany || '未填写'}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                <div className="font-semibold text-[hsl(var(--color-success))]">
                  产品：{formatCurrency(order.totalAmount)}
                </div>
                <div className="mt-0.5">
                  费用：{formatCurrency(order.expenseAmount)}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
              <div className="flex items-center gap-2">
                <PurchaseOrderStatusBadge status={order.status} />
                <span className="text-slate-400">
                  创建：
                  <RelativeTime date={order.createdAt} />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-bold"
                  onClick={event => {
                    event.stopPropagation();
                    handleCardClick();
                  }}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  查看
                </Button>
                {order.status === PURCHASE_ORDER_STATUS.DRAFT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-bold"
                    onClick={event => {
                      event.stopPropagation();
                      window.location.href = `/purchase-orders/${order.id}/edit`;
                    }}
                  >
                    <Edit className="mr-1 h-3.5 w-3.5" />
                    编辑
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditableTextButton({
  value,
  emptyText,
  titleText,
  onClick,
}: {
  value?: string | null;
  emptyText: string;
  titleText: string;
  onClick: () => void;
}) {
  const hasValue = Boolean(value?.trim());

  return (
    <button
      type="button"
      className="inline-flex max-w-[180px] items-center gap-1 text-left text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-primary))]"
      onClick={onClick}
      title={hasValue ? value ?? undefined : titleText}
    >
      <span
        className={cn(
          'truncate',
          !hasValue && 'text-[hsl(var(--color-text-tertiary))]'
        )}
      >
        {hasValue ? value : emptyText}
      </span>
      <Edit className="h-3 w-3 flex-shrink-0 opacity-60" />
    </button>
  );
}

function PurchaseOrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status as PurchaseOrderStatus]}>
      {PURCHASE_ORDER_STATUS_LABELS[status as PurchaseOrderStatus]}
    </Badge>
  );
}

function PurchaseOrderListSkeleton() {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                '订单号',
                '供应商',
                '集装箱号',
                '船运公司',
                '状态',
                '产品总额',
                '费用总额',
                '创建时间',
                '操作',
              ].map(header => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <TableRow key={`purchase-order-skeleton-row-${rowIndex}`}>
                {Array.from({ length: 9 }).map((__, colIndex) => (
                  <TableCell key={`purchase-order-skeleton-cell-${colIndex}`}>
                    <Skeleton
                      className={cn(
                        'h-4',
                        colIndex === 0 && 'w-28',
                        colIndex === 1 && 'w-36',
                        colIndex === 4 && 'h-6 w-16',
                        colIndex > 1 && colIndex !== 4 && 'w-24'
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`purchase-order-mobile-skeleton-${index}`}
            className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Skeleton className="h-6 w-16" />
              <div className="flex gap-1">
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-7 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
