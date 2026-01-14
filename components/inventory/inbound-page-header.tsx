'use client';

/**
 * 仓库进货页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 使用统一的PageHeader组件
 * 与销售订单页面保持一致的结构
 */

import { FileText, PackageCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { can } from '@/lib/auth/permissions';

export function InboundPageHeader() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl shadow-sm">
      {/* 背景装饰 */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-5 sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-500/10">
            <PackageCheck className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              产品入库记录
            </h1>
            <p className="text-sm font-medium text-slate-500">
              实时跟踪全渠道库存入库流水 · 确保资产账实相符
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 期初入库按钮 - 仅对有权限的用户显示 */}
          {can(user ?? null, 'inventory:opening_balance') && (
            <Button
              variant="outline"
              size="lg"
              className="h-12 border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
              onClick={() =>
                router.push('/inventory/inbound/create?type=opening_balance')
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              期初库存录入
            </Button>
          )}

          {/* 新增入库按钮 */}
          <Button
            size="lg"
            className="h-12 bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:scale-105 active:scale-95"
            onClick={() => router.push('/inventory/inbound/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            办理产品入库
          </Button>
        </div>
      </div>
    </div>
  );
}
