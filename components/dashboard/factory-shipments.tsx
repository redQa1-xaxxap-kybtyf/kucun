// 仪表盘 - 厂家发货订单组件
// 显示最近的厂家发货订单

'use client';

import { ArrowRight, Clock, Package, Truck, User } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';
import { cn } from '@/lib/utils';

interface FactoryShipmentsProps {
  orders: FactoryShipmentOrder[];
  loading?: boolean;
}

// 状态配置
const statusConfig = {
  draft: {
    label: '草稿',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  planning: {
    label: '计划中',
    variant: 'default' as const,
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  waiting_deposit: {
    label: '待定金',
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  deposit_paid: {
    label: '已付定金',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  factory_shipped: {
    label: '工厂发货',
    variant: 'default' as const,
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  in_transit: {
    label: '运输中',
    variant: 'default' as const,
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  arrived: {
    label: '到港',
    variant: 'default' as const,
    className: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  delivered: {
    label: '已收货',
    variant: 'default' as const,
    className: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  completed: {
    label: '已完成',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-700 border-green-200',
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
const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div
        key={i}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    ))}
  </div>
);

export function FactoryShipments({ orders, loading }: FactoryShipmentsProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/30">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                厂家发货订单
              </h3>
              <p className="text-sm text-gray-600">最近的发货订单</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/30">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                厂家发货订单
              </h3>
              <p className="text-sm text-gray-600">最近的发货订单</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="mb-4 h-12 w-12 text-gray-400" />
          <p className="text-sm text-gray-500">暂无厂家发货订单</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50 transition-all hover:shadow-xl hover:shadow-gray-200/60">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/30">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              厂家发货订单
            </h3>
            <p className="text-sm text-gray-600">最近的发货订单</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {orders.map(order => {
            const config =
              statusConfig[order.status as keyof typeof statusConfig] ||
              statusConfig.draft;

            return (
              <Link
                key={order.id}
                href={`/factory-shipments/${order.id}`}
                className="group block"
              >
                <div className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50/50 p-4 transition-all hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/50">
                  {/* 图标 */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30">
                    <Truck className="h-5 w-5 text-white" />
                  </div>

                  {/* 订单信息 */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* 订单号和状态 */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-900">
                        {order.orderNumber}
                      </span>
                      <Badge className={cn('shrink-0', config.className)}>
                        {FACTORY_SHIPMENT_STATUS_LABELS[order.status]}
                      </Badge>
                    </div>

                    {/* 客户和金额 */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate">
                          {order.customer?.name || '未知客户'}
                        </span>
                      </div>
                      <div className="shrink-0 font-medium text-emerald-600">
                        {formatCurrency(order.totalAmount)}
                      </div>
                    </div>

                    {/* 时间 */}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(order.createdAt.toString())}</span>
                    </div>
                  </div>

                  {/* 箭头 */}
                  <div className="flex shrink-0 items-center">
                    <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-600" />
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
              className="group text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
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
