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
    <div className="border-border/60 bg-card/40 flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="font-medium">
            {payment.paymentNumber} ·{' '}
            {formatPaymentMethod(payment.paymentMethod)}
          </span>
        </div>
        <div className="text-muted-foreground text-sm">
          收款时间：
          {payment.paymentDate ? formatDateTime(payment.paymentDate) : '—'}
        </div>
        {payment.remarks && (
          <div className="text-muted-foreground text-sm">
            备注：{payment.remarks}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-xl font-semibold text-emerald-600">
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
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-5 shadow-inner">
      <div className="flex flex-wrap justify-between gap-6">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">应收金额</p>
          <p className="text-3xl font-bold text-blue-700">
            {formatCurrency(receivableTotal)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">已收金额</p>
          <p className="text-2xl font-semibold text-emerald-600">
            {formatCurrency(Number(order.paidAmount))}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">收款进度</p>
          <p className="text-2xl font-semibold">{progress.toFixed(0)}%</p>
        </div>
      </div>

      {order.roundingAdjustment && order.roundingAdjustment !== 0 && (
        <p className="mt-3 text-sm text-blue-600">
          已含整单调整：{formatCurrency(Number(order.roundingAdjustment))}
        </p>
      )}

      {pendingTotal > 0 && (
        <p className="mt-2 text-sm text-amber-600">
          当前仍有待确认收款：{formatCurrency(pendingTotal)}
        </p>
      )}
    </div>
  );
}

export function PaymentsCard({ order }: { order: SalesOrderDetail }) {
  const hasPayments = order.paymentRecords.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            收款记录
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            展示所有关联到该销售订单的收款记录，帮助你跟进收款进度。
          </p>
        </div>
        <Badge variant="outline">
          总计：{formatCurrency(Number(order.paidAmount))}
        </Badge>
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
