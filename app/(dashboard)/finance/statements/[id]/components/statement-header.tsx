'use client';

import { ArrowLeft, Download, FileText, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
interface StatementHeaderProps {
  name: string;
  type: 'customer' | 'supplier' | 'partner';
  status: 'active' | 'settled' | 'suspended';
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

export function StatementHeader({ name, type, status }: StatementHeaderProps) {
  const router = useRouter();

  const statusInfo = STATUS_BADGE_MAP[status] ?? STATUS_BADGE_MAP.active;

  return (
    <Card
      className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
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
            </div>
          </div>
          <div className="flex items-center gap-2">
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
