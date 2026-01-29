import { FileText, TrendingDown, TrendingUp, Users } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

import type { StatementsSummary } from './statements-types';

export function StatementsSummaryCards({
  summary,
}: {
  summary: StatementsSummary;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="应收账款"
        icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
        value={formatCurrency(summary.totalReceivable)}
        footer={`${summary.totalCustomers} 个活跃客户`}
        variant="emerald"
      />
      <SummaryCard
        title="应付账款"
        icon={<TrendingDown className="h-5 w-5 text-amber-500" />}
        value={formatCurrency(summary.totalPayable)}
        footer={`${summary.totalSuppliers} 个合作厂家`}
        variant="amber"
      />
      <SummaryCard
        title="客户覆盖"
        icon={<Users className="h-5 w-5 text-blue-500" />}
        value={summary.totalCustomers}
        footer="已签署往来协议"
        variant="blue"
      />
      <SummaryCard
        title="供应节点"
        icon={<FileText className="h-5 w-5 text-purple-500" />}
        value={summary.totalSuppliers}
        footer="持续供货记录"
        variant="purple"
      />
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  value,
  footer,
  variant = 'blue',
}: {
  title: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  footer: string;
  variant?: 'emerald' | 'amber' | 'blue' | 'purple';
}) {
  const themes = {
    emerald: 'bg-emerald-50 text-emerald-600 shadow-emerald-100',
    amber: 'bg-amber-50 text-amber-600 shadow-amber-100',
    blue: 'bg-blue-50 text-blue-600 shadow-blue-100',
    purple: 'bg-purple-50 text-purple-600 shadow-purple-100',
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[2.5rem] border-none bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.04)] transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl',
        'hover:bg-white'
      )}
    >
      {/* Decorative background icon */}
      <div className="absolute top-0 right-0 p-6 opacity-[0.03] transition-transform duration-700 group-hover:scale-110">
        {React.cloneElement(icon as React.ReactElement, { size: 120 })}
      </div>

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-2xl border-none shadow-lg transition-transform group-hover:rotate-6',
              themes[variant]
            )}
          >
            {React.cloneElement(icon as React.ReactElement, {
              className: 'h-7 w-7',
            })}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase transition-colors group-hover:text-slate-400">
              Metric insight
            </span>
            <div className="mt-1 h-1 w-8 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full w-2/3 animate-pulse rounded-full',
                  variant === 'emerald'
                    ? 'bg-emerald-500'
                    : variant === 'amber'
                      ? 'bg-amber-500'
                      : variant === 'blue'
                        ? 'bg-blue-500'
                        : 'bg-purple-500'
                )}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">
            {title} / {variant.toUpperCase()}
          </h3>
          <p className="text-3xl font-black tracking-tighter text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                variant === 'emerald'
                  ? 'bg-emerald-500'
                  : variant === 'amber'
                    ? 'bg-amber-500'
                    : variant === 'blue'
                      ? 'bg-blue-500'
                      : 'bg-purple-500'
              )}
            />
            <p className="text-[11px] font-black tracking-normal text-slate-500 uppercase">
              {footer}
            </p>
          </div>
          <div className="rounded-md bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-400 uppercase">
            实时
          </div>
        </div>
      </div>
    </div>
  );
}
