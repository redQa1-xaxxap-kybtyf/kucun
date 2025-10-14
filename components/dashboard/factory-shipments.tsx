// 仪表盘 - 厂家发货订单组件
// 显示最近的厂家发货订单

'use client';

import { ArrowRight, Clock, Package, Truck, User } from 'lucide-react';
import Link from 'next/link';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ContentLoading } from '@/components/common/loading';
import { formatCurrency } from '@/lib/utils';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import type { DashboardFactoryShipmentSummary } from '@/lib/types/dashboard';

interface FactoryShipmentsProps {
  orders: DashboardFactoryShipmentSummary[];
  loading?: boolean;
}

// 状态配置
const STATUS_VARIANT_MAP: Record<FactoryShipmentStatus, BadgeProps['variant']> =
  {
    draft: 'secondary',
    planning: 'info',
    waiting_deposit: 'warning',
    deposit_paid: 'success',
    factory_shipped: 'info',
    in_transit: 'info',
    arrived: 'purple',
    delivered: 'success',
    completed: 'success',
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

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
};

export function FactoryShipments({ orders, loading }: FactoryShipmentsProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)]">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-success-light))] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-success))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                厂家发货订单
              </h3>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                最近的发货订单
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <ContentLoading text="加载发货订单..." />
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)]">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-success-light))] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-success))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                厂家发货订单
              </h3>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                最近的发货订单
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="mb-4 h-12 w-12 text-[hsl(var(--color-border-secondary))]" />
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
            暂无厂家发货订单
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--color-text-tertiary))]">
            所有发货均已完成
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)] transition-shadow hover:shadow-[var(--shadow-medium)]">
      <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-success-light))] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-success))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
              厂家发货订单
            </h3>
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
              最近的发货订单
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {orders.map(order => {
            const badgeVariant =
              STATUS_VARIANT_MAP[order.status] ?? 'secondary';

            return (
              <Link
                key={order.id}
                href={`/factory-shipments/${order.id}`}
                className="group block"
              >
                <div className="flex items-start gap-4 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-4 transition-all hover:border-[hsl(var(--color-success))] hover:shadow-[var(--shadow-light)]">
                  {/* 图标 */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-success))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
                    <Truck className="h-5 w-5" />
                  </div>

                  {/* 订单信息 */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* 订单号和状态 */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-[hsl(var(--color-text-primary))]">
                        {order.orderNumber}
                      </span>
                      <Badge
                        variant={badgeVariant}
                        className="shrink-0 text-xs font-medium"
                      >
                        {FACTORY_SHIPMENT_STATUS_LABELS[order.status]}
                      </Badge>
                    </div>

                    {/* 客户和金额 */}
                    <div className="flex items-center gap-4 text-sm text-[hsl(var(--color-text-secondary))]">
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate">
                          {order.customer?.name || '未知客户'}
                        </span>
                      </div>
                      <div className="shrink-0 font-medium text-[hsl(var(--color-success))]">
                        {formatCurrency(order.totalAmount)}
                      </div>
                    </div>

                    {/* 时间 */}
                    <div className="flex items-center gap-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(order.createdAt)}</span>
                    </div>
                  </div>

                  {/* 箭头 */}
                  <div className="flex shrink-0 items-center">
                    <ArrowRight className="h-4 w-4 text-[hsl(var(--color-text-tertiary))] transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--color-success))]" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 查看全部 */}
        <div className="mt-4 text-center">
          <Link href="/factory-shipments">
            <Button
              variant="ghost"
              size="sm"
              className="group text-[hsl(var(--color-success))] hover:bg-[hsl(var(--color-success-light))] hover:text-[hsl(var(--color-success-hover))]"
            >
              查看全部发货订单
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
