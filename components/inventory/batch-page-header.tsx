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
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-blue-600">
            <PackageSearch className="h-7 w-7 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              批次规格管理
            </h1>
            <p className="max-w-md text-sm leading-relaxed font-medium text-slate-500">
              维护批次片数和重量。
            </p>
          </div>
        </div>

        <div className="w-full xl:w-auto">
          {isError ? (
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full gap-2 rounded-md border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 xl:w-auto"
              onClick={onRefresh}
            >
              <RefreshCcw className="h-4 w-4" />
              重新加载
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-12 w-full gap-2 rounded-md bg-slate-900 px-6 font-bold text-white shadow-sm hover:bg-slate-800 xl:w-auto"
              onClick={onCreate}
            >
              <Plus className="h-5 w-5" />
              新增批次资料
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
