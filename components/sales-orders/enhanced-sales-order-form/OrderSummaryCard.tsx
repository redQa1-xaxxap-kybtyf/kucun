'use client';

import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrderSummaryCardProps {
  totalAmount: number;
  itemCount: number;
  totalQuantity: number;
  stockWarningCount: number;
}

export function OrderSummaryCard({
  totalAmount,
  itemCount,
  totalQuantity,
  stockWarningCount,
}: OrderSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">订单汇总</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-primary/20 from-primary/10 to-primary/5 rounded-lg border bg-linear-to-r p-4">
          <div className="space-y-2 text-center">
            <div className="text-muted-foreground text-sm">订单总金额</div>
            <div className="text-primary text-3xl font-bold">
              ￥
              {totalAmount.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-muted-foreground mb-1">产品种类</div>
            <div className="text-xl font-semibold text-[hsl(var(--color-primary))]">
              {itemCount}
            </div>
            <div className="text-muted-foreground text-xs">种</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-muted-foreground mb-1">总数量</div>
            <div className="text-xl font-semibold text-green-600">
              {totalQuantity}
            </div>
            <div className="text-muted-foreground text-xs">件</div>
          </div>
        </div>

        {stockWarningCount > 0 && (
          <Alert variant="destructive" className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              ⚠️ 存在 {stockWarningCount} 个产品库存不足，请检查库存
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
