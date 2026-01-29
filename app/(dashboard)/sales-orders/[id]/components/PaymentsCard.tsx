'use client';

import { Receipt, Wallet } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

import type { PaymentRecord, SalesOrderDetail } from './types';

const STATUS_MAP = {
  confirmed: { label: '已确认', variant: 'default' as const },
  pending: { label: '待确认', variant: 'secondary' as const },
  cancelled: { label: '已取消', variant: 'outline' as const },
};

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
    default:
      return '其他';
  }
}

function PaymentItem({ payment }: { payment: PaymentRecord }) {
  const status =
    STATUS_MAP[payment.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending;

  return (
    <div className="group flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-5 transition-all hover:bg-slate-50/50 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={status.variant}
            className="rounded-lg px-2 py-0.5 font-bold"
          >
            {status.label}
          </Badge>
          <span className="font-mono text-sm font-bold text-slate-700">
            {payment.paymentNumber}
          </span>
          <div className="h-3 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-500">
            {formatPaymentMethod(payment.paymentMethod)}
          </span>
        </div>
        <div className="text-[10px] font-medium text-slate-400">
          账务确认时间：
          {payment.paymentDate ? formatDateTime(payment.paymentDate) : '—'}
        </div>
        {payment.remarks && (
          <div className="text-[10px] text-slate-400 italic">
            备注：{payment.remarks}
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
        <div className="font-mono text-xl font-black text-emerald-600">
          +{formatCurrency(Number(payment.paymentAmount))}
        </div>
      </div>
    </div>
  );
}

function PaymentsSummary({ order }: { order: SalesOrderDetail }) {
  const receivableTotal =
    Number(order.totalAmount) + Number(order.roundingAdjustment ?? 0);
  const progress =
    receivableTotal > 0
      ? (Number(order.paidAmount) / receivableTotal) * 100
      : 0;
  const pendingTotal = order.paymentRecords
    .filter(record => record.status === 'pending')
    .reduce((sum, record) => sum + Number(record.paymentAmount), 0);

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              业务应收总计
            </p>
            <p className="font-mono text-xl font-black tracking-tighter text-slate-900 sm:text-2xl">
              {formatCurrency(receivableTotal)}
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              账务结算
            </p>
            <p className="text-xl font-black text-slate-900">
              {progress.toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              已核销金额
            </p>
            <p className="font-mono text-lg font-black tracking-tighter text-emerald-600">
              {formatCurrency(Number(order.paidAmount))}
            </p>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {(order.roundingAdjustment !== 0 || pendingTotal > 0) && (
        <div className="mt-6 flex flex-col gap-2.5 border-t border-slate-200 pt-5">
          {order.roundingAdjustment && order.roundingAdjustment !== 0 && (
            <div className="flex items-start gap-2 text-[11px] font-medium text-blue-600">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-500" />
              <span>
                整单金额调整 (抹零项目)：
                {formatCurrency(Number(order.roundingAdjustment))}
              </span>
            </div>
          )}
          {pendingTotal > 0 && (
            <div className="flex items-start gap-2 text-[11px] font-medium text-amber-600">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              <span>当前存在审核中收款：{formatCurrency(pendingTotal)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentsCard({ order }: { order: SalesOrderDetail }) {
  const hasPayments = order.paymentRecords.length > 0;

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-black tracking-widest text-slate-900 uppercase">
              <Receipt className="h-4 w-4 text-blue-600" />
              收款往来明细
            </CardTitle>
            <p className="text-[11px] font-medium text-slate-500">
              跟进订单生命周期内的所有现金及转账核销记录。
            </p>
          </div>
          <Badge
            variant="secondary"
            className="hidden rounded-lg px-2.5 py-1 font-black sm:inline-flex"
          >
            合计：{formatCurrency(Number(order.paidAmount))}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <PaymentsSummary order={order} />

        {!hasPayments ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-slate-50 py-12 text-center text-sm">
            <Wallet className="mb-2 h-10 w-10 text-blue-500" />
            暂无收款记录，可前往财务模块补录。
          </div>
        ) : (
          <div className="space-y-4">
            {order.paymentRecords.map(payment => (
              <PaymentItem key={payment.id} payment={payment} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
