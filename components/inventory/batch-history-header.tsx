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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-xl">
      {/* 背景装饰：紫色与粉色调，体现详情页的深度与丰富性 */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-violet-500/5 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-fuchsia-500/5 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-200">
            <ActivitySquare className="h-7 w-7 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                批次流量历史
              </h1>
              <Badge
                variant="outline"
                className="h-6 border-violet-100 bg-violet-50 px-2 text-[10px] font-black text-violet-600 uppercase shadow-sm"
              >
                实时追踪
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>批次号：</span>
              <span className="font-black text-slate-900 tabular-nums">
                {batchNumber}
              </span>
              {filteredInventoryId && (
                <>
                  <span className="mx-2 h-3 w-px bg-slate-200" />
                  <span>库存实例：</span>
                  <span className="font-black text-slate-700">
                    {filteredInventoryId}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            asChild
            className="h-12 gap-2 rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
