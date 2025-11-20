'use client';

import {
  ArrowRight,
  BadgeJapaneseYen,
  Clock,
  Package,
  User,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SALES_ORDER_STATUS_LABELS,
  type SalesOrderStatus,
} from '@/lib/config/sales-order';
import type { DashboardSalesOrderSummary } from '@/lib/types/dashboard';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';

interface RecentOrdersProps {
  orders: DashboardSalesOrderSummary[];
  loading?: boolean;
}

// 状态样式配置 - 使用统一的中文标签
const statusVariants: Record<
  SalesOrderStatus,
  'secondary' | 'warning' | 'info' | 'purple' | 'success' | 'destructive'
> = {
  draft: 'secondary',
  confirmed: 'info',
  shipped: 'purple',
  completed: 'success',
  cancelled: 'destructive',
};

// 格式化时间
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  if (hours < 24) {
    return `${hours}小时前`;
  }
  if (days < 7) {
    return `${days}天前`;
  }

  return formatDate(dateString);
};

export function RecentOrders({ orders, loading }: RecentOrdersProps) {
  if (loading) {
    return <RecentOrdersSkeleton />;
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>实时订单动态</CardTitle>
          <CardDescription>最近创建的销售订单</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Package className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-sm">暂无订单数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>实时订单动态</CardTitle>
          <CardDescription>最近创建的销售订单</CardDescription>
        </div>
        <Link
          href="/sales-orders"
          className="group text-primary hover:text-primary/80 flex items-center gap-1 text-sm font-medium transition-colors"
        >
          查看全部
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map(order => {
          const statusLabel =
            SALES_ORDER_STATUS_LABELS[order.status as SalesOrderStatus] ||
            order.status;
          const statusVariant =
            statusVariants[order.status as SalesOrderStatus] || 'secondary';

          return (
            <Link
              key={order.id}
              href={`/sales-orders/${order.id}`}
              className="group block"
            >
              <div className="bg-card hover:bg-muted/50 flex items-start gap-4 rounded-lg border p-3 transition-all">
                <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Package className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-card-foreground group-hover:text-primary font-semibold transition-colors">
                        {order.orderNumber}
                      </p>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                        <User className="h-3 w-3" />
                        <span>{order.customer?.name || '未知客户'}</span>
                      </div>
                    </div>
                    <Badge
                      variant={statusVariant}
                      className="shrink-0 text-xs font-medium"
                    >
                      {statusLabel}
                    </Badge>
                  </div>

                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <BadgeJapaneseYen className="h-3 w-3" />
                      <span className="text-foreground font-medium">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(order.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

// 骨架屏组件
function RecentOrdersSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-lg border p-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-5 w-1/5" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
