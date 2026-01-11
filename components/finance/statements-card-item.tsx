import {
    ArrowUpRight,
    ChevronRight,
    History,
    TrendingDown,
    User,
    Wallet
} from 'lucide-react';
import Link from 'next/link';

import { RelativeTime } from '@/components/common/relative-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';

import {
    STATUS_LABEL_MAP,
    TYPE_LABEL_MAP,
    type AccountStatementItem,
} from './statements-types';

type StatementCardItemProps = {
  statement: AccountStatementItem;
};

export function StatementCardItem({ statement }: StatementCardItemProps) {
  const balance = statement.currentBalance ?? 0;
  const balanceLabel = balance > 0 ? '应收余额' : balance < 0 ? '应付余额' : '账目结清';
  
  const paymentRate =
    Math.abs(statement.totalAmount) > 0
      ? (Math.abs(statement.paidAmount) / Math.abs(statement.totalAmount)) * 100
      : 0;

  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-white hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] hover:-translate-y-1">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        
        {/* Left: Identity Section */}
        <div className="flex items-center gap-5 min-w-[280px]">
          <div className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl transition-transform group-hover:scale-110 duration-500",
            statement.type === 'customer' ? "bg-blue-600 shadow-blue-200" : "bg-purple-600 shadow-purple-200"
          )}>
            {statement.type === 'customer' ? <User className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
              {statement.name}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-md border-slate-200 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-600 px-2 py-0.5">
                {TYPE_LABEL_MAP[statement.type]}
              </Badge>
              <div className={cn(
                "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                statement.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              )}>
                {STATUS_LABEL_MAP[statement.status]}
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Professional Metrics Grid */}
        <div className="grid flex-1 grid-cols-2 gap-6 border-slate-100 lg:border-x lg:px-8 xl:grid-cols-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">往来笔数</span>
            <p className="text-lg font-black text-slate-900">{statement.totalOrders} <span className="text-xs font-bold text-slate-500 ml-1">笔账单</span></p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">累计流</span>
            <p className="text-lg font-black text-slate-900">{formatCurrency(Math.abs(statement.totalAmount))}</p>
          </div>
          <div className="space-y-1 lg:col-span-2 xl:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
               <span className="text-xs font-bold uppercase tracking-wider text-slate-500">结算对账进度</span>
               <span className="text-xs font-bold text-blue-700">{paymentRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
               <div 
                 className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000 group-hover:from-emerald-500 group-hover:to-teal-500" 
                 style={{ width: `${paymentRate}%` }} 
               />
            </div>
          </div>
        </div>

        {/* Right: Balance & Action */}
        <div className="flex items-center gap-8 lg:min-w-[280px] lg:justify-end">
          <div className="text-right space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{balanceLabel}</span>
            <div className="flex items-baseline justify-end gap-1">
               <span className={cn("text-sm font-black", balance > 0 ? "text-emerald-500" : balance < 0 ? "text-amber-500" : "text-slate-400")}>¥</span>
               <p className={cn(
                 "text-2xl font-black tracking-tighter",
                 balance > 0 ? "text-emerald-600" : balance < 0 ? "text-amber-600" : "text-slate-400"
               )}>
                 {formatCurrency(Math.abs(balance)).replace('¥', '')}
               </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              asChild
              className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all active:scale-90 shadow-sm"
            >
              <Link href={`/finance/statements/${statement.id}`}>
                <ChevronRight className="h-6 w-6" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Footer: Timeline & Metadata */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-5">
        <div className="flex items-center gap-6">
           {statement.lastTransactionDate && (
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
               <History className="h-3.5 w-3.5 text-slate-400" />
               最后动账 <span className="text-slate-900 ml-1"><RelativeTime date={statement.lastTransactionDate} /></span>
             </div>
           )}
           {statement.lastPaymentDate && (
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
               <Wallet className="h-3.5 w-3.5 text-slate-400" />
               最近结算 <span className="text-slate-900 ml-1"><RelativeTime date={statement.lastPaymentDate} /></span>
             </div>
           )}
        </div>
        
        <div className="flex items-center gap-3">
           <Link 
             href={`/finance/statements/${statement.id}/transactions`}
             className="text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
           >
             Full Audit Stream <ArrowUpRight className="h-3 w-3" />
           </Link>
        </div>
      </div>
    </div>
  );
}
