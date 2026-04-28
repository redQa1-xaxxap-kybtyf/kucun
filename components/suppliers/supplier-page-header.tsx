'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export function SupplierPageHeader() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          供应商档案
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          统一维护供应商资料，查看供货记录、应付款和合作状态。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="lg"
          onClick={() => router.push('/suppliers/create')}
          className="h-10 rounded-md px-4 font-medium"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建供应商
        </Button>
      </div>
    </div>
  );
}
