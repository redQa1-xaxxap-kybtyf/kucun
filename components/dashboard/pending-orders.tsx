'use client';

import {
  AlertCircle,
  ArrowRight,
  BadgeJapaneseYen,
  Clock,
  Eye,
  Package,
  User,
} from 'lucide-react';
import Link from 'next/link';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { SalesOrder } from '@/lib/types/sales-order';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface PendingOrdersProps {
  orders: SalesOrder[];
  loading?: boolean;
}

// 计算订单天数
const getDaysOld = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / 86400000);
};

// 判断是否紧急
const isUrgent = (dateString: string) => getDaysOld(dateString) > 3;

export function PendingOrders({ orders, loading }: PendingOrdersProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)]">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-warning-light))] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-warning))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                  待处理订单
                </h3>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  需要及时处理的订单
                </p>
              </div>
            </div>
            <Badge variant="warning" className="text-xs font-medium">
              待处理
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          <ContentLoading text="加载待处理订单..." />
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)]">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-warning-light))] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-warning))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                待处理订单
              </h3>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                需要及时处理的订单
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-[hsl(var(--color-border-secondary))]" />
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
            暂无待处理订单
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--color-text-tertiary))]">
            所有订单都已处理完成
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-warning-light))] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--color-warning))] text-[hsl(var(--color-text-on-primary))] shadow-sm">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                待处理订单
              </h3>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                需要及时处理的订单
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="warning" className="text-xs font-medium">
              {orders.length} 个待处理
            </Badge>
            <Link
              href="/sales-orders?status=draft"
              className="group flex items-center gap-1 text-sm font-medium text-[hsl(var(--color-warning))] transition-colors hover:text-[hsl(var(--color-warning-hover))]"
            >
              查看全部
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {orders.map(order => {
          const urgent = isUrgent(order.createdAt);
          const daysOld = getDaysOld(order.createdAt);

          const containerClasses = urgent
            ? 'group flex items-center gap-4 rounded-md border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] p-4 hover:border-[hsl(var(--color-error))] hover:bg-[hsl(var(--color-error-light))]'
            : 'group flex items-center gap-4 rounded-md border border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] p-4 hover:border-[hsl(var(--color-warning))] hover:bg-[hsl(var(--color-warning-light))]';

          const iconClasses = urgent
            ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--color-error))] text-[hsl(var(--color-text-on-primary))] shadow-sm'
            : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--color-warning))] text-[hsl(var(--color-text-on-primary))] shadow-sm';

          const orderLinkHover = urgent
            ? 'hover:text-[hsl(var(--color-error))]'
            : 'hover:text-[hsl(var(--color-warning))]';

          const timeTextClass = urgent
            ? 'flex items-center gap-1.5 text-[hsl(var(--color-error))]'
            : 'flex items-center gap-1.5 text-[hsl(var(--color-text-tertiary))]';

          const buttonClasses = urgent
            ? 'border-[hsl(var(--color-error))] text-[hsl(var(--color-error))] hover:bg-[hsl(var(--color-error-light))]'
            : 'border-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))] hover:bg-[hsl(var(--color-warning-light))]';

          return (
            <div key={order.id} className={containerClasses}>
              {/* 订单图标 */}
              <div className={iconClasses}>
                <Package className="h-6 w-6" />
              </div>

              {/* 订单信息 */}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sales-orders/${order.id}`}
                        className={`font-semibold text-[hsl(var(--color-text-primary))] transition-colors ${orderLinkHover}`}
                      >
                        {order.orderNumber}
                      </Link>
                      <Badge
                        variant={urgent ? 'destructive' : 'warning'}
                        className="text-xs font-medium"
                      >
                        <AlertCircle className="mr-1 h-3 w-3" />
                        {urgent ? '紧急' : '跟进'}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                      <User className="h-3.5 w-3.5" />
                      <span>{order.customer?.name || '未知客户'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-[hsl(var(--color-text-secondary))]">
                    <BadgeJapaneseYen className="h-3.5 w-3.5" />
                    <span className="font-medium text-[hsl(var(--color-text-primary))]">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                  <div className={timeTextClass}>
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {formatDateTime(order.createdAt)}
                      {daysOld > 0 && ` (${daysOld}天前)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <Link href={`/sales-orders/${order.id}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className={`transition-all ${buttonClasses}`}
                >
                  <Eye className="mr-1.5 h-4 w-4" />
                  查看
                </Button>
              </Link>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
