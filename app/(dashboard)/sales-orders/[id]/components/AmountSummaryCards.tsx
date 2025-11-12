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
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6`}>
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <CardContent className="p-4">
          <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
            订单总金额
          </div>
          <div className="mt-2 text-2xl font-bold text-[hsl(var(--color-primary))]">
            {formatCurrency(order.totalAmount)}
          </div>
        </CardContent>
      </Card>

      {order.roundingAdjustment !== 0 && (
        <Card
          className="border border-orange-200 bg-orange-50/50"
          style={{ boxShadow: 'var(--shadow-light)' }}
        >
          <CardContent className="p-4">
            <div className="text-xs font-medium text-gray-600">订单抹零</div>
            <div className="mt-2 text-2xl font-bold text-orange-600">
              -{formatCurrency(Math.abs(order.roundingAdjustment))}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              订单创建时设定{order.roundingAdjustment > 0 ? '(加价)' : '(减价)'}
            </div>
          </CardContent>
        </Card>
      )}

      {order.paymentRounding !== 0 && (
        <Card
          className="border border-purple-200 bg-purple-50/50"
          style={{ boxShadow: 'var(--shadow-light)' }}
        >
          <CardContent className="p-4">
            <div className="text-xs font-medium text-gray-600">收款差额</div>
            <div className="mt-2 text-2xl font-bold text-purple-600">
              {order.paymentRounding > 0 ? '+' : '-'}
              {formatCurrency(Math.abs(order.paymentRounding))}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {order.paymentRounding > 0 ? '少收/优惠' : '多收'}（四舍五入等）
            </div>
          </CardContent>
        </Card>
      )}

      <Card
        className="border border-green-200 bg-green-50/50"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <CardContent className="p-4">
          <div className="text-xs font-medium text-gray-600">已收金额</div>
          <div className="mt-2 text-2xl font-bold text-green-600">
            {formatCurrency(order.actualPaidAmount)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            实际到账{' '}
            {order.paymentRecords.filter(r => r.status === 'confirmed').length}{' '}
            笔
          </div>
        </CardContent>
      </Card>

      <Card
        className="border border-orange-200 bg-orange-50/50"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <CardContent className="p-4">
          <div className="text-xs font-medium text-gray-600">待收金额</div>
          <div className="mt-2 text-2xl font-bold text-orange-600">
            {formatCurrency(order.remainingAmount)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {order.remainingAmount > 0 ? '未完成收款' : '已全部收款'}
          </div>
        </CardContent>
      </Card>

      {customerFees > 0 && (
        <Card
          className="border border-amber-200 bg-amber-50/60"
          style={{ boxShadow: 'var(--shadow-light)' }}
        >
          <CardContent className="p-4">
            <div className="text-xs font-medium text-amber-800">
              客户承担费用
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {formatCurrency(customerFees)}
            </div>
            <div className="mt-1 text-[10px] text-amber-700">
              计入订单金额 / 收入
            </div>
          </CardContent>
        </Card>
      )}

      {companyFees > 0 && (
        <Card
          className="border border-slate-200 bg-slate-50"
          style={{ boxShadow: 'var(--shadow-light)' }}
        >
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-700">
              公司承担费用
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-800">
              {formatCurrency(companyFees)}
            </div>
            <div className="mt-1 text-[10px] text-slate-600">
              计入成本参与利润
            </div>
          </CardContent>
        </Card>
      )}

      {order.orderType === 'TRANSFER' && (
        <Card
          className="border border-[hsl(var(--color-border-primary))]"
          style={{ boxShadow: 'var(--shadow-light)' }}
        >
          <CardContent className="p-4">
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
              调货毛利
            </div>
            <div className="mt-2 text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(pureTransferProfit)}
            </div>
            <div className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
              毛利率：
              {transferSalesAmount > 0
                ? ((pureTransferProfit / transferSalesAmount) * 100).toFixed(1)
                : '0.0'}
              %
            </div>
            {order.transferMode === 'MIXED' && (
              <div className="mt-2 text-[10px] text-amber-600">
                注: 仅计算调货部分，不含本地发货收入
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
