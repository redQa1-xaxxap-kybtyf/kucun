'use client';

import {
  ArrowRight,
  Clock,
  DollarSign,
  Package,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ContentLoading } from '@/components/common/loading';
import type { DashboardSalesOrderSummary } from '@/lib/types/dashboard';

interface RecentOrdersProps {
  orders: DashboardSalesOrderSummary[];
  loading?: boolean;
}

// 状态配置
const statusConfig = {
  draft: {
    label: '草稿',
    variant: 'secondary' as const,
  },
  confirmed: {
    label: '已确认',
    variant: 'info' as const,
  },
  shipped: {
    label: '已发货',
    variant: 'purple' as const,
  },
  completed: {
    label: '已完成',
    variant: 'success' as const,
  },
  cancelled: {
    label: '已取消',
    variant: 'destructive' as const,
  },
};

// 格式化货币
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount);
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

export function RecentOrders({ orders, loading }: RecentOrdersProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-light)]">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-primary-light))] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                  实时订单动态
                </h3>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  最近创建的销售订单
                </p>
              </div>
            </div>
            <Badge variant="info" className="text-xs font-medium">
              实时更新
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          <ContentLoading text="加载订单中..." />
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-light)]">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-primary-light))] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                  实时订单动态
                </h3>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  最近创建的销售订单
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-[hsl(var(--color-border-secondary))]" />
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
            暂无订单数据
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-light)] transition-shadow hover:shadow-[var(--shadow-medium)]">
      <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-primary-light))] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                实时订单动态
              </h3>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                最近创建的销售订单
              </p>
            </div>
          </div>
          <Link
            href="/sales-orders"
            className="group flex items-center gap-1 text-sm font-medium text-[hsl(var(--color-primary))] transition-colors hover:text-[hsl(var(--color-primary-hover))]"
          >
            查看全部
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {orders.map(order => {
          const statusInfo =
            statusConfig[order.status] ??
            ({
              label: order.status,
              variant: 'secondary',
            } as const);

          return (
            <Link key={order.id} href={`/sales-orders/${order.id}`} className="group block">
              <div className="flex items-start gap-4 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-4 transition-all hover:border-[hsl(var(--color-primary))] hover:shadow-[var(--shadow-light)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-medium)] transition-transform group-hover:scale-110">
                  <Package className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[hsl(var(--color-text-primary))] transition-colors group-hover:text-[hsl(var(--color-primary))]">
                        {order.orderNumber}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                        <User className="h-3.5 w-3.5" />
                        <span>{order.customer?.name || '未知客户'}</span>
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant} className="shrink-0 text-xs font-medium">
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-[hsl(var(--color-text-secondary))]">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="font-medium text-[hsl(var(--color-text-primary))]">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[hsl(var(--color-text-tertiary))]">
                      <Clock className="h-3.5 w-3.5" />
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
