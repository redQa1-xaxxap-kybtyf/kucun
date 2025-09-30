'use client';

import { DollarSign } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatementFinancialSummaryProps {
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

/**
 * 账单财务汇总卡片组件
 */
export function StatementFinancialSummary({
  totalOrders,
  totalAmount,
  paidAmount,
  pendingAmount,
  overdueAmount,
}: StatementFinancialSummaryProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          财务汇总
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">总订单数</span>
          <span className="font-medium">{totalOrders} 个</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">总金额</span>
          <span className="font-medium">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">已付金额</span>
          <span className="font-medium text-green-600">
            {formatCurrency(paidAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">待付金额</span>
          <span className="font-medium text-orange-600">
            {formatCurrency(pendingAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">逾期金额</span>
          <span className="font-medium text-red-600">
            {formatCurrency(overdueAmount)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
