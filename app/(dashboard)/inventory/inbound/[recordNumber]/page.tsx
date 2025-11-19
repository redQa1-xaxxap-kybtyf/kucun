import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InboundSummaryCard } from '@/components/inventory/inbound-summary-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getInboundRecordByNumber } from '@/lib/api/inbound-server';
import { requirePagePermission } from '@/lib/auth/page-permission';
import {
  INBOUND_REASON_LABELS,
  type InboundRecordDetail,
} from '@/lib/types/inbound';
import { formatDateTimeCN } from '@/lib/utils/datetime';

// Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

const reasonVariantMap: Record<
  string,
  'default' | 'secondary' | 'info' | 'outline' | 'success'
> = {
  purchase: 'default',
  return: 'info',
  transfer: 'secondary',
  surplus: 'success',
  other: 'outline',
};

function resolveReasonLabel(record: InboundRecordDetail) {
  return INBOUND_REASON_LABELS[record.reason] ?? '其他';
}

function BackToInboundListButton() {
  return (
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
  );
}

// SummaryCard 已移至客户端组件 InboundSummaryCard

function ProductInfoCard({ record }: { record: InboundRecordDetail }) {
  return (
    <Card className="shadow-[var(--shadow-light)]">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
        <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
          产品信息
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            产品名称
          </span>
          <span className="font-medium text-[hsl(var(--color-text-primary))]">
            {record.product?.name || '—'}
          </span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            产品编码
          </span>
          <span>{record.product?.code || '—'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">规格</span>
          <span>{record.product?.specification || '—'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            色号/变体
          </span>
          <span>
            {record.variant
              ? `${record.variant.colorCode}${
                  record.variant.colorName
                    ? ` · ${record.variant.colorName}`
                    : ''
                }`
              : '—'}
          </span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            批次规格
          </span>
          <span>
            {record.batchSpecification
              ? `${record.batchSpecification.piecesPerUnit} 片/件`
              : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface OperationRecordCardProps {
  record: InboundRecordDetail;
  createdAt: string;
  updatedAt?: string;
}

function OperationRecordCard({
  record,
  createdAt,
  updatedAt,
}: OperationRecordCardProps) {
  return (
    <Card className="shadow-[var(--shadow-light)]">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
        <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
          操作记录
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            创建人
          </span>
          <span>{record.user?.name || '—'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            创建时间
          </span>
          <span>{createdAt}</span>
        </div>
        {updatedAt && (
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <span className="text-[hsl(var(--color-text-secondary))]">
              更新时间
            </span>
            <span>{updatedAt}</span>
          </div>
        )}
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            仓库位置
          </span>
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
  );
}

function BatchTraceCard({ batchNumber }: { batchNumber: string }) {
  return (
    <Card className="shadow-[var(--shadow-light)]">
      <CardHeader className="flex flex-col gap-3 border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base text-[hsl(var(--color-text-primary))]">
            批次追溯
          </CardTitle>
          <p className="text-xs text-[hsl(var(--color-text-secondary))]">
            查看批次 {batchNumber} 的完整库存流水
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link
            href={`/inventory/batch/${encodeURIComponent(batchNumber)}/history`}
          >
            查看批次历史
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-6 text-sm text-[hsl(var(--color-text-secondary))]">
        如需追溯该批次的完整入库、出库、调整轨迹，请使用上方链接跳转至批次库存流水页面。
      </CardContent>
    </Card>
  );
}

export default async function InboundRecordDetailPage({
  params,
}: {
  params: Promise<{ recordNumber: string }>;
}) {
  // ✅ 权限检查：要求用户拥有库存查看权限
  await requirePagePermission('inventory:view');

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
          <BackToInboundListButton />

          <InboundSummaryCard
            record={record}
            createdAt={createdAt}
            updatedAt={updatedAt}
            reasonLabel={reasonLabel}
            reasonVariant={reasonVariant}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ProductInfoCard record={record} />

          <OperationRecordCard
            record={record}
            createdAt={createdAt}
            updatedAt={updatedAt}
          />
        </div>

        {record.batchNumber ? (
          <BatchTraceCard batchNumber={record.batchNumber} />
        ) : null}
      </div>
    </div>
  );
}
