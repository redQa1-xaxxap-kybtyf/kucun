'use client';

import { ArrowLeft, BarChart3 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

const CountStatisticsClient = dynamic(
  () =>
    import('./count-statistics-client').then(mod => mod.CountStatisticsClient),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="h-[220px] w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-[160px] w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-[280px] w-full animate-pulse rounded-xl bg-slate-100" />
      </>
    ),
  }
);

interface CountStatisticsPageClientProps {
  initialParams: {
    startDate: string;
    endDate: string;
    status?: string;
  };
}

export function CountStatisticsPageClient({
  initialParams,
}: CountStatisticsPageClientProps) {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* 页面标题 */}
      <PageHeader
        title="盘点统计"
        description="查看库存盘点统计数据和分析"
        icon={<BarChart3 className="h-6 w-6 text-white" />}
        iconBgColor="hsl(var(--color-info))"
        actions={
          <Button variant="outline" size="lg" asChild className="h-11 gap-2">
            <Link href="/inventory/counts">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />

      <CountStatisticsClient initialParams={initialParams} />
    </div>
  );
}
