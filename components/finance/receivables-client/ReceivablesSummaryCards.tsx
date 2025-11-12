import { AlertCircle, Calendar } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceivablesResult } from '@/lib/services/receivables-service';
import { formatCurrency } from '@/lib/utils';

import { formatCollectionRateChange } from './utils';

type ReceivablesSummaryCardsProps = {
  summary?: ReceivablesResult['summary'];
};

export function ReceivablesSummaryCards({
  summary,
}: ReceivablesSummaryCardsProps) {
  const totalReceivable = summary?.totalReceivable ?? 0;
  const receivableCount = summary?.receivableCount ?? 0;
  const collectionRate = summary?.collectionRate ?? 0;
  const collectionRateChange = summary?.collectionRateChange ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
          <AlertCircle className="h-4 w-4 text-[hsl(var(--color-success))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
            {formatCurrency(totalReceivable)}
          </div>
          <p className="text-muted-foreground text-xs">
            {receivableCount} 个应收订单
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">收款率</CardTitle>
          <Calendar className="h-4 w-4 text-[hsl(var(--color-primary))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
            {collectionRate.toFixed(1)}%
          </div>
          <p className="text-muted-foreground text-xs">
            {formatCollectionRateChange(collectionRateChange)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
