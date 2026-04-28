'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import {
  getSalesOrderReceivableTotal,
  shouldCreateReceivableForOrder,
} from '@/lib/utils/sample-order';

import type { SalesOrderDetail } from './types';

interface Props {
  order: SalesOrderDetail;
  totalDisplayQuantity: number;
  totalLocalQuantity: number;
  totalTransferQuantity: number;
  productSubtotal: number;
  transferSalesAmount: number;
  pureTransferProfit: number;
}

export function AmountSummaryCards({
  order,
  totalDisplayQuantity: _totalDisplayQuantity,
  totalLocalQuantity: _totalLocalQuantity,
  totalTransferQuantity: _totalTransferQuantity,
  productSubtotal: _productSubtotal,
  transferSalesAmount,
  pureTransferProfit,
}: Props) {
  const customerFees = Number(order.additionalFees ?? 0);
  const companyFees = Number(order.expenseAmount ?? 0);
  const receivableEnabled = shouldCreateReceivableForOrder(order);
  const receivableTotal = getSalesOrderReceivableTotal(order);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      <Card className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="text-[10px] font-bold text-slate-500">订单总金额</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900">
            {formatCurrency(order.totalAmount)}
          </div>
        </CardContent>
      </Card>

      {order.roundingAdjustment !== 0 && (
        <Card className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-[10px] font-bold text-slate-500">订单抹零</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-amber-600">
              -{formatCurrency(Math.abs(order.roundingAdjustment))}
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400">
              {order.roundingAdjustment > 0 ? '加价调整' : '减价调整'}
            </div>
          </CardContent>
        </Card>
      )}

      {order.paymentRounding !== 0 && (
        <Card className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-[10px] font-bold text-slate-500">抹零金额</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-indigo-600">
              {order.paymentRounding > 0 ? '+' : '-'}
              {formatCurrency(Math.abs(order.paymentRounding))}
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400">
              {order.paymentRounding > 0 ? '少收/优惠' : '多收'}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="text-[10px] font-bold text-slate-500">已收金额</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-600">
            {formatCurrency(order.actualPaidAmount)}
          </div>
          <div className="mt-1 text-[10px] font-medium text-slate-400">
            确认到账{' '}
            {order.paymentRecords.filter(r => r.status === 'confirmed').length}{' '}
            笔
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="text-[10px] font-bold text-slate-500">待收金额</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-rose-600">
            {formatCurrency(receivableEnabled ? order.remainingAmount : 0)}
          </div>
          <div className="mt-1 text-[10px] font-medium text-slate-400">
            {!receivableEnabled
              ? '免费样品不挂应收'
              : receivableTotal > 0 && order.remainingAmount > 0
                ? '待收款'
                : '结清'}
          </div>
        </CardContent>
      </Card>

      {customerFees > 0 && (
        <Card className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-[10px] font-bold text-slate-500">代垫费用</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-700">
              {formatCurrency(customerFees)}
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400">
              计入订单收入
            </div>
          </CardContent>
        </Card>
      )}

      {companyFees > 0 && (
        <Card className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-[10px] font-bold text-slate-500">
              经营成本项
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-800">
              {formatCurrency(companyFees)}
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400">
              不计入订单总额
            </div>
          </CardContent>
        </Card>
      )}

      {order.orderType === 'TRANSFER' && (
        <Card className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-[10px] font-bold text-slate-500">调货毛利</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-sky-600">
              {formatCurrency(pureTransferProfit)}
            </div>
            <div className="mt-1 text-[10px] font-bold text-sky-600/80">
              利率{' '}
              {transferSalesAmount > 0
                ? ((pureTransferProfit / transferSalesAmount) * 100).toFixed(1)
                : '0.0'}
              %
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
