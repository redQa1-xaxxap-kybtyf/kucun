import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { OutboundOverviewCard } from '@/components/inventory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOutboundRecordByNumber } from '@/lib/api/outbound-server';
import { requirePagePermission } from '@/lib/auth/page-permission';
import { type OutboundRecordDetail } from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

type PageParams = { recordNumber: string };

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-[hsl(var(--color-text-secondary))]">{label}</span>
      <span className="text-[hsl(var(--color-text-primary))]">
        {value ?? '—'}
      </span>
    </div>
  );
}

async function loadOutboundRecord(params: Promise<PageParams>) {
  await requirePagePermission('inventory:view');

  const { recordNumber: rawRecordNumber } = await params;
  const recordNumber = decodeURIComponent(rawRecordNumber);
  const record = await getOutboundRecordByNumber(recordNumber);

  if (!record) {
    notFound();
  }

  return record;
}

export default async function OutboundRecordDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const record = await loadOutboundRecord(params);
  return <OutboundRecordDetail record={record} />;
}

function OutboundRecordDetail({ record }: { record: OutboundRecordDetail }) {
  const createdAt = formatDateTimeCN(record.createdAt);
  const updatedAt =
    record.updatedAt && record.updatedAt !== record.createdAt
      ? formatDateTimeCN(record.updatedAt)
      : undefined;

  return (
    <div className="flex h-full flex-col overflow-auto bg-[hsl(var(--color-bg-canvas))]">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 pb-12">
        <div className="flex flex-col gap-4">
          <BackButton />
          <OutboundOverviewCard
            record={record}
            createdAt={createdAt}
            updatedAt={updatedAt}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ProductInfoCard record={record} />
          <OutboundInfoCard
            record={record}
            createdAt={createdAt}
            updatedAt={updatedAt}
          />
        </div>
        <BatchHistoryCard batchNumber={record.batchNumber} />
      </div>
    </div>
  );
}

// OutboundOverviewCard 已移至客户端组件

function ProductInfoCard({ record }: { record: OutboundRecordDetail }) {
  const variantLabel = record.variant
    ? `${record.variant.colorCode}${record.variant.colorName ? ` · ${record.variant.colorName}` : ''}`
    : '—';

  return (
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
        <DetailRow label="色号/变体" value={variantLabel} />
        <DetailRow label="批次号" value={record.batchNumber || '—'} />
      </CardContent>
    </Card>
  );
}

function OutboundInfoCard({
  record,
  createdAt,
  updatedAt,
}: {
  record: OutboundRecordDetail;
  createdAt: string;
  updatedAt?: string;
}) {
  const salesOrderValue = record.salesOrder ? (
    <Link
      href={`/sales-orders/${record.salesOrder.id}`}
      className="text-[hsl(var(--color-primary))] hover:underline"
    >
      {record.salesOrder.orderNumber}
    </Link>
  ) : (
    '—'
  );

  return (
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
        <DetailRow label="销售订单" value={salesOrderValue} />
        <DetailRow label="客户" value={record.customer?.name || '—'} />
        <DetailRow label="备注" value={record.remarks || '—'} />
      </CardContent>
    </Card>
  );
}

function BatchHistoryCard({ batchNumber }: { batchNumber?: string | null }) {
  if (!batchNumber) {
    return null;
  }

  return (
    <Card className="shadow-[var(--shadow-light)]">
      <CardHeader className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
            批次追溯
          </CardTitle>
        </div>
        <Button variant="outline" asChild>
          <Link
            href={`/inventory/batch/${encodeURIComponent(batchNumber)}/history`}
          >
            查看批次历史
          </Link>
        </Button>
      </CardHeader>
    </Card>
  );
}

function BackButton() {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="w-fit gap-2 text-[hsl(var(--color-text-secondary))]"
    >
      <Link href="/inventory/outbound">
        <ArrowLeft className="h-4 w-4" />
        返回出库记录
      </Link>
    </Button>
  );
}
