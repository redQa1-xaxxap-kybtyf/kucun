'use client';

import { Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_STATUS_VARIANTS,
  type ReturnOrderStatus,
} from '@/lib/types/return-order';
import { formatDate } from '@/lib/utils/datetime';

import type { SalesOrderDetail } from './types';

export function RelatedReturnOrdersCard({
  order,
}: {
  order: SalesOrderDetail;
}) {
  const router = useRouter();
  const relatedReturnOrders = order.returnOrders ?? [];
  if (relatedReturnOrders.length === 0) return null;

  const isReturnOrderStatus = (value: unknown): value is ReturnOrderStatus =>
    typeof value === 'string' && value in RETURN_ORDER_STATUS_LABELS;

  const getDisplayStatus = (status: ReturnOrderStatus) => {
    if (
      status === 'submitted' ||
      status === 'approved' ||
      status === 'processing'
    ) {
      return {
        label: '待处理',
        variant: 'warning' as const,
      };
    }

    return {
      label: RETURN_ORDER_STATUS_LABELS[status] ?? status,
      variant: RETURN_ORDER_STATUS_VARIANTS[status] ?? 'secondary',
    };
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <CardTitle className="flex items-center text-sm font-semibold text-slate-900">
          <Receipt className="mr-2.5 h-4 w-4 text-rose-500" />
          关联退货单
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-white p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold text-slate-500 backdrop-blur-md">
              <tr>
                <th className="px-4 py-3 text-left font-medium">退货单号</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">创建时间</th>
                <th className="px-4 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {relatedReturnOrders.map(returnOrder => {
                const status = isReturnOrderStatus(returnOrder.status)
                  ? returnOrder.status
                  : 'draft';
                const displayStatus = getDisplayStatus(status);
                return (
                  <tr
                    key={returnOrder.id}
                    className="group transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3.5 font-mono text-sm font-semibold text-rose-600">
                      {returnOrder.returnNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={displayStatus.variant}
                        className="rounded-lg px-2 py-0.5 font-bold tracking-tighter"
                      >
                        {displayStatus.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-400">
                      {formatDate(returnOrder.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg font-semibold text-blue-600 hover:bg-blue-50"
                        onClick={() =>
                          router.push(`/return-orders/${returnOrder.id}`)
                        }
                      >
                        查看详情
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
