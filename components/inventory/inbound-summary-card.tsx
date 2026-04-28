'use client';

import {
  BadgeCheck,
  Boxes,
  CalendarDays,
  ClipboardList,
  Package,
  Printer,
  Warehouse,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { OpeningBalanceRecordActions } from '@/components/inventory/opening-balance-record-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import {
  INBOUND_DAMAGE_HANDLING_LABELS,
  type InboundRecordDetail,
} from '@/lib/types/inbound';
import { formatCostPrice } from '@/lib/utils/cost-price';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

const PrintTemplatePreviewDialog = dynamic(
  () =>
    import(
      '@/components/print-designer/renderer/PrintTemplatePreviewDialog'
    ).then(mod => mod.PrintTemplatePreviewDialog),
  { ssr: false, loading: () => null }
);

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
    <div className="rounded-md border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-50 text-blue-600 sm:h-12 sm:w-12">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">
            {label}
          </div>
          <div className="mt-0.5 truncate text-sm leading-tight font-semibold text-slate-900 sm:text-base">
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
  const [isPrintDialogOpen, setIsPrintDialogOpen] = React.useState(false);

  // 检查用户是否有财务查看权限
  const hasFinancePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );
  const canManageOpeningBalance = React.useMemo(
    () => can(session?.user ?? null, 'inventory:adjust'),
    [session?.user]
  );
  const piecesPerUnit = record.batchSpecification?.piecesPerUnit ?? 0;
  const hasDamage = Boolean(
    record.damagedQuantity && record.damagedQuantity > 0
  );
  const arrivalQuantity = record.quantity + (record.damagedQuantity ?? 0);

  const formatInboundQuantity = (quantity: number | null | undefined) => {
    if (!Number.isFinite(quantity)) {
      return '—';
    }

    const normalizedQuantity = Number(quantity);
    return piecesPerUnit > 0
      ? formatPieceSummary(normalizedQuantity, piecesPerUnit, {
          fallbackUnit: '片',
        })
      : `${formatNumber(normalizedQuantity)}片`;
  };

  // 构建统计项数组，根据权限动态添加成本相关项
  const stats = [
    // 公共统计项
    {
      label: hasDamage ? '合格入库' : '入库数量',
      value: formatInboundQuantity(record.quantity),
      icon: <Boxes className="h-5 w-5" />,
    },
    ...(hasDamage
      ? [
          {
            label: '到货总量',
            value: formatInboundQuantity(arrivalQuantity),
            icon: <Boxes className="h-5 w-5" />,
          },
        ]
      : []),
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
      value:
        record.inventoryBalance === undefined
          ? '—'
          : formatInboundQuantity(record.inventoryBalance),
      icon: <Warehouse className="h-5 w-5" />,
    },
    {
      label: '批次号',
      value: record.batchNumber || '—',
      icon: <ClipboardList className="h-5 w-5" />,
    },
    ...(hasDamage
      ? [
          {
            label: '到货破损',
            value: formatInboundQuantity(record.damagedQuantity),
            icon: <Boxes className="h-5 w-5" />,
          },
          {
            label: '破损处理',
            value:
              record.damageHandling &&
              INBOUND_DAMAGE_HANDLING_LABELS[record.damageHandling]
                ? INBOUND_DAMAGE_HANDLING_LABELS[record.damageHandling]
                : '—',
            icon: <BadgeCheck className="h-5 w-5" />,
          },
        ]
      : []),
    // 财务统计项：仅在有权限时显示
    ...(hasFinancePermission
      ? [
          {
            label: '单位成本 (元/片)',
            value:
              record.unitCost !== undefined && record.unitCost !== null
                ? formatCostPrice(record.unitCost)
                : '—',
            icon: <CalendarDays className="h-5 w-5" />,
          },
          {
            label: hasDamage ? '合格入库成本' : '总成本',
            value:
              record.totalCost !== undefined && record.totalCost !== null
                ? formatCurrency(record.totalCost)
                : '—',
            icon: <CalendarDays className="h-5 w-5" />,
          },
          ...(hasDamage
            ? [
                {
                  label: '破损金额参考',
                  value:
                    record.damageTotalCost !== undefined &&
                    record.damageTotalCost !== null
                      ? formatCurrency(record.damageTotalCost)
                      : '—',
                  icon: <CalendarDays className="h-5 w-5" />,
                },
              ]
            : []),
        ]
      : []),
  ];

  // 动态计算网格列数
  const gridColsClass =
    stats.length === 5
      ? 'xl:grid-cols-3 2xl:grid-cols-5'
      : stats.length === 6
        ? 'xl:grid-cols-3'
        : stats.length > 6
          ? 'xl:grid-cols-3 2xl:grid-cols-4'
          : 'xl:grid-cols-4';

  return (
    <>
      <Card className="overflow-hidden rounded-md border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-6 sm:py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1.5 text-left">
            <CardTitle className="flex items-center justify-start gap-2 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              <Package className="h-5 w-5 text-blue-600" />
              入库单 {record.recordNumber}
            </CardTitle>
            <p className="flex flex-wrap items-center justify-start gap-2 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {createdAt}
              </span>
              {updatedAt && (
                <>
                  <span className="h-3 w-px bg-slate-200" />
                  <span>最后更新：{updatedAt}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
            <Badge
              variant={reasonVariant}
              className="w-fit px-3 py-1 text-[11px] font-semibold"
            >
              {reasonLabel}
            </Badge>
            {record.reason === 'opening_balance' && canManageOpeningBalance ? (
              <OpeningBalanceRecordActions record={record} />
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => setIsPrintDialogOpen(true)}
            >
              <Printer className="mr-2 h-4 w-4" />
              打印
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className={`grid gap-4 p-4 sm:p-6 md:grid-cols-2 ${gridColsClass}`}
        >
          {stats.map(stat => (
            <DetailStat key={stat.label} {...stat} />
          ))}
        </CardContent>
      </Card>

      {isPrintDialogOpen && (
        <PrintTemplatePreviewDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          templateType="inbound-record"
          documentId={record.recordNumber}
          title="入库记录打印"
        />
      )}
    </>
  );
}
