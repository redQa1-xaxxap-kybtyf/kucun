'use client';

import { Receipt, Wallet } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SAMPLE_SETTLEMENT_TYPE_LABELS,
  SAMPLE_ORDER_LABEL,
} from '@/lib/types/sales-order';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';
import {
  getSalesOrderReceivableTotal,
  shouldCreateReceivableForOrder,
} from '@/lib/utils/sample-order';

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
        <div className="font-mono text-xl font-semibold text-emerald-600">
          +{formatCurrency(Number(payment.paymentAmount))}
        </div>
      </div>
    </div>
  );
}

function ReceivableConfirmationNote({
  payment,
  isSettled,
}: {
  payment: PaymentRecord;
  isSettled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              应收已登记
            </span>
            <Badge
              variant="outline"
              className="rounded-lg border-slate-300 bg-white px-2 py-0.5 font-bold text-slate-600"
            >
              系统建账记录
            </Badge>
          </div>
          <p className="text-sm font-medium text-slate-700">
            {payment.paymentNumber}
          </p>
          {isSettled ? (
            <p className="text-[11px] font-medium text-emerald-700">
              订单已收清，这条仅保留作应收建账历史，不代表还有待确认收款。
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              该记录仅用于确认订单应收已建立，不代表客户已付款。
            </p>
          )}
          <p className="text-[10px] text-slate-400">
            登记时间：{payment.paymentDate ? formatDateTime(payment.paymentDate) : '—'}
          </p>
          {payment.remarks && (
            <p className="text-[10px] text-slate-400 italic">
              备注：{payment.remarks}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentsSummary({ order }: { order: SalesOrderDetail }) {
  const receivableEnabled = shouldCreateReceivableForOrder(order);
  const receivableTotal = getSalesOrderReceivableTotal(order);
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
            <p className="text-[10px] font-bold text-slate-500">
              业务应收总计
            </p>
            <p className="font-mono text-xl font-semibold tracking-tighter text-slate-900 sm:text-2xl">
              {formatCurrency(receivableTotal)}
            </p>
            {!receivableEnabled && order.isSampleOrder && (
              <p className="text-[11px] font-medium text-amber-700">
                {
                  SAMPLE_SETTLEMENT_TYPE_LABELS[
                    order.sampleSettlementType ?? 'FREE'
                  ]
                }
                默认不生成客户应收
              </p>
            )}
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[10px] font-bold text-slate-500">
              账务结算
            </p>
            <p className="text-xl font-semibold text-slate-900">
              {progress.toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold text-slate-500">
              已核销金额
            </p>
            <p className="font-mono text-lg font-semibold tracking-tighter text-emerald-600">
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
                整单抹零：
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
  const receivableEnabled = shouldCreateReceivableForOrder(order);

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
              <Receipt className="h-4 w-4 text-blue-600" />
              真实收款与核销明细
            </CardTitle>
            <p className="text-[11px] font-medium text-slate-500">
              {receivableEnabled
                ? '这里只显示实际收款和预收抵扣，应收登记会单独提示。'
                : `${SAMPLE_ORDER_LABEL}当前按免费结算，不会进入客户应收。`}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="hidden rounded-lg px-2.5 py-1 font-semibold sm:inline-flex"
          >
            合计：{formatCurrency(Number(order.paidAmount))}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <PaymentsSummary order={order} />
        {order.receivableConfirmationRecord && (
          <ReceivableConfirmationNote
            payment={order.receivableConfirmationRecord}
            isSettled={Number(order.remainingAmount) <= 0}
          />
        )}

        {!hasPayments ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-slate-50 py-12 text-center text-sm">
            <Wallet className="mb-2 h-10 w-10 text-blue-500" />
            {receivableEnabled
              ? order.receivableConfirmationRecord
                ? '还没有实际收款，目前只登记了应收。'
                : '暂无收款记录，可前往财务模块补录。'
              : '免费样品单默认不生成收款记录。'}
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
