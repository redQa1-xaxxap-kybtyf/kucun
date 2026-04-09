import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InboundSummaryCard } from '@/components/inventory/inbound-summary-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getInboundRecordByNumber } from '@/lib/api/inbound-server';
import { requirePagePermission } from '@/lib/auth/page-permission';
import {
  INBOUND_DAMAGE_HANDLING_LABELS,
  INBOUND_REASON_LABELS,
  type InboundRecordDetail,
} from '@/lib/types/inbound';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

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

function getInboundPiecesPerUnit(record: InboundRecordDetail) {
  return (
    record.batchSpecification?.piecesPerUnit ??
    record.product?.piecesPerUnit ??
    0
  );
}

function formatInboundQuantity(record: InboundRecordDetail, quantity: number) {
  const piecesPerUnit = getInboundPiecesPerUnit(record);
  return piecesPerUnit > 0
    ? formatPieceSummary(quantity, piecesPerUnit, { fallbackUnit: '片' })
    : `${quantity}片`;
}

// SummaryCard 已移至客户端组件 InboundSummaryCard

function ProductInfoCard({ record }: { record: InboundRecordDetail }) {
  const piecesPerUnit = getInboundPiecesPerUnit(record);

  return (
    <Card className="border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <CardHeader className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
        <CardTitle className="text-sm font-black tracking-widest text-slate-500 uppercase italic">
          核心产品参数
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 px-4 pt-4 pb-6 text-sm sm:px-6 sm:pt-6">
        <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            产品编码
          </span>
          <span className="font-bold text-[hsl(var(--color-text-primary))]">
            {record.product?.code || '—'}
          </span>
        </div>
        <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            产品名称
          </span>
          <span>{record.product?.name || '—'}</span>
        </div>
        <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">规格</span>
          <span>{record.product?.specification || '—'}</span>
        </div>
        <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-2">
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
        <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-2">
          <span className="text-[hsl(var(--color-text-secondary))]">
            包装规格
          </span>
          <span className="font-bold text-blue-600">
            {piecesPerUnit > 0 ? `${piecesPerUnit} 片/件` : '—'}
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
  const acceptedQuantity = formatInboundQuantity(record, record.quantity);
  const damagedQuantity = record.damagedQuantity ?? 0;
  const hasDamage = damagedQuantity > 0;
  const arrivalQuantity = formatInboundQuantity(
    record,
    record.quantity + damagedQuantity
  );
  const damageHandlingLabel =
    record.damageHandling &&
    INBOUND_DAMAGE_HANDLING_LABELS[record.damageHandling]
      ? INBOUND_DAMAGE_HANDLING_LABELS[record.damageHandling]
      : null;

  return (
    <Card className="border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <CardHeader className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
        <CardTitle className="text-sm font-black tracking-widest text-slate-500 uppercase italic">
          系统记账存证
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 text-sm sm:p-6">
        <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            经办人员
          </span>
          <span className="font-bold text-slate-900">
            {record.user?.name || '—'}
          </span>
        </div>
        <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            初始记账
          </span>
          <span className="font-mono text-xs text-slate-500">{createdAt}</span>
        </div>
        {updatedAt && (
          <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
            <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
              最后变更
            </span>
            <span className="font-mono text-xs text-slate-500">
              {updatedAt}
            </span>
          </div>
        )}
        <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            库位指引
          </span>
          <span className="font-bold text-slate-700">
            {record.location || '—'}
          </span>
        </div>
        <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            导入批次
          </span>
          <span className="font-mono text-xs text-slate-600">
            {record.openingImportBatchId || '—'}
          </span>
        </div>
        <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            系统入库
          </span>
          <span className="font-bold text-slate-900">{acceptedQuantity}</span>
        </div>
        {hasDamage ? (
          <>
            <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
              <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
                到货总量
              </span>
              <span className="font-bold text-slate-900">
                {arrivalQuantity}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
              <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
                到货破损
              </span>
              <span className="font-bold text-amber-700">
                {formatInboundQuantity(record, damagedQuantity)}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-2">
              <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
                处理方式
              </span>
              <span className="font-bold text-slate-700">
                {damageHandlingLabel || '—'}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:gap-2">
              <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
                破损说明
              </span>
              <span className="text-xs text-slate-500 italic">
                {record.damageRemarks || '（无破损说明）'}
              </span>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-800">
              记账口径说明：库存与 FIFO
              仅按“系统入库”入账，到货破损单独登记用于赔付追踪或内部损耗统计。
            </div>
          </>
        ) : null}
        <div className="grid gap-1 border-t border-slate-50 pt-2 sm:grid-cols-[100px_1fr] sm:gap-2">
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
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-6 sm:py-5 xl:flex-row xl:items-center xl:justify-between">
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
      <CardContent className="p-4 text-xs text-slate-400 italic sm:p-6">
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
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-12 sm:space-y-6 sm:p-6">
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

        <div className="grid gap-6 xl:grid-cols-2">
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
