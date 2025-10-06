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
import { Skeleton } from '@/components/ui/skeleton';
import type { SalesOrder } from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';

interface RecentOrdersProps {
  orders: SalesOrder[];
  loading?: boolean;
}

// 状态配置
const statusConfig = {
  draft: {
    label: '草稿',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  confirmed: {
    label: '已确认',
    variant: 'default' as const,
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  shipped: {
    label: '已发货',
    variant: 'default' as const,
    className: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  completed: {
    label: '已完成',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  cancelled: {
    label: '已取消',
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-700 border-red-200',
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

// 加载骨架屏
const OrderSkeleton = () => (
  <div className="flex items-start gap-4 rounded-lg border bg-gradient-to-br from-white to-gray-50/50 p-4">
    <Skeleton className="h-12 w-12 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
    <Skeleton className="h-6 w-20" />
  </div>
);

export function RecentOrders({ orders, loading }: RecentOrdersProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden border-gray-200 shadow-lg shadow-gray-200/50">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  实时订单动态
                </h3>
                <p className="text-sm text-gray-600">最近创建的销售订单</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              实时更新
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {[...Array(5)].map((_, i) => (
            <OrderSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="overflow-hidden border-gray-200 shadow-lg shadow-gray-200/50">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  实时订单动态
                </h3>
                <p className="text-sm text-gray-600">最近创建的销售订单</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-500">暂无订单数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-gray-200 shadow-lg shadow-gray-200/50 transition-shadow hover:shadow-xl hover:shadow-gray-200/60">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                实时订单动态
              </h3>
              <p className="text-sm text-gray-600">最近创建的销售订单</p>
            </div>
          </div>
          <Link
            href="/sales-orders"
            className="group flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            查看全部
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {orders.map(order => {
          const statusInfo = statusConfig[order.status];

          return (
            <Link
              key={order.id}
              href={`/sales-orders/${order.id}`}
              className="group block"
            >
              <div className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50/50 p-4 transition-all hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50">
                {/* 订单图标 */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110">
                  <Package className="h-6 w-6 text-white" />
                </div>

                {/* 订单信息 */}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
                        {order.orderNumber}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                        <User className="h-3.5 w-3.5" />
                        <span>{order.customer?.name || '未知客户'}</span>
                      </div>
                    </div>
                    <Badge
                      variant={statusInfo.variant}
                      className={cn('shrink-0', statusInfo.className)}
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="font-medium text-gray-900">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
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
