'use client';

/**
 * 库存总览页面头部组件
 */

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export function InventoryPageOverviewHeader() {
  const router = useRouter();

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-900">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              库存总览
            </h1>
            <p className="text-sm font-medium text-slate-500">
              一眼看清库存、周转和异常情况，仓库和财务都更方便核对
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4 xl:flex xl:w-auto xl:flex-wrap">
          {/* 入库入口 */}
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
            onClick={() => router.push('/inventory/inbound/create')}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            采购入库
          </Button>

          {/* 出库入口 */}
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full border-slate-200 bg-white text-slate-600 shadow-sm hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
            onClick={() => router.push('/inventory/outbound/create')}
          >
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            办理出库
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full border-slate-200 bg-white text-slate-600 shadow-sm hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700"
            onClick={() =>
              router.push('/inventory/adjust?reason=damage_loss&open=1')
            }
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            报损处理
          </Button>

          {/* 调整/盘点入口 */}
          <Button
            size="lg"
            className="h-12 w-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
            onClick={() => router.push('/inventory/adjust')}
          >
            <Settings className="mr-2 h-4 w-4" />
            库存调整
          </Button>
        </div>
      </div>
    </div>
  );
}
