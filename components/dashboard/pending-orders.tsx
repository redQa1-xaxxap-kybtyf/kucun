'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  DollarSign,
  Eye,
  Package,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ContentLoading } from '@/components/common/loading';
import { cn } from '@/lib/utils';
import type { SalesOrder } from '@/lib/types/sales-order';

interface PendingOrdersProps {
  orders: SalesOrder[];
  loading?: boolean;
}

// 格式化货币
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount);
};

// 计算订单天数
const getDaysOld = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / 86400000);
};

// 判断是否紧急
const isUrgent = (dateString: string) => {
  return getDaysOld(dateString) > 3;
};

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function PendingOrders({ orders, loading }: PendingOrdersProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden border-gray-200 shadow-lg shadow-gray-200/50">
        <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 shadow-lg shadow-amber-600/30">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  待处理订单
                </h3>
                <p className="text-sm text-gray-600">需要及时处理的订单</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
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
      <Card className="overflow-hidden border-gray-200 shadow-lg shadow-gray-200/50">
        <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 shadow-lg shadow-amber-600/30">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  待处理订单
                </h3>
                <p className="text-sm text-gray-600">需要及时处理的订单</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-500">暂无待处理订单</p>
          <p className="mt-1 text-sm text-gray-400">所有订单都已处理完成</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-gray-200 shadow-lg shadow-gray-200/50 transition-shadow hover:shadow-xl hover:shadow-gray-200/60">
      <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 shadow-lg shadow-amber-600/30">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                待处理订单
              </h3>
              <p className="text-sm text-gray-600">需要及时处理的订单</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              {orders.length} 个待处理
            </Badge>
            <Link
              href="/sales-orders?status=draft"
              className="group flex items-center gap-1 text-sm font-medium text-amber-600 transition-colors hover:text-amber-700"
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

          return (
            <div
              key={order.id}
              className={cn(
                'group flex items-center gap-4 rounded-lg border p-4 transition-all',
                urgent
                  ? 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50/50 hover:border-red-300 hover:shadow-md hover:shadow-red-100/50'
                  : 'border-gray-200 bg-gradient-to-br from-white to-gray-50/50 hover:border-amber-300 hover:shadow-md hover:shadow-amber-100/50'
              )}
            >
              {/* 订单图标 */}
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg transition-transform group-hover:scale-110',
                  urgent
                    ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30'
                    : 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30'
                )}
              >
                <Package className="h-6 w-6 text-white" />
              </div>

              {/* 订单信息 */}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sales-orders/${order.id}`}
                        className="font-semibold text-gray-900 transition-colors hover:text-amber-600"
                      >
                        {order.orderNumber}
                      </Link>
                      {urgent && (
                        <Badge
                          variant="destructive"
                          className="border-red-200 bg-red-100 text-red-700"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          紧急
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                      <User className="h-3.5 w-3.5" />
                      <span>{order.customer?.name || '未知客户'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="font-medium text-gray-900">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1.5',
                      urgent ? 'text-red-600' : 'text-gray-500'
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(order.createdAt)}
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
                  className={cn(
                    'transition-all',
                    urgent
                      ? 'border-red-300 text-red-700 hover:bg-red-50'
                      : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  )}
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
