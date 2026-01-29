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
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <CardTitle className="flex items-center text-sm font-black tracking-widest text-slate-900 uppercase">
          <ShoppingCart className="mr-2.5 h-4 w-4 text-blue-600" />
          全链路操作日志
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-white p-6">
        <div className="relative space-y-8 before:absolute before:top-1 before:left-[7px] before:h-[calc(100%-8px)] before:w-0.5 before:bg-slate-100">
          <div className="relative flex items-start gap-4 pl-6">
            <div className="absolute left-0 mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-sm ring-1 ring-blue-600/20"></div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                业务初始创建
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                订单创建成功
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
                <span className="font-medium">操作人：{userName}</span>
                <span className="h-2.5 w-px bg-slate-200" />
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
            </div>
          </div>
          {order.updatedAt !== order.createdAt && (
            <div className="relative flex items-start gap-4 pl-6">
              <div className="absolute left-0 mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-sm ring-1 ring-emerald-500/20"></div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  系统状态变更
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  关键业务字段更新
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="font-medium">自动化审计</span>
                  <span className="h-2.5 w-px bg-slate-200" />
                  <span>{formatDateTime(order.updatedAt)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
