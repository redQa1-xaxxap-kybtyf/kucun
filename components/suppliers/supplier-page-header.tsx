'use client';

import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export function SupplierPageHeader() {
  const router = useRouter();

  return (
    <div className="animate-in fade-in slide-in-from-top-4 flex flex-col gap-6 duration-500 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tighter text-slate-900">
          供应商管理
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed font-bold text-slate-400">
          统一维护供应商资料，查看供货记录、应付款和合作状态。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="lg"
          asChild
          className="h-12 rounded-2xl border-none bg-white px-6 font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-900 hover:text-white active:scale-95"
        >
          <Link href="/suppliers/export">
            <Download className="mr-2 h-4 w-4" />
            导出供应商列表
          </Link>
        </Button>
        <Button
          size="lg"
          onClick={() => router.push('/suppliers/create')}
          className="h-12 rounded-2xl border-none bg-slate-900 px-6 font-semibold text-white shadow-xl transition-all hover:shadow-slate-200 active:scale-95"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建供应商
        </Button>
      </div>
    </div>
  );
}
