import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CalendarDays,
  ClipboardList,
  Package,
  Warehouse,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getInboundRecordByNumber } from '@/lib/api/inbound-server';
import { INBOUND_REASON_LABELS, type InboundRecordDetail } from '@/lib/types/inbound';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

const reasonVariantMap: Record<string, 'default' | 'secondary' | 'info' | 'outline' | 'success'> = {
  purchase: 'default',
  return: 'info',
  transfer: 'secondary',
  surplus: 'success',
  other: 'outline',
};

function resolveReasonLabel(record: InboundRecordDetail) {
  return INBOUND_REASON_LABELS[record.reason] ?? '其他';
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
          <div className="text-xs text-[hsl(var(--color-text-tertiary))]">{label}</div>
          <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
            {value ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function InboundRecordDetailPage({
  params,
}: {
  params: Promise<{ recordNumber: string }>;
}) {
  const { recordNumber: rawRecordNumber } = await params;
  const recordNumber = decodeURIComponent(rawRecordNumber);

  const record = await getInboundRecordByNumber(recordNumber);

  if (!record) {
    notFound();
  }

  const reasonLabel = resolveReasonLabel(record);
  const reasonVariant = reasonVariantMap[record.reason] ?? 'outline';
  const createdAt = formatDateTimeCN(record.createdAt);
  const updatedAt =
    record.updatedAt && record.updatedAt !== record.createdAt
      ? formatDateTimeCN(record.updatedAt)
      : undefined;

  return (
    <div className="flex h-full flex-col overflow-auto bg-[hsl(var(--color-bg-canvas))]">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 pb-12">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit gap-2 text-[hsl(var(--color-text-secondary))]"
          >
            <Link href="/inventory/inbound">
              <ArrowLeft className="h-4 w-4" />
              返回入库记录
            </Link>
          </Button>

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
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
              <DetailStat
                label="入库数量"
                value={
                  <>
                    {formatNumber(record.quantity)}{' '}
                    {record.product?.unit || '片'}
                  </>
                }
                icon={<Boxes className="h-5 w-5" />}
              />
              <DetailStat
                label="操作人"
                value={record.user?.name || '—'}
                icon={<BadgeCheck className="h-5 w-5" />}
              />
              <DetailStat
                label="当前批次库存"
                value={
                  record.inventoryBalance !== undefined
                    ? `${formatNumber(record.inventoryBalance)} ${record.product?.unit || '片'}`
                    : '—'
                }
                icon={<Warehouse className="h-5 w-5" />}
              />
              <DetailStat
                label="批次号"
                value={record.batchNumber || '—'}
                icon={<ClipboardList className="h-5 w-5" />}
              />
              <DetailStat
                label="单位成本"
                value={
                  record.unitCost !== undefined
                    ? formatCurrency(record.unitCost)
                    : '—'
                }
                icon={<CalendarDays className="h-5 w-5" />}
              />
              <DetailStat
                label="总成本"
                value={
                  record.totalCost !== undefined
                    ? formatCurrency(record.totalCost)
                    : '—'
                }
                icon={<CalendarDays className="h-5 w-5" />}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-[var(--shadow-light)]">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
              <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
                产品信息
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 text-sm">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">产品名称</span>
                <span className="font-medium text-[hsl(var(--color-text-primary))]">
                  {record.product?.name || '—'}
                </span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">产品编码</span>
                <span>{record.product?.code || '—'}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">规格</span>
                <span>{record.product?.specification || '—'}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">色号/变体</span>
                <span>
                  {record.variant
                    ? `${record.variant.colorCode}${record.variant.colorName ? ` · ${record.variant.colorName}` : ''}`
                    : '—'}
                </span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">批次规格</span>
                <span>
                  {record.batchSpecification
                    ? `${record.batchSpecification.piecesPerUnit} 片/件`
                    : '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-light)]">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
              <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
                操作记录
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 text-sm">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">创建人</span>
                <span>{record.user?.name || '—'}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">创建时间</span>
                <span>{createdAt}</span>
              </div>
              {updatedAt && (
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <span className="text-[hsl(var(--color-text-secondary))]">更新时间</span>
                  <span>{updatedAt}</span>
                </div>
              )}
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">仓库位置</span>
                <span>{record.location || '—'}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-[hsl(var(--color-text-secondary))]">备注</span>
                <span className="text-[hsl(var(--color-text-primary))]">
                  {record.remarks || '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {record.batchNumber ? (
          <Card className="shadow-[var(--shadow-light)]">
            <CardHeader className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
                  批次追溯
                </CardTitle>
                <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                  查看批次 {record.batchNumber} 的完整库存流水
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/inventory/batch/${encodeURIComponent(record.batchNumber)}/history`}>
                  查看批次历史
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-[hsl(var(--color-text-secondary))]">
              如需追溯该批次的完整入库、出库、调整轨迹，请使用上方链接跳转至批次库存流水页面。
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
