'use client';

import { ArrowLeft, Download, FileText, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                往来账单详情
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                <span className="font-medium">{name}</span>
                <Badge variant="outline">{TYPE_LABEL_MAP[type]}</Badge>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>
              <p className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                当前余额：
                <span
                  className={`font-semibold ${
                    currentBalance > 0
                      ? 'text-[hsl(var(--color-warning))]'
                      : currentBalance < 0
                        ? 'text-[hsl(var(--color-error))]'
                        : 'text-[hsl(var(--color-success))]'
                  }`}
                >
                  {formatCurrency(Math.abs(currentBalance))}
                  {currentBalance > 0
                    ? '（应收）'
                    : currentBalance < 0
                      ? '（应付）'
                      : '（已结清）'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.back()}
              className="h-11"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <Button variant="outline" size="lg" className="h-11">
              <Download className="mr-2 h-4 w-4" />
              导出对账单
            </Button>
            <Button variant="outline" size="lg" className="h-11">
              <Receipt className="mr-2 h-4 w-4" />
              生成报表
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
