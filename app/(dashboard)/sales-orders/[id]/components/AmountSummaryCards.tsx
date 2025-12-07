'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

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

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
      <Card className="card-shadow-light border border-[hsl(var(--color-border-primary))]">
        <CardContent className="p-3 sm:p-4">
          <div className="text-[11px] font-medium text-[hsl(var(--color-text-tertiary))]">
            订单总金额
          </div>
          <div className="mt-1 text-xl font-bold text-[hsl(var(--color-primary))] sm:mt-2 sm:text-2xl">
            {formatCurrency(order.totalAmount)}
          </div>
        </CardContent>
      </Card>

      {order.roundingAdjustment !== 0 && (
        <Card className="card-shadow-light border border-orange-200 bg-orange-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] font-medium text-gray-600">订单抹零</div>
            <div className="mt-1 text-xl font-bold text-orange-600 sm:mt-2 sm:text-2xl">
              -{formatCurrency(Math.abs(order.roundingAdjustment))}
            </div>
            <div className="mt-1 hidden text-xs text-gray-500 sm:block">
              订单创建时设定{order.roundingAdjustment > 0 ? '(加价)' : '(减价)'}
            </div>
          </CardContent>
        </Card>
      )}

      {order.paymentRounding !== 0 && (
        <Card className="card-shadow-light border border-purple-200 bg-purple-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] font-medium text-gray-600">
              收款差额
            </div>
            <div className="mt-1 text-xl font-bold text-purple-600 sm:mt-2 sm:text-2xl">
              {order.paymentRounding > 0 ? '+' : '-'}
              {formatCurrency(Math.abs(order.paymentRounding))}
            </div>
            <div className="mt-1 hidden text-xs text-gray-500 sm:block">
              {order.paymentRounding > 0 ? '少收/优惠' : '多收'}（四舍五入等）
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-shadow-light border border-green-200 bg-green-50/50">
        <CardContent className="p-3 sm:p-4">
          <div className="text-[11px] font-medium text-gray-600">已收金额</div>
          <div className="mt-1 text-xl font-bold text-green-600 sm:mt-2 sm:text-2xl">
            {formatCurrency(order.actualPaidAmount)}
          </div>
          <div className="mt-1 hidden text-xs text-gray-500 sm:block">
            实际到账{' '}
            {order.paymentRecords.filter(r => r.status === 'confirmed').length}{' '}
            笔
          </div>
        </CardContent>
      </Card>

      <Card className="card-shadow-light border border-orange-200 bg-orange-50/50">
        <CardContent className="p-3 sm:p-4">
          <div className="text-[11px] font-medium text-gray-600">待收金额</div>
          <div className="mt-1 text-xl font-bold text-orange-600 sm:mt-2 sm:text-2xl">
            {formatCurrency(order.remainingAmount)}
          </div>
          <div className="mt-1 hidden text-xs text-gray-500 sm:block">
            {order.remainingAmount > 0 ? '未完成收款' : '已全部收款'}
          </div>
        </CardContent>
      </Card>

      {customerFees > 0 && (
        <Card className="card-shadow-light border border-amber-200 bg-amber-50/60">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] font-medium text-amber-800">
              客户承担费用
            </div>
            <div className="mt-1 text-xl font-bold text-amber-600 sm:mt-2 sm:text-2xl">
              {formatCurrency(customerFees)}
            </div>
            <div className="mt-1 hidden text-[10px] text-amber-700 sm:block">
              计入订单金额 / 收入
            </div>
          </CardContent>
        </Card>
      )}

      {companyFees > 0 && (
        <Card className="card-shadow-light border border-slate-200 bg-slate-50">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] font-medium text-slate-700">
              公司承担费用
            </div>
            <div className="mt-1 text-xl font-bold text-slate-800 sm:mt-2 sm:text-2xl">
              {formatCurrency(companyFees)}
            </div>
            <div className="mt-1 hidden text-[10px] text-slate-600 sm:block">
              计入成本参与利润
            </div>
          </CardContent>
        </Card>
      )}

      {order.orderType === 'TRANSFER' && (
        <Card className="card-shadow-light border border-[hsl(var(--color-border-primary))]">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[11px] font-medium text-[hsl(var(--color-text-tertiary))]">
              调货毛利
            </div>
            <div className="mt-1 text-xl font-bold text-[hsl(var(--color-success))] sm:mt-2 sm:text-2xl">
              {formatCurrency(pureTransferProfit)}
            </div>
            <div className="mt-1 hidden text-xs text-[hsl(var(--color-text-tertiary))] sm:block">
              毛利率：
              {transferSalesAmount > 0
                ? ((pureTransferProfit / transferSalesAmount) * 100).toFixed(1)
                : '0.0'}
              %
            </div>
            {order.transferMode === 'MIXED' && (
              <div className="mt-2 hidden text-[10px] text-amber-600 sm:block">
                注: 仅计算调货部分，不含本地发货收入
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
