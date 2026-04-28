'use client';

import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
interface StatementHeaderProps {
  name: string;
  type: 'customer' | 'supplier' | 'partner';
  status: 'active' | 'settled' | 'suspended';
  currentBalance: number;
}

const TYPE_LABEL_MAP: Record<StatementHeaderProps['type'], string> = {
  customer: '客户',
  supplier: '供应商',
  partner: '往来伙伴',
};

const STATUS_BADGE_MAP: Record<
  StatementHeaderProps['status'],
  { label: string; variant: 'outline' | 'secondary' | 'destructive' }
> = {
  active: { label: '正常', variant: 'outline' },
  settled: { label: '无余额', variant: 'secondary' },
  suspended: { label: '已暂停', variant: 'destructive' },
};

export function StatementHeader({
  name,
  type,
  status,
  currentBalance,
}: StatementHeaderProps) {
  const router = useRouter();

  const statusInfo = STATUS_BADGE_MAP[status] ?? STATUS_BADGE_MAP.active;

  return (
    <div className="rounded-lg border bg-white">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))]">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  往来对账明细
                </h1>
                <Badge className="border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100">
                  {TYPE_LABEL_MAP[type]}
                </Badge>
                <Badge
                  variant={statusInfo.variant}
                  className={
                    statusInfo.variant === 'outline'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                      : ''
                  }
                >
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500">
                <span className="text-lg font-bold text-slate-800">{name}</span>
                <span className="hidden h-4 w-px bg-slate-200 sm:block" />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-medium">账面余额：</span>
                  <span
                    className={`font-semibold ${
                      currentBalance > 0
                        ? 'text-orange-600'
                        : currentBalance < 0
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                    }`}
                  >
                    {formatCurrency(Math.abs(currentBalance))}
                    {currentBalance > 0
                      ? '（应收）'
                      : currentBalance < 0
                        ? '（应付）'
                        : '（无余额）'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="h-10 rounded-lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <Button variant="outline" className="h-10 rounded-lg">
              <Download className="mr-2 h-4 w-4" />
              导出对账单
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
