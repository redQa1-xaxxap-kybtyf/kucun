'use client';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

import type { SalesOrderDetail } from './types';

export function FeeItemsCard({
  order,
  productSubtotal,
}: {
  order: SalesOrderDetail;
  productSubtotal: number;
}) {
  if (!order.feeItems || order.feeItems.length === 0) return null;
  return (
    <Card
      className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="flex items-center justify-between text-base text-[hsl(var(--color-text-primary))]">
          <div className="flex items-center">
            <ChineseYuan className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
            额外费用明细
          </div>
          <span className="text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
            共 {order.feeItems.length} 项
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
              <tr className="text-xs font-semibold text-[hsl(var(--color-text-secondary))]">
                <th className="px-4 py-3 text-center font-medium">序号</th>
                <th className="px-4 py-3 text-left font-medium">费用类型</th>
                <th className="px-4 py-3 text-left font-medium">费用名称</th>
                <th className="px-4 py-3 text-right font-medium">费用金额</th>
                <th className="px-4 py-3 text-left font-medium">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--color-border-secondary))]">
              {order.feeItems.map((fee, index) => (
                <tr
                  key={fee.id}
                  className="transition-colors hover:bg-[hsl(var(--color-bg-secondary))]/50"
                >
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-md border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] px-2 py-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                      {fee.feeType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      {fee.feeName}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-bold text-[hsl(var(--color-primary))]">
                      {formatCurrency(fee.feeAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
                      {fee.remarks || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] font-semibold">
                <td
                  colSpan={3}
                  className="px-4 py-3 text-right text-[hsl(var(--color-text-primary))]"
                >
                  <span className="text-sm">额外费用小计</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-bold text-[hsl(var(--color-text-primary))]">
                    {formatCurrency(order.additionalFees)}
                  </span>
                </td>
                <td className="px-4 py-3"></td>
              </tr>
              <tr className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] font-bold">
                <td
                  colSpan={3}
                  className="px-4 py-4 text-right text-[hsl(var(--color-text-primary))]"
                >
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-base">订单总金额</span>
                    <span className="text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
                      (产品 {formatCurrency(productSubtotal)} + 费用{' '}
                      {formatCurrency(order.additionalFees)})
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-lg font-bold text-[hsl(var(--color-primary))]">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </td>
                <td className="px-4 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
