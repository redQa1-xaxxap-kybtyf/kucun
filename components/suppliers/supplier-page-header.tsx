'use client';

import { Button } from '@/components/ui/button';
import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function SupplierPageHeader() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-black tracking-tighter text-slate-900">
          供应商管理
        </h2>
        <p className="text-slate-400 text-sm font-bold max-w-2xl leading-relaxed">
          建立供应链中枢记录，监控供货频次、应付清算及合作伙伴信誉评价。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="lg"
          asChild
          className="h-12 rounded-2xl border-none bg-white font-black text-slate-600 shadow-sm hover:bg-slate-900 hover:text-white transition-all active:scale-95 px-6"
        >
          <Link href="/suppliers/export">
            <Download className="mr-2 h-4 w-4" />
            导出供应报表
          </Link>
        </Button>
        <Button
          size="lg"
          onClick={() => router.push('/suppliers/create')}
          className="h-12 rounded-2xl border-none bg-slate-900 font-black text-white shadow-xl hover:shadow-slate-200 transition-all active:scale-95 px-6"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建供应商
        </Button>
      </div>
    </div>
  );
}
