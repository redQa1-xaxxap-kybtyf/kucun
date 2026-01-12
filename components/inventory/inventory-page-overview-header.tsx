'use client';

/**
 * 库存总览页面头部组件 (v3 PRO 旗舰版)
 * 采用磨砂玻璃质感、品牌渐变装饰
 * 集成库存管理核心操作入口
 */

import { Button } from '@/components/ui/button';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Package,
    Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export function InventoryPageOverviewHeader() {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl shadow-sm">
      {/* 背景装饰：紫色与靛蓝色调，体现核心管理页面的稳重与专业 */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-500/5 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-xl shadow-indigo-500/10">
            <Package className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              库存总览管理
            </h1>
            <p className="text-sm font-medium text-slate-500">
              实时穿透全仓产品库存状态 · 精准掌握周转效率与财务存证
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 入库入口 */}
          <Button
            variant="outline"
            size="lg"
            className="h-12 border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100"
            onClick={() => router.push('/inventory/inbound/create')}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            办理入库
          </Button>

          {/* 出库入口 */}
          <Button
            variant="outline"
            size="lg"
            className="h-12 border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100"
            onClick={() => router.push('/inventory/outbound/create')}
          >
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            办理出库
          </Button>

          {/* 调整/盘点入口 */}
          <Button
            size="lg"
            className="h-12 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 hover:scale-105 active:scale-95"
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
