'use client';

import { ShoppingCart } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/datetime';

import type { SalesOrderDetail } from './types';

export function OperationHistoryCard({
  order,
  userName,
}: {
  order: SalesOrderDetail;
  userName: string;
}) {
  return (
    <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
          <ShoppingCart className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
          操作历史
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[hsl(var(--color-primary))]"></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                订单创建
              </div>
              <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                {formatDateTime(order.createdAt)}
              </div>
              <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                创建人：{userName}
              </div>
            </div>
          </div>
          {order.updatedAt !== order.createdAt && (
            <div className="flex items-start gap-3">
              <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[hsl(var(--color-success))]"></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  订单更新
                </div>
                <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
                  {formatDateTime(order.updatedAt)}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
