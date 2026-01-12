'use client';

import {
    BadgeCheck,
    Boxes,
    CalendarDays,
    ClipboardList,
    Package,
    Warehouse,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import type { InboundRecordDetail } from '@/lib/types/inbound';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

type ReasonVariant = 'default' | 'secondary' | 'info' | 'outline' | 'success';

interface InboundSummaryCardProps {
  record: InboundRecordDetail;
  createdAt: string;
  updatedAt?: string;
  reasonLabel: string;
  reasonVariant: ReasonVariant;
}

function DetailStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-blue-600 shadow-inner group-hover:bg-blue-50">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            {label}
          </div>
          <div className="mt-0.5 truncate text-base font-black text-slate-900 leading-tight">
            {value ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboundSummaryCard({
  record,
  createdAt,
  updatedAt,
  reasonLabel,
  reasonVariant,
}: InboundSummaryCardProps) {
  const { data: session } = useSession();

  // 检查用户是否有财务查看权限
  const hasFinancePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );

  // 构建统计项数组，根据权限动态添加成本相关项
  const stats = [
    // 公共统计项
    {
      label: '入库数量',
      value: (() => {
        const ppu =
          record.batchSpecification?.piecesPerUnit ??
          record.product?.piecesPerUnit ??
          0;
        return ppu > 0
          ? formatPieceSummary(record.quantity, ppu, { fallbackUnit: '片' })
          : `${formatNumber(record.quantity)}片`;
      })(),
      icon: <Boxes className="h-5 w-5" />,
    },
    {
      label: '操作人',
      value: record.user?.name || '—',
      icon: <BadgeCheck className="h-5 w-5" />,
    },
    {
      label: '供应商',
      value: record.supplier?.name || '—',
      icon: <Package className="h-5 w-5" />,
    },
    {
      label: '当前批次库存',
      value: (() => {
        if (record.inventoryBalance === undefined) return '—';
        const ppu =
          record.batchSpecification?.piecesPerUnit ??
          record.product?.piecesPerUnit ??
          0;
        return ppu > 0
          ? formatPieceSummary(record.inventoryBalance, ppu, {
              fallbackUnit: '片',
            })
          : `${formatNumber(record.inventoryBalance)}片`;
      })(),
      icon: <Warehouse className="h-5 w-5" />,
    },
    {
      label: '批次号',
      value: record.batchNumber || '—',
      icon: <ClipboardList className="h-5 w-5" />,
    },
    // 财务统计项：仅在有权限时显示
    ...(hasFinancePermission
      ? [
          {
            label: '单位成本',
            value:
              record.unitCost !== undefined
                ? formatCurrency(record.unitCost)
                : '—',
            icon: <CalendarDays className="h-5 w-5" />,
          },
          {
            label: '总成本',
            value:
              record.totalCost !== undefined
                ? formatCurrency(record.totalCost)
                : '—',
            icon: <CalendarDays className="h-5 w-5" />,
          },
        ]
      : []),
  ];

  // 动态计算网格列数
  const gridColsClass =
    stats.length === 6
      ? 'xl:grid-cols-3'
      : stats.length === 5
        ? 'xl:grid-cols-5'
        : 'xl:grid-cols-4';

  return (
    <Card className="overflow-hidden border-slate-200 bg-white transition-all hover:shadow-lg">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5 text-center md:text-left">
          <CardTitle className="flex items-center justify-center gap-2 text-xl font-black tracking-tight text-slate-900 md:justify-start">
            <Package className="h-5 w-5 text-blue-600" />
            数字入库单 {record.recordNumber}
          </CardTitle>
          <p className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-400 md:justify-start">
            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {createdAt}</span>
            {updatedAt && (
              <>
                <span className="h-3 w-px bg-slate-200" />
                <span>最后修订：{updatedAt}</span>
              </>
            )}
          </p>
        </div>
        <Badge 
          variant={reasonVariant} 
          className="mx-auto w-fit px-3 py-1 text-[11px] font-black uppercase tracking-widest md:mx-0"
        >
          {reasonLabel}
        </Badge>
      </CardHeader>
      <CardContent
        className={`grid gap-5 p-6 md:grid-cols-2 ${gridColsClass}`}
      >
        {stats.map(stat => (
          <DetailStat key={stat.label} {...stat} />
        ))}
      </CardContent>
    </Card>
  );
}
