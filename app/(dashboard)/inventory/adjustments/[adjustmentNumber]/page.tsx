import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList, Gauge, Layers, RefreshCcw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAdjustmentByNumber } from '@/lib/api/adjustments-server';
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_STATUS_LABELS,
  ADJUSTMENT_STATUS_VARIANTS,
  type InventoryAdjustment,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatNumber } from '@/lib/utils/format';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

const reasonVariantMap: Record<string, 'outline' | 'default' | 'secondary' | 'warning' | 'destructive' | 'success'> = {
  inventory_gain: 'success',
  surplus_gain: 'success',
  inventory_loss: 'warning',
  damage_loss: 'destructive',
  transfer: 'secondary',
  other: 'outline',
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-[hsl(var(--color-text-secondary))]">{label}</span>
      <span className="text-[hsl(var(--color-text-primary))]">{value ?? '—'}</span>
    </div>
  );
}

function formatQuantity(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)}`;
}

export default async function InventoryAdjustmentDetailPage({
  params,
}: {
  params: Promise<{ adjustmentNumber: string }>;
}) {
  const { adjustmentNumber: rawNumber } = await params;
  const adjustmentNumber = decodeURIComponent(rawNumber);

  const adjustment = (await getAdjustmentByNumber(adjustmentNumber)) as (InventoryAdjustment & {
    inventoryBalance?: number;
  }) | null;

  if (!adjustment) {
    notFound();
  }

  const reasonLabel =
    ADJUSTMENT_REASON_LABELS[
      adjustment.reason as keyof typeof ADJUSTMENT_REASON_LABELS
    ] || '库存调整';
  const reasonVariant = reasonVariantMap[adjustment.reason] ?? 'outline';
  const statusVariant =
    ADJUSTMENT_STATUS_VARIANTS[
      adjustment.status as keyof typeof ADJUSTMENT_STATUS_VARIANTS
    ] || 'secondary';
  const statusLabel =
    ADJUSTMENT_STATUS_LABELS[
      adjustment.status as keyof typeof ADJUSTMENT_STATUS_LABELS
    ] || '未定义';

  const createdAt = formatDateTimeCN(adjustment.createdAt);
  const updatedAt =
    adjustment.updatedAt && adjustment.updatedAt !== adjustment.createdAt
      ? formatDateTimeCN(adjustment.updatedAt)
      : undefined;

  return (
    <div className="flex h-full flex-col overflow-auto bg-[hsl(var(--color-bg-canvas))]">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 pb-12">
        <div className="flex flex-col gap-4">
          <Button asChild variant="ghost" size="sm" className="w-fit gap-2 text-[hsl(var(--color-text-secondary))]">
            <Link href="/inventory/adjustments">
              <ArrowLeft className="h-4 w-4" />
              返回调整记录
            </Link>
          </Button>

          <Card className="border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-medium)]">
            <CardHeader className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold text-[hsl(var(--color-text-primary))]">
                  <RefreshCcw className="h-5 w-5 text-[hsl(var(--color-primary))]" />
                  调整单 {adjustment.adjustmentNumber}
                </CardTitle>
                <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                  创建时间：{createdAt}
                  {updatedAt ? ` ｜ 最近更新：${updatedAt}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant} className="w-fit">
                  {statusLabel}
                </Badge>
                <Badge variant={reasonVariant} className="w-fit text-[hsl(var(--color-text-secondary))]">
                  {reasonLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">调整前数量</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {formatNumber(adjustment.beforeQuantity)} 片
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">调整数量</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {formatQuantity(adjustment.adjustQuantity)} 片
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">调整后数量</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {formatNumber(adjustment.afterQuantity)} 片
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">当前批次库存</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {adjustment.inventoryBalance !== undefined
                        ? `${formatNumber(adjustment.inventoryBalance)} 片`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
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
              <DetailRow label="产品名称" value={adjustment.product?.name || '—'} />
              <DetailRow label="产品编码" value={adjustment.product?.code || '—'} />
              <DetailRow label="规格" value={adjustment.product?.specification || '—'} />
              <DetailRow
                label="色号/变体"
                value={
                  adjustment.variant
                    ? `${adjustment.variant.colorCode}${adjustment.variant.colorName ? ` · ${adjustment.variant.colorName}` : ''}`
                    : '—'
                }
              />
              <DetailRow label="批次号" value={adjustment.batchNumber || '—'} />
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-light)]">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
              <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
                审批信息
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 text-sm">
              <DetailRow label="制单人" value={adjustment.operator?.name || '—'} />
              <DetailRow label="审批人" value={adjustment.approver?.name || '—'} />
              <DetailRow
                label="审批时间"
                value={
                  adjustment.approvedAt
                    ? formatDateTimeCN(adjustment.approvedAt)
                    : '—'
                }
              />
              <DetailRow label="备注" value={adjustment.notes || '—'} />
            </CardContent>
          </Card>
        </div>

        {adjustment.batchNumber ? (
          <Card className="shadow-[var(--shadow-light)]">
            <CardHeader className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
                  批次追溯
                </CardTitle>
                <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                  跳转至批次库存流水，查看该批次完整的出入库轨迹。
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/inventory/batch/${encodeURIComponent(adjustment.batchNumber)}/history`}>
                  查看批次历史
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-[hsl(var(--color-text-secondary))]">
              批次流水整合入库、出库、调整数据，便于审计和库存复盘。
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
