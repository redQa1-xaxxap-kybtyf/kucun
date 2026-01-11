import { FileText, TrendingDown, TrendingUp, Users } from 'lucide-react';

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
        icon={
          <TrendingUp className="h-5 w-5 text-emerald-500" />
        }
        value={formatCurrency(summary.totalReceivable)}
        footer={`${summary.totalCustomers} 个活跃客户`}
        variant="emerald"
      />
      <SummaryCard
        title="应付账款"
        icon={
          <TrendingDown className="h-5 w-5 text-amber-500" />
        }
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
  variant = 'blue'
}: {
  title: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  footer: string;
  variant?: 'emerald' | 'amber' | 'blue' | 'purple';
}) {
  const themes = {
    emerald: "bg-emerald-50/50 border-emerald-100/50 text-emerald-600 shadow-emerald-100/20",
    amber: "bg-amber-50/50 border-amber-100/50 text-amber-600 shadow-amber-100/20",
    blue: "bg-blue-50/50 border-blue-100/50 text-blue-600 shadow-blue-100/20",
    purple: "bg-purple-50/50 border-purple-100/50 text-purple-600 shadow-purple-100/20",
  };

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-[2rem] border bg-white/60 p-8 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1",
      "hover:bg-white"
    )}>
      <div className="relative flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110", themes[variant])}>
            {icon}
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors">
            Metric insight
          </span>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
          <p className="text-3xl font-black tracking-tighter text-slate-900">
            {value}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-normal">{footer}</p>
        </div>
      </div>
      
      {/* Decorative gradient blur */}
      <div className={cn(
        "absolute -right-8 -bottom-8 h-24 w-24 rounded-full blur-[40px] opacity-20 transition-opacity group-hover:opacity-40",
        variant === 'emerald' ? "bg-emerald-400" :
        variant === 'amber' ? "bg-amber-400" :
        variant === 'blue' ? "bg-blue-400" : "bg-purple-400"
      )} />
    </div>
  );
}
