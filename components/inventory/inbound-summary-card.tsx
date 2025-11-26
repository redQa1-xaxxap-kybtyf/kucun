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
    <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]">
          {icon}
        </div>
        <div>
          <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
            {label}
          </div>
          <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
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
    <Card className="border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-medium)]">
      <CardHeader className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-[hsl(var(--color-text-primary))]">
            <Package className="h-5 w-5 text-[hsl(var(--color-primary))]" />
            入库单 {record.recordNumber}
          </CardTitle>
          <p className="text-xs text-[hsl(var(--color-text-secondary))]">
            创建时间：{createdAt}
            {updatedAt ? ` ｜ 最近更新：${updatedAt}` : ''}
          </p>
        </div>
        <Badge variant={reasonVariant} className="w-fit">
          {reasonLabel}
        </Badge>
      </CardHeader>
      <CardContent
        className={`grid gap-4 pt-6 md:grid-cols-2 ${gridColsClass}`}
      >
        {stats.map(stat => (
          <DetailStat key={stat.label} {...stat} />
        ))}
      </CardContent>
    </Card>
  );
}
