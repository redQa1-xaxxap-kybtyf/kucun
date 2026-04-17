'use client';

import { ArrowLeft, Download, FileText, Receipt } from 'lucide-react';
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
  settled: { label: '已结清', variant: 'secondary' },
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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-xl">
      {/* 装饰背景 - 调淡 */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />

      <CardContent className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5 sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-500/10">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
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
                        : '（结清）'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.back()}
              className="h-12 border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <Button
              variant="outline"
              size="lg"
              className="h-12 border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            >
              <Download className="mr-2 h-4 w-4" />
              导出对账单
            </Button>
            <Button className="h-12 bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 hover:bg-blue-700 active:scale-95">
              <Receipt className="mr-2 h-4 w-4" />
              结清处理
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
