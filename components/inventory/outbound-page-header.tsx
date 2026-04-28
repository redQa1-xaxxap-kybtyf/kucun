'use client';

/**
 * 仓库出库页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 使用统一的 PageHeader 风格
 * 与入库页面保持高度一致的视觉语言
 */

import { FlaskConical, PackageX, Plus, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export function OutboundPageHeader() {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-rose-600">
            <PackageX className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              产品出库记录
            </h1>
            <p className="text-sm font-medium text-slate-500">
              查看产品出库流水，核对每一笔库存减少
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap">
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            onClick={() =>
              router.push('/inventory/outbound/create?type=sample_outbound')
            }
          >
            <FlaskConical className="mr-2 h-4 w-4" />
            客户样品
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            onClick={() =>
              router.push('/inventory/adjust?reason=damage_loss&open=1')
            }
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            报损处理
          </Button>

          <Button
            size="lg"
            className="h-12 w-full bg-rose-600 text-white shadow-sm hover:bg-rose-700"
            onClick={() => router.push('/inventory/outbound/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            办理产品出库
          </Button>
        </div>
      </div>
    </div>
  );
}
