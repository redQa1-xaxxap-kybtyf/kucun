'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, Eye } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CopyButton } from '@/components/common/copy-button';
import { ContentLoading } from '@/components/common/loading';
import { RelativeTime } from '@/components/common/relative-time';
import { PurchaseOrderContainerNumberEditDialog } from '@/components/purchase-orders/purchase-order-container-number-edit-dialog';
import { PurchaseOrderShippingCompanyEditDialog } from '@/components/purchase-orders/purchase-order-shipping-company-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '-';
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    // 通用搜索：订单号 / 集装箱号
    search,
    status,
    supplierId,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, error } = useQuery<{
    data: PurchaseOrder[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: purchaseOrderQueryKeys.list(queryParams),
    queryFn: () => getPurchaseOrders(queryParams),
    // ⚠️ 特例：采购订单列表在路由返回或新建订单后必须立即拿到最新数据
    // 全局默认把 refetchOnMount 设为 false，这里强制为 'always'，避免用户看到旧缓存
    refetchOnMount: 'always',
  });

  const [editingContainerOrder, setEditingContainerOrder] = React.useState<Pick<
    PurchaseOrder,
    'id' | 'orderNumber' | 'containerNumber'
  > | null>(null);
  const [editingOrder, setEditingOrder] = React.useState<Pick<
    PurchaseOrder,
    'id' | 'orderNumber' | 'shippingCompany'
  > | null>(null);

  if (isLoading) {
    return <ContentLoading text="加载采购订单列表中..." />;
  }

  if (error) {
    return (
      <div className="border-destructive bg-destructive/10 rounded-lg border p-6 text-center">
        <p className="text-destructive">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </p>
      </div>
    );
  }

  const orders = (data as { data: PurchaseOrder[]; total: number })?.data || [];
  const total = (data as { data: PurchaseOrder[]; total: number })?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (orders.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg border p-12 text-center">
        <p className="text-muted-foreground">暂无采购订单</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 桌面端：表格视图，支持横向滚动 */}
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
            {orders.map((order: PurchaseOrder) => (
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
                  <button
                    type="button"
                    className="inline-flex max-w-[180px] items-center gap-1 text-left text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-primary))]"
                    onClick={() =>
                      setEditingContainerOrder({
                        id: order.id,
                        orderNumber: order.orderNumber,
                        containerNumber: order.containerNumber ?? null,
                      })
                    }
                    title={
                      order.containerNumber && order.containerNumber.trim()
                        ? order.containerNumber
                        : '点击输入集装箱号'
                    }
                  >
                    {order.containerNumber && order.containerNumber.trim() ? (
                      <span className="truncate">{order.containerNumber}</span>
                    ) : (
                      <span className="truncate text-[hsl(var(--color-text-tertiary))]">
                        点击输入
                      </span>
                    )}
                    <Edit className="h-3 w-3 flex-shrink-0 opacity-60" />
                  </button>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="inline-flex max-w-[180px] items-center gap-1 text-left text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-primary))]"
                    onClick={() =>
                      setEditingOrder({
                        id: order.id,
                        orderNumber: order.orderNumber,
                        shippingCompany: order.shippingCompany,
                      })
                    }
                    title={
                      order.shippingCompany && order.shippingCompany.trim()
                        ? order.shippingCompany
                        : '点击输入船运公司'
                    }
                  >
                    {order.shippingCompany && order.shippingCompany.trim() ? (
                      <span className="truncate">{order.shippingCompany}</span>
                    ) : (
                      <span className="truncate text-[hsl(var(--color-text-tertiary))]">
                        点击输入
                      </span>
                    )}
                    <Edit className="h-3 w-3 flex-shrink-0 opacity-60" />
                  </button>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      STATUS_VARIANTS[order.status as PurchaseOrderStatus]
                    }
                  >
                    {
                      PURCHASE_ORDER_STATUS_LABELS[
                        order.status as PurchaseOrderStatus
                      ]
                    }
                  </Badge>
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

      {/* 移动端：卡片视图 */}
      <div className="space-y-3 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 md:hidden">
        {orders.map(order => {
          const handleCardClick = () => {
            window.location.href = `/purchase-orders/${order.id}`;
          };

          return (
            <div
              key={order.id}
              className="card-shadow-light cursor-pointer rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3"
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
                  <div className="mt-0.5 text-[10px] text-[hsl(var(--color-text-tertiary))]">
                    集装箱：{order.containerNumber || '未填写'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[hsl(var(--color-text-tertiary))]">
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

              <div className="mt-2 flex items-center justify-between text-[11px] text-[hsl(var(--color-text-secondary))]">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      STATUS_VARIANTS[order.status as PurchaseOrderStatus]
                    }
                    className="text-[10px]"
                  >
                    {
                      PURCHASE_ORDER_STATUS_LABELS[
                        order.status as PurchaseOrderStatus
                      ]
                    }
                  </Badge>
                  <span className="text-[hsl(var(--color-text-tertiary))]">
                    创建：
                    <RelativeTime date={order.createdAt} />
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={event => {
                      event.stopPropagation();
                      handleCardClick();
                    }}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    查看
                  </Button>
                  {order.status === PURCHASE_ORDER_STATUS.DRAFT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={event => {
                        event.stopPropagation();
                        window.location.href = `/purchase-orders/${order.id}/edit`;
                      }}
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      编辑
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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

      {onPageChange && total > 0 && (
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
          />
        </div>
      )}
    </div>
  );
}
