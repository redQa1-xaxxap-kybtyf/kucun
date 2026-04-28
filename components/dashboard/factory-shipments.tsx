// 仪表盘 - 厂家发货订单组件
// 显示最近的厂家发货订单

'use client';

import { ArrowRight, Clock, Truck, User } from 'lucide-react';
import Link from 'next/link';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardFactoryShipmentSummary } from '@/lib/types/dashboard';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';

interface FactoryShipmentsProps {
  orders: DashboardFactoryShipmentSummary[];
  loading?: boolean;
}

// 状态配置
const STATUS_VARIANT_MAP: Record<FactoryShipmentStatus, BadgeProps['variant']> =
  {
    draft: 'outline',
    confirmed: 'success',
    pending_shipment: 'warning',
    shipped: 'info',
    in_transit: 'info',
    arrived: 'success',
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

export function FactoryShipments({ orders, loading }: FactoryShipmentsProps) {
  if (loading) {
    return <FactoryShipmentsSkeleton />;
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>厂家发货订单</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Truck className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-sm">暂无厂家发货订单</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>厂家发货订单</CardTitle>
        </div>
        <Link
          href="/factory-shipments"
          className="group text-primary hover:text-primary/80 flex items-center gap-1 text-sm font-medium transition-colors"
        >
          查看全部
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map(order => {
          const badgeVariant = STATUS_VARIANT_MAP[order.status] ?? 'secondary';
          return (
            <Link
              key={order.id}
              href={`/factory-shipments/${order.id}`}
              className="group block"
            >
              <div className="bg-card hover:bg-muted/50 flex items-start gap-4 rounded-lg border p-3 transition-all">
                <div className="bg-success text-success-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-card-foreground group-hover:text-primary truncate font-semibold">
                      {order.orderNumber}
                    </span>
                    <Badge
                      variant={badgeVariant}
                      className="shrink-0 text-xs font-medium"
                    >
                      {FACTORY_SHIPMENT_STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span className="truncate">
                        {order.customer?.name || '未知客户'}
                      </span>
                    </div>
                    <span className="text-success font-semibold">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(order.createdAt)}</span>
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
function FactoryShipmentsSkeleton() {
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
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-lg border p-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-5 w-1/5" />
              </div>
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
