'use client';

import { Download, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { ReceivablesClient } from '@/components/finance/receivables-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReceivablesParams } from '@/lib/schemas/receivables-params';
import type { ReceivablesResult } from '@/lib/services/receivables-service';

type ReceivablesPageQueryParams = ReceivablesParams;

interface ReceivablesPageClientProps {
  initialData: ReceivablesResult;
  initialParams: ReceivablesPageQueryParams;
}

export function ReceivablesPageClient({
  initialData,
  initialParams,
}: ReceivablesPageClientProps) {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    应收货款管理
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    管理销售订单产生的应收账款，跟踪收款状态
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/receivables/export">
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Link>
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/sales-orders/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建销售订单
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <ReceivablesClient
          initialData={initialData}
          initialParams={initialParams}
        />
      </div>
    </div>
  );
}
