'use client';

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  TrendingUp,
} from 'lucide-react';

import { formatNumber } from '@/lib/utils/format';

interface BatchSummaryData {
  openingBalance?: number;
  currentQuantity?: number;
  netChange?: number;
  totalInbound: number;
  totalOutbound: number;
  totalAdjustment: number;
}

export function BatchHistorySummary({
  summary,
}: {
  summary: BatchSummaryData;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* 期初库存 */}
      <SummaryItem
        title="期初库存"
        value={summary.openingBalance}
        icon={<Layers className="h-5 w-5 text-blue-600" />}
        iconBg="bg-blue-50"
        unit="片"
      />

      {/* 当前库存 */}
      <SummaryItem
        title="当前库存"
        value={summary.currentQuantity}
        icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
        iconBg="bg-emerald-50"
        unit="片"
        emphasis
      />

      {/* 净变动 */}
      <SummaryItem
        title="净变动"
        value={summary.netChange}
        icon={
          summary.netChange && summary.netChange >= 0 ? (
            <ArrowDownToLine className="h-5 w-5 text-indigo-600" />
          ) : (
            <ArrowUpFromLine className="h-5 w-5 text-rose-600" />
          )
        }
        iconBg={
          summary.netChange && summary.netChange >= 0
            ? 'bg-indigo-50'
            : 'bg-rose-50'
        }
        unit="片"
        isChange
      />

      {/* 变动汇总 */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-slate-400">
            流水汇总
          </span>
          <div className="space-y-2">
            <MiniRow
              label="入库"
              value={summary.totalInbound}
              color="text-emerald-600"
              prefix="+"
            />
            <MiniRow
              label="出库"
              value={summary.totalOutbound}
              color="text-rose-600"
              prefix="-"
            />
            <MiniRow
              label="调整"
              value={summary.totalAdjustment}
              color="text-amber-600"
              prefix=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  title,
  value,
  icon,
  iconBg,
  unit,
  emphasis = false,
  isChange = false,
}: any) {
  const displayValue = value === undefined ? '—' : formatNumber(value);
  const prefix = isChange && value > 0 ? '+' : '';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md ${emphasis ? 'ring-2 ring-emerald-500/20' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-400">
            {title}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-2xl font-semibold tabular-nums transition-colors ${emphasis ? 'text-emerald-600' : 'text-slate-900'}`}
            >
              {prefix}
              {displayValue}
            </span>
            <span className="text-[10px] font-bold text-slate-300">
              {unit}
            </span>
          </div>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} shadow-inner`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniRow({ label, value, color, prefix }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>
        {value === 0 ? '0' : `${prefix}${formatNumber(value)}`}
      </span>
    </div>
  );
}
