'use client';

import { ShoppingCart } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    SALES_ORDER_STATUS_LABELS,
    TRANSFER_MODE_LABELS,
} from '@/lib/types/sales-order';
import { getSalesOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { formatDateTime } from '@/lib/utils/datetime';

import type { SalesOrderDetail } from './types';

export function BasicInfoCard({ order }: { order: SalesOrderDetail }) {
  const customerName = order.customer?.name ?? '未关联客户';
  const customerPhone = order.customer?.phone ?? '-';
  const userName = order.user?.name ?? '-';

  const getOrderTypeBadge = (orderType: string) =>
    orderType === 'TRANSFER' ? (
      <Badge variant="secondary">调货销售</Badge>
    ) : (
      <Badge variant="outline">正常销售</Badge>
    );
  const getTransferModeBadge = (mode: string | undefined) => {
    const label =
      mode === 'MIXED'
        ? TRANSFER_MODE_LABELS.MIXED
        : TRANSFER_MODE_LABELS.SUPPLIER_ONLY;
    return mode === 'MIXED' ? (
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-50 text-sky-700"
      >
        {label}
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700"
      >
        {label}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <CardTitle className="flex items-center text-sm font-black uppercase tracking-widest text-slate-900">
          <ShoppingCart className="mr-2.5 h-4 w-4 text-blue-600" />
          订单业务档案
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-4">
          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">客户联系名称</div>
            <div className="text-sm font-black text-slate-900">{customerName}</div>
          </div>
          
          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">联系电话</div>
            <div className="text-sm font-semibold text-slate-600 font-mono">{customerPhone}</div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">当前订单状态</div>
            <div className="flex items-center gap-2 pt-0.5">
              <Badge 
                variant={getSalesOrderStatusBadgeVariant(order.status)}
                className="rounded-lg px-2 py-0.5 font-bold uppercase tracking-tighter"
              >
                {SALES_ORDER_STATUS_LABELS[order.status as keyof typeof SALES_ORDER_STATUS_LABELS] || order.status}
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">业务类型标签</div>
            <div className="flex flex-col gap-1.5">
              {order.orderType === 'TRANSFER' ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 font-bold w-fit">协同调货</Badge>
              ) : (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-bold w-fit">正常零售</Badge>
              )}
              {order.orderType === 'TRANSFER' && order.transferMode && (
                <div className="scale-90 origin-left">
                  {getTransferModeBadge(order.transferMode)}
                </div>
              )}
            </div>
          </div>

          {order.supplier && (
            <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">关联收货/代发端</div>
              <div className="text-sm font-semibold text-slate-700">{order.supplier.name}</div>
            </div>
          )}

          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">档案创建人</div>
            <div className="text-sm font-medium text-slate-600">{userName}</div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">单据签署日期</div>
            <div className="text-sm font-mono text-slate-600">{formatDateTime(order.createdAt)}</div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-100/50 hover:shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">最后更新档案</div>
            <div className="text-sm font-mono text-slate-400">{formatDateTime(order.updatedAt)}</div>
          </div>
        </div>

        {order.remarks && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">业务补充备注</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">{order.remarks}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
