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
    <Card className="border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <CardTitle className="text-sm font-black tracking-widest text-slate-500 uppercase italic">
          核心产品参数
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            产品编码
          </span>
          <span className="font-bold text-[hsl(var(--color-text-primary))]">
            {record.product?.code || '—'}
          </span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            产品名称
          </span>
          <span>{record.product?.name || '—'}</span>
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
            包装规格
          </span>
          <span className="font-bold text-blue-600">
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
    <Card className="border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <CardHeader className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <CardTitle className="text-sm font-black tracking-widest text-slate-500 uppercase italic">
          系统记账存证
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 text-sm">
        <div className="grid grid-cols-[100px_1fr] items-center gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            经办人员
          </span>
          <span className="font-bold text-slate-900">
            {record.user?.name || '—'}
          </span>
        </div>
        <div className="grid grid-cols-[100px_1fr] items-center gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            初始记账
          </span>
          <span className="font-mono text-xs text-slate-500">{createdAt}</span>
        </div>
        {updatedAt && (
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
              最后变更
            </span>
            <span className="font-mono text-xs text-slate-500">
              {updatedAt}
            </span>
          </div>
        )}
        <div className="grid grid-cols-[100px_1fr] items-center gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            库位指引
          </span>
          <span className="font-bold text-slate-700">
            {record.location || '—'}
          </span>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2 border-t border-slate-50 pt-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            备注摘要
          </span>
          <span className="text-xs text-slate-500 italic">
            {record.remarks || '（无备注内容）'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function BatchTraceCard({ batchNumber }: { batchNumber: string }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-sm font-black tracking-widest text-slate-500 uppercase italic">
            批次效期追溯
          </CardTitle>
          <p className="mt-1 text-xs font-bold text-slate-400">
            追踪批次 {batchNumber} 的完整库存生命周期流水
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-9 border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600"
        >
          <Link
            href={`/inventory/batch/${encodeURIComponent(batchNumber)}/history`}
          >
            查看全链路流水
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-6 text-xs text-slate-400 italic">
        通过点击右上角链接，您可以多维度追溯该批次产品的入库、出库、调拨及库存调整轨迹。
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
