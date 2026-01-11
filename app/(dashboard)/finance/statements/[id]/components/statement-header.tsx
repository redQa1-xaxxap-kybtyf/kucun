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
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--color-border-primary))] bg-slate-900 shadow-2xl">
      {/* 装饰背景 */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      <CardContent className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5 sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  往来明细账
                </h1>
                <Badge className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30">
                  {TYPE_LABEL_MAP[type]}
                </Badge>
                <Badge
                  variant={statusInfo.variant}
                  className={
                    statusInfo.variant === 'outline'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : ''
                  }
                >
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400">
                <span className="text-lg font-bold text-slate-200">{name}</span>
                <span className="h-4 w-px bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-1.5 text-sm">
                  <span>当前账面余额：</span>
                  <span
                    className={`font-black tracking-wider ${
                      currentBalance > 0
                        ? 'text-orange-400'
                        : currentBalance < 0
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(Math.abs(currentBalance))}
                    {currentBalance > 0
                      ? '（应收）'
                      : currentBalance < 0
                        ? '（应付）'
                        : '（持平）'}
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
              className="h-12 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <div className="h-8 w-px bg-slate-700 hidden sm:block" />
            <Button
              variant="outline"
              size="lg"
              className="h-12 border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              导出明细账
            </Button>
            <Button
              className="h-12 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 transition-all hover:scale-105 hover:shadow-blue-500/30 active:scale-95"
            >
              <Receipt className="mr-2 h-4 w-4" />
              核销操作
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
