"use client";

import { Receipt, DollarSign } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/datetime";

import type { PaymentRecord, SalesOrderDetail } from "./types";

function PaymentMethodText({ method }: { method: string }) {
  return (
    <>
      {method === "cash"
        ? "💵 现金"
        : method === "bank_transfer"
          ? "🏦 银行转账"
          : method === "alipay"
            ? "🔵 支付宝"
            : method === "wechat"
              ? "💚 微信支付"
              : method === "check"
                ? "📝 支票"
                : "📌 其他"}
    </>
  );
}

function PaymentsSummary({ order }: { order: SalesOrderDetail }) {
  const shouldShowAdjusted = order.roundingAdjustment !== 0;
  const receivableTotal = order.totalAmount + order.roundingAdjustment;
  const progress = receivableTotal > 0 ? (order.paidAmount / receivableTotal) * 100 : 0;
  const pendingTotal = order.paymentRecords
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + Number(r.paymentAmount), 0);

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">订单总金额</span>
          </div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(order.totalAmount)}</div>
        </div>
        {shouldShowAdjusted && (
          <div className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2">
            <span className="text-xs font-medium text-gray-600">
              订单抹零
              <span className="ml-1 text-[10px] text-gray-500">{order.roundingAdjustment > 0 ? "(加价)" : "(减价)"}</span>
            </span>
            <div className="text-sm font-bold text-orange-600">-{formatCurrency(Math.abs(order.roundingAdjustment))}</div>
          </div>
        )}
        {shouldShowAdjusted && (
          <div className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2">
            <span className="text-xs font-semibold text-gray-700">实际应收</span>
            <div className="text-lg font-bold text-purple-600">{formatCurrency(receivableTotal)}</div>
          </div>
        )}
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">收款进度</span>
          <span className="text-xs fontBold text-green-600">{progress.toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-white/60 p-2 text-center">
          <div className="text-xs text-gray-600">已确认</div>
          <div className="mt-1 text-sm font-bold text-green-600">{formatCurrency(order.paidAmount)}</div>
          <div className="text-[10px] text-gray-500">{order.paymentRecords.filter(r => r.status === "confirmed").length} 笔</div>
        </div>
        <div className="rounded-md bg-white/60 p-2 text-center">
          <div className="text-xs text-gray-600">待确认</div>
          <div className="mt-1 text-sm font-bold text-yellow-600">{formatCurrency(pendingTotal)}</div>
          <div className="text-[10px] text-gray-500">{order.paymentRecords.filter(r => r.status === "pending").length} 笔</div>
        </div>
        <div className="rounded-md bg-white/60 p-2 text-center">
          <div className="text-xs text-gray-600">待收款</div>
          <div className="mt-1 text-sm font-bold text-orange-600">{formatCurrency(order.remainingAmount)}</div>
          <div className="text-[10px] text-gray-500">{order.remainingAmount > 0 ? "未完成" : "已完成"}</div>
        </div>
      </div>
    </div>
  );
}

