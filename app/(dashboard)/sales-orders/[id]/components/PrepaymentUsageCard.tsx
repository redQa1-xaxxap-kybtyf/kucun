'use client';

import { ArrowRight, PiggyBank } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

import type { SalesOrderDetail } from './types';

function formatPaymentMethod(method: string | null | undefined): string {
  switch (method) {
    case 'cash':
      return '现金';
    case 'wechat_transfer':
      return '微信转账';
    case 'abc_qr':
      return '农行码';
    case 'icbc_qr':
      return '工行码';
    case 'ccb_qr':
      return '建行码';
    case 'cib_qr':
      return '兴业码';
    case 'bank_transfer':
      return '银行转账';
    case 'alipay':
      return '支付宝';
    case 'wechat':
      return '微信支付';
    case 'check':
      return '支票';
    default:
      return '其他';
  }
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  pending: { label: '待确认', variant: 'secondary' },
  confirmed: { label: '已确认', variant: 'default' },
  applied: { label: '已冲抵', variant: 'default' },
  cancelled: { label: '已取消', variant: 'outline' },
};

export function PrepaymentUsageCard({ order }: { order: SalesOrderDetail }) {
  const usages = order.prepaymentUsages ?? [];
  const totalApplied = order.prepaymentTotalApplied ?? 0;

  if (!usages.length || totalApplied <= 0) {
    // 没有预收款冲抵记录时不展示该卡片
    return null;
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-slate-900">
              <PiggyBank className="h-4 w-4 text-amber-600" />
              预收款冲抵记录
            </CardTitle>
            <p className="text-[11px] font-medium text-slate-500">
              追溯本笔业务所消耗的客户账户预存资金。
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex rounded-lg px-2.5 py-1 font-black">
            合计抵扣：{formatCurrency(totalApplied)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 py-6">
        <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 text-[11px] font-bold text-amber-700 flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">i</div>
          <span>当前订单已执行 {usages.length} 笔预收款对冲，金额已从往来账户余额中扣除。</span>
        </div>

        <div className="space-y-4">
          {usages.map(usage => {
            const statusConfig =
              STATUS_BADGE[usage.paymentStatus] ?? STATUS_BADGE.confirmed;

            return (
              <div
                key={usage.id}
                className="group relative flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-5 transition-all hover:bg-slate-50/50 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge 
                      variant={statusConfig.variant}
                      className="rounded-lg px-2 py-0.5 font-bold"
                    >
                      {statusConfig.label}
                    </Badge>
                    <span className="font-mono text-sm font-bold text-slate-700">
                      {usage.paymentNumber}
                    </span>
                    <div className="h-3 w-px bg-slate-200" />
                    <span className="text-xs font-bold text-slate-500">
                      {formatPaymentMethod(usage.paymentMethod)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-[10px] font-medium text-slate-400">
                    <p>原始收款时间：{formatDateTime(usage.paymentDate)}</p>
                    <p>冲抵生效时间：{formatDateTime(usage.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0 sm:gap-2">
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-tighter text-slate-400">Current Deduction</p>
                    <p className="font-mono text-lg font-black tracking-tighter text-emerald-600">
                      -{formatCurrency(usage.appliedAmount)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 rounded-lg px-3 text-xs font-black text-blue-600 hover:bg-blue-50"
                  >
                    <Link href={`/finance/payments/${usage.paymentRecordId}`}>
                      溯源记录
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
