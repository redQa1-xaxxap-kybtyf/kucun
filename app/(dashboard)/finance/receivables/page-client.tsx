'use client';

import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { ReceivablesClient } from '@/components/finance/receivables-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinanceExport } from '@/hooks/use-finance-export';
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
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <PageHeader
          title="应收货款管理"
          description="管理销售订单产生的应收账款，跟踪收款状态"
          icon={<TrendingUp className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={isExporting}
                    className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? '导出中...' : '导出'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>选择导出格式</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleExport('excel')}
                    disabled={isExporting}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel 格式 (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExport('csv')}
                    disabled={isExporting}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    CSV 格式 (.csv)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
