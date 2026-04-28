'use client';

import {
  BadgeCheck,
  Boxes,
  HandCoins,
  PackageMinus,
  Printer,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import {
  OUTBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_VARIANTS,
  type OutboundRecordDetail,
} from '@/lib/types/inventory';
import { formatCostPrice } from '@/lib/utils/cost-price';
import { formatNumber } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

const OUTBOUND_REASON_LABELS: Record<string, string> = {
  manual_outbound: '手动出库',
  normal_outbound: '正常出库',
  sales_outbound: '销售出库',
  sample_outbound: '样品出库',
  internal_use_outbound: '内部领用',
  transfer: '调拨出库',
  damage: '报损出库',
  adjust_outbound: '调整出库',
  other: '其他出库',
};

const PrintTemplatePreviewDialog = dynamic(
  () =>
    import(
      '@/components/print-designer/renderer/PrintTemplatePreviewDialog'
    ).then(mod => mod.PrintTemplatePreviewDialog),
  { ssr: false, loading: () => null }
);

function resolveReasonLabel(record: OutboundRecordDetail) {
  if (record.reason && OUTBOUND_REASON_LABELS[record.reason]) {
    return OUTBOUND_REASON_LABELS[record.reason];
  }
  return OUTBOUND_REASON_LABELS[record.type] || '出库';
}

type SummaryItem = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  iconClassName: string;
};

function SummaryStat({ icon: Icon, iconClassName, label, value }: SummaryItem) {
  return (
    <div className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${iconClassName}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
            {label}
          </div>
          <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OutboundOverviewCardProps {
  record: OutboundRecordDetail;
  createdAt: string;
  updatedAt?: string;
}

export function OutboundOverviewCard({
  record,
  createdAt,
  updatedAt,
}: OutboundOverviewCardProps) {
  const { data: session } = useSession();
  const [isPrintDialogOpen, setIsPrintDialogOpen] = React.useState(false);

  // 检查用户是否有财务查看权限
  const hasFinancePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );

  const typeLabel = OUTBOUND_TYPE_LABELS[record.type] ?? '出库';
  const typeVariant = OUTBOUND_TYPE_VARIANTS[record.type] ?? 'outline';
  const reasonLabel = resolveReasonLabel(record);

  // 构建统计项数组，根据权限动态添加成本相关项
  const summaryItems: SummaryItem[] = [
    // 公共统计项
    {
      label: '出库数量',
      value: (() => {
        const ppu = record.piecesPerUnit ?? record.product?.piecesPerUnit ?? 0;
        return ppu > 0
          ? formatPieceSummary(record.quantity, ppu, { fallbackUnit: '片' })
          : `${formatNumber(record.quantity)}片`;
      })(),
      icon: Boxes,
      iconClassName:
        'bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]',
    },
    // 财务统计项：仅在有权限时显示
    ...(hasFinancePermission
      ? [
          {
            label: '单位成本',
            value:
              record.unitCost !== undefined && record.unitCost !== null
                ? formatCostPrice(record.unitCost)
                : '—',
            icon: HandCoins,
            iconClassName:
              'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
          },
        ]
      : []),
    {
      label: '当前批次库存',
      value: (() => {
        if (record.inventoryBalance === undefined) return '—';
        const ppu = record.piecesPerUnit ?? record.product?.piecesPerUnit ?? 0;
        return ppu > 0
          ? formatPieceSummary(record.inventoryBalance, ppu, {
              fallbackUnit: '片',
            })
          : `${formatNumber(record.inventoryBalance)}片`;
      })(),
      icon: Warehouse,
      iconClassName:
        'bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
    },
    {
      label: '操作人',
      value: record.user?.name || '—',
      icon: BadgeCheck,
      iconClassName:
        'bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]',
    },
  ];

  // 动态计算网格列数
  const gridColsClass =
    summaryItems.length === 4
      ? 'xl:grid-cols-4'
      : summaryItems.length === 3
        ? 'xl:grid-cols-3'
        : 'xl:grid-cols-2';

  return (
    <>
      <Card className="rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold text-[hsl(var(--color-text-primary))]">
              <PackageMinus className="h-5 w-5 text-[hsl(var(--color-primary))]" />
              出库单 {record.recordNumber}
            </CardTitle>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">
              创建时间：{createdAt}
              {updatedAt ? ` ｜ 最近更新：${updatedAt}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={typeVariant} className="w-fit">
              {typeLabel}
            </Badge>
            <Badge
              variant="outline"
              className="w-fit text-[hsl(var(--color-text-secondary))]"
            >
              {reasonLabel}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsPrintDialogOpen(true)}
            >
              <Printer className="h-4 w-4" />
              打印
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className={`grid gap-4 pt-6 md:grid-cols-2 ${gridColsClass}`}
        >
          {summaryItems.map(item => (
            <SummaryStat key={item.label} {...item} />
          ))}
        </CardContent>
      </Card>
      {isPrintDialogOpen && (
        <PrintTemplatePreviewDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          templateType="delivery-note"
          documentId={record.recordNumber}
          title="出库单打印"
        />
      )}
    </>
  );
}
