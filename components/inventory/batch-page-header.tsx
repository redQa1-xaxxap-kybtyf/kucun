'use client';

import { PackageSearch, Plus, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface BatchPageHeaderProps {
  onCreate: () => void;
  onRefresh?: () => void;
  isError?: boolean;
}

export function BatchPageHeader({
  onCreate,
  onRefresh,
  isError,
}: BatchPageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-xl">
      {/* 背景装饰：蓝色与青色调，体现规格参数管理的精确与严谨 */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-200">
            <PackageSearch className="h-7 w-7 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              批次规格管理
            </h1>
            <p className="max-w-md text-sm leading-relaxed font-medium text-slate-500">
              在这里维护每个批次的每件片数和重量，方便入库、出库和库存核对时直接使用。
            </p>
          </div>
        </div>

        <div className="w-full xl:w-auto">
          {isError ? (
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full gap-2 rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 xl:w-auto"
              onClick={onRefresh}
            >
              <RefreshCcw className="h-4 w-4" />
              重新加载
            </Button>
          ) : (
            <Button
              size="lg"
              className="group h-12 w-full gap-2 rounded-xl bg-slate-900 px-6 font-bold text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 xl:w-auto"
              onClick={onCreate}
            >
              <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
              新增批次资料
            </Button>
          )}
        </div>
      </div>

      {/* 底部装饰条 */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
    </div>
  );
}
