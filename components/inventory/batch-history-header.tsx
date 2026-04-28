'use client';

import { ActivitySquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BatchHistoryHeaderProps {
  batchNumber: string;
  filteredInventoryId?: string;
  backUrl?: string;
}

export function BatchHistoryHeader({
  batchNumber,
  filteredInventoryId,
  backUrl = '/inventory/batch',
}: BatchHistoryHeaderProps) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-violet-600">
            <ActivitySquare className="h-7 w-7 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                批次变动历史
              </h1>
              <Badge
                variant="outline"
                className="h-6 border-violet-100 bg-violet-50 px-2 text-[10px] font-semibold text-violet-600 shadow-sm"
              >
                批次详情
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>批次号：</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {batchNumber}
              </span>
              {filteredInventoryId && (
                <>
                  <span className="mx-2 h-3 w-px bg-slate-200" />
                  <span>库存实例：</span>
                  <span className="font-semibold text-slate-700">
                    {filteredInventoryId}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="w-full xl:w-auto">
          <Button
            variant="outline"
            size="lg"
            asChild
            className="h-12 w-full gap-2 rounded-md border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 xl:w-auto"
          >
            <Link href={backUrl}>
              <ArrowLeft className="h-4 w-4" />
              返回批次管理
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