function PaymentRecordItem({ record, index, variant }: { record: PaymentRecord; index: number; variant: "pending" | "confirmed" }) {
  const theme = variant === "confirmed"
    ? {
        border: "border-green-200",
        stripe: "from-green-500 to-emerald-500",
        bg: "from-green-50 to-white",
        labelClass: "border-green-400 bg-green-100 text-green-700",
        remarkBorder: "border-green-400",
        titleClass: "text-green-700",
        roundingText: "text-green-700",
        divider: "border-green-100",
        statusText: "✓ 已确认",
        prefix: "已确认第 ",
      }
    : {
        border: "border-yellow-200",
        stripe: "from-yellow-400 to-yellow-500",
        bg: "from-yellow-50 to-white",
        labelClass: "border-yellow-400 bg-yellow-100 text-yellow-700",
        remarkBorder: "border-yellow-400",
        titleClass: "text-yellow-700",
        roundingText: "text-yellow-700",
        divider: "border-yellow-100",
        statusText: "⏱ 待确认",
        prefix: "待确认第 ",
      };

  return (
    <div className={`group relative overflow-hidden rounded-lg border ${theme.border} bg-gradient-to-br ${theme.bg} p-5 shadow-sm transition-all hover:shadow-md`}>
      <div className={`absolute top-0 left-0 h-full w-1 bg-gradient-to-b ${theme.stripe}`}></div>
      <div className="mb-4 flex items-start justify-between pl-4">
        <div className="flex-1">
          <div className={`mb-1 text-xs font-medium ${theme.titleClass}`}>{theme.prefix}{index + 1} 笔</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(record.paymentAmount)}</div>
          {record.roundingAmount !== 0 && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white/80 px-3 py-1.5 text-xs">
              <span className="text-gray-600">实际到账</span>
              <span className="font-semibold text-gray-900">{formatCurrency(record.actualPaymentAmount)}</span>
              <span className="text-gray-400">+</span>
              <span className="text-gray-600">收款差额</span>
              <span className={`font-semibold ${theme.roundingText}`}>{formatCurrency(record.roundingAmount)}</span>
            </div>
          )}
        </div>
        <Badge className={`ml-3 ${theme.labelClass} shadow-sm`}>{theme.statusText}</Badge>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 pl-4">
        <div className="rounded-lg bg-white/80 p-3">
          <div className="mb-1 text-xs font-medium text-gray-500">收款日期</div>
          <div className="text-sm font-semibold text-gray-900">{formatDateTime(record.paymentDate)}</div>
        </div>
        <div className="rounded-lg bg-white/80 p-3">
          <div className="mb-1 text-xs font-medium text-gray-500">支付方式</div>
          <div className="text-sm font-semibold text-gray-900">
            <PaymentMethodText method={record.paymentMethod} />
          </div>
        </div>
      </div>
      {(record.paymentNumber || record.remarks) && (
        <div className={`space-y-2 border-t ${theme.divider} pt-3 pl-4`}>
          {record.paymentNumber && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-500">单号</span>
              <code className="rounded bg-white px-2 py-1 font-mono text-gray-700 shadow-sm">{record.paymentNumber}</code>
            </div>
          )}
          {record.remarks && (
            <div className={`rounded-lg border-l-4 ${theme.remarkBorder} bg-white/80 px-3 py-2 text-xs`}>
              <span className="font-semibold text-gray-600">备注：</span>
              <span className="text-gray-700">{record.remarks}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentsList({ order }: { order: SalesOrderDetail }) {
  const pending = order.paymentRecords.filter(r => r.status === "pending");
  const confirmed = order.paymentRecords.filter(r => r.status === "confirmed");

  if (order.paymentRecords.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[hsl(var(--color-text-tertiary))]">暂无收款记录</div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-yellow-200"></div>
            <span className="text-xs font-semibold text-yellow-700">⏱ 待确认收款</span>
            <div className="h-px flex-1 bg-yellow-200"></div>
          </div>
          <div className="space-y-2">
            {pending.map((record, idx) => (
              <PaymentRecordItem key={record.id} record={record} index={idx} variant="pending" />
            ))}
          </div>
        </div>
      )}

      {confirmed.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-green-200"></div>
            <span className="text-xs font-semibold text-green-700">✓ 已确认收款</span>
            <div className="h-px flex-1 bg-green-200"></div>
          </div>
          <div className="space-y-2">
            {confirmed.map((record, idx) => (
              <PaymentRecordItem key={record.id} record={record} index={idx} variant="confirmed" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PaymentsCard({ order }: { order: SalesOrderDetail }) {
  return (
    <Card className="overflow-hidden border border-[hsl(var(--color-border-primary))]" style={{ boxShadow: "var(--shadow-medium)" }}>
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="flex items-center justify-between text-base text-[hsl(var(--color-text-primary))]">
          <div className="flex items-center">
            <Receipt className="mr-2 h-4 w-4 text-[hsl(var(--color-success))]" />
            收款记录
          </div>
          <span className="text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
            {order.paymentRecords.filter(r => r.status === "confirmed").length} / {order.paymentRecords.length} 笔
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
        <PaymentsSummary order={order} />
        <PaymentsList order={order} />
      </CardContent>
    </Card>
  );
}
