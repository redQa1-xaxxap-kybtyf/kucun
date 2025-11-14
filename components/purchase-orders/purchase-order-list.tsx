'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, Eye } from 'lucide-react';
import Link from 'next/link';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatDateTime } from '@/lib/utils/datetime';
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
}: PurchaseOrderListProps) {
  const queryParams: PurchaseOrderListParams = {
    page,
    limit,
    containerNumber: search,
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
  });

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

  if (orders.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg border p-12 text-center">
        <p className="text-muted-foreground">暂无采购订单</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead>集装箱号</TableHead>
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
                  {order.orderNumber}
                </TableCell>
                <TableCell>
                  {formatPurchaseOrderSuppliers(order.items || [])}
                </TableCell>
                <TableCell>{order.containerNumber || '-'}</TableCell>
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
                <TableCell>{formatDateTime(order.createdAt)}</TableCell>
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

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          共 {total} 条记录，第 {page} 页
        </p>
      </div>
    </div>
  );
}
