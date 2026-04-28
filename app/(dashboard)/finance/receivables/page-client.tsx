'use client';

import { Download, Plus, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { FinanceListSkeleton } from '@/components/ui/skeleton-compositions';
import { useFinanceExport } from '@/hooks/use-finance-export';
import type { ReceivablesParams } from '@/lib/schemas/receivables-params';

type ReceivablesPageQueryParams = ReceivablesParams;

const ReceivablesClient = dynamic(
  () =>
    import('@/components/finance/receivables-client').then(
      mod => mod.ReceivablesClient
    ),
  {
    ssr: false,
    loading: () => <FinanceListSkeleton />,
  }
);

interface ReceivablesPageClientProps {
  initialParams: ReceivablesPageQueryParams;
}

export function ReceivablesPageClient({
  initialParams,
}: ReceivablesPageClientProps) {
  const { exportData, isExporting } = useFinanceExport();

  const handleExport = useCallback(
    (format: 'excel' | 'csv') => {
      exportData('/api/finance/receivables/export', {
        format,
        filters: initialParams,
      });
    },
    [exportData, initialParams]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 xl:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="应收账款"
          description="查看客户待收款。"
          icon={<TrendingUp className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={isExporting}
                  onClick={() => handleExport('excel')}
                  className="h-11 rounded-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? '导出中...' : '导出'}
                </Button>
              </div>
              <Button size="lg" asChild className="h-11 rounded-lg">
                <Link href="/sales-orders/create">
                  <Plus className="mr-2 h-4 w-4" />
                  新建销售订单
                </Link>
              </Button>
            </>
          }
        />

        <ReceivablesClient initialParams={initialParams} />
      </div>
    </div>
  );
}
