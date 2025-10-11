import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Boxes, HandCoins, PackageMinus, Warehouse } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getOutboundRecordByNumber } from '@/lib/api/outbound-server';
import {
  OUTBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_VARIANTS,
  type OutboundRecordDetail,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

const OUTBOUND_REASON_LABELS: Record<string, string> = {
  manual_outbound: '手动出库',
  normal_outbound: '正常出库',
  sales_outbound: '销售出库',
  transfer: '调拨出库',
  damage: '报损出库',
  adjust_outbound: '调整出库',
  other: '其他出库',
};

function resolveReasonLabel(record: OutboundRecordDetail) {
  if (record.reason && OUTBOUND_REASON_LABELS[record.reason]) {
    return OUTBOUND_REASON_LABELS[record.reason];
  }

  return OUTBOUND_REASON_LABELS[record.type] || '出库';
}

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

export default async function OutboundRecordDetailPage({
  params,
}: {
  params: Promise<{ recordNumber: string }>;
}) {
  const { recordNumber: rawRecordNumber } = await params;
  const recordNumber = decodeURIComponent(rawRecordNumber);

  const record = await getOutboundRecordByNumber(recordNumber);

  if (!record) {
    notFound();
  }

  const typeLabel = OUTBOUND_TYPE_LABELS[record.type] || '出库';
  const typeVariant = OUTBOUND_TYPE_VARIANTS[record.type] || 'outline';
  const reasonLabel = resolveReasonLabel(record);
  const createdAt = formatDateTimeCN(record.createdAt);
  const updatedAt =
    record.updatedAt && record.updatedAt !== record.createdAt
      ? formatDateTimeCN(record.updatedAt)
      : undefined;

  return (
    <div className="flex h-full flex-col overflow-auto bg-[hsl(var(--color-bg-canvas))]">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 pb-12">
        <div className="flex flex-col gap-4">
          <Button asChild variant="ghost" size="sm" className="w-fit gap-2 text-[hsl(var(--color-text-secondary))]">
            <Link href="/inventory/outbound">
              <ArrowLeft className="h-4 w-4" />
              返回出库记录
            </Link>
          </Button>

          <Card className="border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-medium)]">
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
                <Badge variant="outline" className="w-fit text-[hsl(var(--color-text-secondary))]">
                  {reasonLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">出库数量</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {formatNumber(record.quantity)} {record.product?.unit || '片'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">单位成本</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {record.unitCost !== undefined ? formatCurrency(record.unitCost) : '—'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">当前批次库存</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {record.inventoryBalance !== undefined
                        ? `${formatNumber(record.inventoryBalance)} ${record.product?.unit || '片'}`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-tertiary))]">操作人</div>
                    <div className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                      {record.user?.name || '—'}
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
              <DetailRow label="产品名称" value={record.product?.name || '—'} />
              <DetailRow label="产品编码" value={record.product?.code || '—'} />
              <DetailRow label="规格" value={record.product?.specification || '—'} />
              <DetailRow
                label="色号/变体"
                value={
                  record.variant
                    ? `${record.variant.colorCode}${record.variant.colorName ? ` · ${record.variant.colorName}` : ''}`
                    : '—'
                }
              />
              <DetailRow label="批次号" value={record.batchNumber || '—'} />
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-light)]">
            <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
              <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
                出库信息
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 text-sm">
              <DetailRow label="创建人" value={record.user?.name || '—'} />
              <DetailRow label="创建时间" value={createdAt} />
              {updatedAt ? <DetailRow label="更新时间" value={updatedAt} /> : null}
              <DetailRow
                label="销售订单"
                value={
                  record.salesOrder ? (
                    <Link
                      href={`/sales-orders/${record.salesOrder.id}`}
                      className="text-[hsl(var(--color-primary))] hover:underline"
                    >
                      {record.salesOrder.orderNumber}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow label="客户" value={record.customer?.name || '—'} />
              <DetailRow label="备注" value={record.remarks || '—'} />
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
                  快速查看该批次的入库、出库、调整记录。
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/inventory/batch/${encodeURIComponent(record.batchNumber)}/history`}>
                  查看批次历史
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-[hsl(var(--color-text-secondary))]">
              使用批次历史可以完整追踪库存去向，辅助库存稽核与复盘。
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
