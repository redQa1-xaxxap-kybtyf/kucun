'use client';

import { ArrowRight, PiggyBank } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import { formatDateTime } from '@/lib/utils/datetime';

import type { SalesOrderDetail } from './types';

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
    case 'bank_transfer':
      return '银行转账';
    case 'alipay':
      return '支付宝';
    case 'wechat':
      return '微信支付';
    case 'check':
      return '支票';
    default:
      return '其他';
  }
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  pending: { label: '待确认', variant: 'secondary' },
  confirmed: { label: '已确认', variant: 'default' },
  applied: { label: '已冲抵', variant: 'default' },
  cancelled: { label: '已取消', variant: 'outline' },
};

export function PrepaymentUsageCard({ order }: { order: SalesOrderDetail }) {
  const usages = order.prepaymentUsages ?? [];
  const totalApplied = order.prepaymentTotalApplied ?? 0;

  if (!usages.length || totalApplied <= 0) {
    // 没有预收款冲抵记录时不展示该卡片
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-amber-600" />
            预收款抵扣明细
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            展示该订单使用的预收款来源及冲抵金额，便于财务追溯与审计。
          </p>
        </div>
        <Badge variant="outline">
          合计冲抵：{formatCurrency(totalApplied)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-amber-50/80 p-3 text-sm text-amber-800">
          本订单合计使用 {usages.length} 笔预收款，共冲抵{' '}
          <span className="font-semibold">
            {formatCurrency(totalApplied)}
          </span>
          。
        </div>

        <div className="space-y-3">
          {usages.map(usage => {
            const statusConfig =
              STATUS_BADGE[usage.paymentStatus] ?? STATUS_BADGE.confirmed;

            return (
              <div
                key={usage.id}
                className="border-border/60 bg-card/40 flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusConfig.variant}>
                      {statusConfig.label}
                    </Badge>
                    <span className="font-medium">
                      预收款 {usage.paymentNumber} ·{' '}
                      {formatPaymentMethod(usage.paymentMethod)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    收款时间：
                    {formatDateTime(usage.paymentDate)}
                  </p>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    冲抵记录创建时间：
                    {formatDateTime(usage.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">本单冲抵金额</p>
                    <p className="text-lg font-semibold text-emerald-600">
                      -{formatCurrency(usage.appliedAmount)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 text-xs"
                  >
                    <Link href={`/finance/payments/${usage.paymentRecordId}`}>
                      查看预收款
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
