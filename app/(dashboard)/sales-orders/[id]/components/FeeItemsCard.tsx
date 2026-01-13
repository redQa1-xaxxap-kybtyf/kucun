'use client';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FEE_PAID_BY_LABELS } from '@/lib/types/sales-order-fee';
import { formatCurrency } from '@/lib/utils';

import type { SalesOrderDetail } from './types';

export function FeeItemsCard({
  order,
  productSubtotal,
}: {
  order: SalesOrderDetail;
  productSubtotal: number;
}) {
  const feeItems = order.feeItems || [];
  if (feeItems.length === 0) return null;

  const customerPaidTotal = feeItems
    .filter(fee => fee.paidBy === 'customer')
    .reduce((sum, fee) => sum + (fee.feeAmount || 0), 0);
  const companyPaidTotal = feeItems
    .filter(fee => fee.paidBy === 'company')
    .reduce((sum, fee) => sum + (fee.feeAmount || 0), 0);

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <CardTitle className="flex items-center justify-between text-sm font-black uppercase tracking-widest text-slate-900">
          <div className="flex items-center">
            <ChineseYuan className="mr-2.5 h-4 w-4 text-blue-600" />
            业务附加费用明细
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            RECORDED {feeItems.length} ITEMS
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-white p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-md">
              <tr className="text-xs font-semibold text-slate-500">
                <th className="px-4 py-3 text-center font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">费项类别</th>
                <th className="px-4 py-3 text-left font-medium">内容说明</th>
                <th className="px-4 py-3 text-right font-medium">核算金额</th>
                <th className="px-4 py-3 text-center font-medium">支出方</th>
                <th className="px-4 py-3 text-left font-medium">业务备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {feeItems.map((fee, index) => (
                <tr
                  key={fee.id}
                  className="group transition-colors hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs font-medium text-slate-400">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {fee.feeType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold text-slate-900">
                      {fee.feeName}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono">
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(fee.feeAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        fee.paidBy === 'company'
                          ? 'bg-amber-100/50 text-amber-600 ring-1 ring-amber-600/10'
                          : 'bg-emerald-100/50 text-emerald-600 ring-1 ring-emerald-600/10'
                      }`}
                    >
                      {FEE_PAID_BY_LABELS[fee.paidBy] ?? '客户承担'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-400">
                      {fee.remarks || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/50">
              <tr className="font-bold">
                <td
                  colSpan={4}
                  className="px-4 py-4 text-right text-slate-500"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">客户承担小计</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-sm font-black text-slate-900">
                    {formatCurrency(customerPaidTotal)}
                  </span>
                </td>
                <td className="px-4 py-3"></td>
              </tr>
              <tr className="border-t border-slate-100 font-bold">
                <td
                  colSpan={4}
                  className="px-4 py-4 text-right text-slate-500"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">公司承担小计</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-sm font-semibold text-slate-500">
                    {formatCurrency(companyPaidTotal)}
                  </span>
                </td>
                <td className="px-4 py-3"></td>
              </tr>
              <tr className="border-t border-slate-200 bg-slate-100/20 font-black">
                <td
                  colSpan={4}
                  className="px-4 py-5 text-right text-slate-900"
                >
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest">业务应收总额</span>
                    <span className="text-[10px] font-medium text-slate-400">
                      (PROD {formatCurrency(productSubtotal)} + FEES{' '}
                      {formatCurrency(order.additionalFees)})
                    </span>
                  </div>
                </td>
                <td className="px-4 py-5 text-right">
                  <span className="font-mono text-xl font-black text-blue-600">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </td>
                <td className="px-4 py-5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
