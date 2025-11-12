'use client';

import { Download, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { ReceivablesClient } from '@/components/finance/receivables-client';
import { Button } from '@/components/ui/button';
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
        <PageHeader
          title="应收货款管理"
          description="管理销售订单产生的应收账款，跟踪收款状态"
          icon={<TrendingUp className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/finance/receivables/export">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/sales-orders/create">
                  <Plus className="mr-2 h-4 w-4" />
                  新建销售订单
                </Link>
              </Button>
            </>
          }
        />

        <ReceivablesClient
          initialData={initialData}
          initialParams={initialParams}
        />
      </div>
    </div>
  );
}
