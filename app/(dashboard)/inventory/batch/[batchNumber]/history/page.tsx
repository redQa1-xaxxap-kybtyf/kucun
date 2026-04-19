import { Clock, Package, Tag } from 'lucide-react';

import { CopyableText } from '@/components/common/copyable-text';
import { BatchHistoryHeader } from '@/components/inventory/batch-history-header';
import { BatchHistorySummary } from '@/components/inventory/batch-history-summary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getBatchHistoryByNumber } from '@/lib/api/batch-history-server';
import { requirePagePermission } from '@/lib/auth/page-permission';
import { INBOUND_REASON_LABELS, type InboundReason } from '@/lib/types/inbound';
import {
  OUTBOUND_REASON_LABELS,
  getAdjustmentReasonLabel,
  type BatchHistoryResult,
  type BatchMovementGroup,
  type InventoryMovementEntry,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatNumber } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

const MOVEMENT_META: Record<
  InventoryMovementEntry['type'],
  { label: string; badge: 'success' | 'destructive' | 'secondary' }
> = {
  inbound: { label: '入库', badge: 'success' },
  outbound: { label: '出库', badge: 'destructive' },
  adjustment: { label: '库存调整', badge: 'secondary' },
};

type PageParams = { batchNumber: string };
type PageSearchParams = Record<string, string | string[] | undefined>;

interface BatchSummary {
  openingBalance?: number;
  currentQuantity?: number;
  netChange?: number;
  totalInbound: number;
  totalOutbound: number;
  totalAdjustment: number;
  totalRecords: number;
}

interface BatchViewModel {
  effectiveBatchNumber: string;
  product?: InventoryMovementEntry['product'];
  variant?: InventoryMovementEntry['variant'];
  summary: BatchSummary;
}

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseVariantParam = (value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === '' || value === 'null') {
    return null;
  }
  return value;
};

async function loadBatchHistory(
  params: PageParams,
  searchParams: PageSearchParams
) {
  await requirePagePermission('inventory:view');

  const rawBatchNumber = decodeURIComponent(params.batchNumber || '').trim();
  const inventoryId = getSingleParam(searchParams.inventoryId);
  const productId = getSingleParam(searchParams.productId);
  const variantId = parseVariantParam(getSingleParam(searchParams.variantId));

  const history = await getBatchHistoryByNumber(rawBatchNumber, {
    inventoryId,
    productId,
    variantId,
  });

  return {
    history,
    view: buildBatchViewModel(history, rawBatchNumber),
  };
}

const buildBatchViewModel = (
  history: BatchHistoryResult,
  fallbackBatchNumber: string
): BatchViewModel => {
  const primaryGroup = history.groups[0];

  const product = history.targetInventory?.product ?? primaryGroup?.product;
  const variant = history.targetInventory?.variant ?? primaryGroup?.variant;

  const currentQuantity =
    primaryGroup?.currentQuantity ?? history.targetInventory?.quantity;
  const openingBalance =
    primaryGroup?.openingBalance ?? history.targetInventory?.quantity;
  const netChange =
    primaryGroup?.netChange ??
    (openingBalance !== undefined && currentQuantity !== undefined
      ? currentQuantity - openingBalance
      : undefined);

  const summary: BatchSummary = {
    openingBalance,
    currentQuantity,
    netChange,
    totalInbound: primaryGroup?.totalInbound ?? 0,
    totalOutbound: primaryGroup?.totalOutbound ?? 0,
    totalAdjustment: primaryGroup?.totalAdjustment ?? 0,
    totalRecords: history.groups.reduce(
      (sum, group) => sum + group.movements.length,
      0
    ),
  };

  return {
    effectiveBatchNumber: history.batchNumber || fallbackBatchNumber || '—',
    product,
    variant,
    summary,
  };
};

export default async function BatchHistoryPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: PageSearchParams;
}) {
  const { history, view } = await loadBatchHistory(params, searchParams);

  return <BatchHistoryScreen history={history} view={view} />;
}

function resolveMovementReason(entry: InventoryMovementEntry) {
  if (!entry.reason) {
    return undefined;
  }

  if (entry.type === 'inbound') {
    return INBOUND_REASON_LABELS[entry.reason as InboundReason] ?? entry.reason;
  }

  if (entry.type === 'outbound') {
    return OUTBOUND_REASON_LABELS[entry.reason] ?? entry.reason;
  }

  return getAdjustmentReasonLabel(entry.reason);
}

function BatchHistoryScreen({
  history,
  view,
}: {
  history: BatchHistoryResult;
  view: BatchViewModel;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto bg-slate-50/30 p-4 sm:p-6 xl:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <BatchHistoryHeader
          batchNumber={view.effectiveBatchNumber}
          filteredInventoryId={history.filteredBy?.inventoryId}
        />

        <BatchHistorySummary summary={view.summary} />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <ProductInfoCard
              batchNumber={view.effectiveBatchNumber}
              product={view.product}
              variant={view.variant}
            />
          </div>
          <div className="xl:col-span-2">
            <MovementHistoryCard groups={history.groups} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductInfoCard({
  batchNumber,
  product,
  variant,
}: {
  batchNumber: string;
  product?: InventoryMovementEntry['product'];
  variant?: InventoryMovementEntry['variant'];
}) {
  const variantDisplay = variant
    ? variant.colorCode
      ? `${variant.colorCode}${
          variant.colorName ? ` - ${variant.colorName}` : ''
        }`
      : (variant.colorName ?? '—')
    : '—';

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <CardTitle className="flex items-center text-sm font-semibold text-slate-500">
          <Tag className="mr-2 h-4 w-4 text-violet-500" />
          核心产品信息
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <InfoField label="产品编码" value={product?.code || '—'} isPrimary />
          <InfoField label="产品名称" value={product?.name || '—'} />
          <InfoField label="规格" value={product?.specification || '—'} />
          <InfoField label="批次号" value={batchNumber || '—'} isBatch />
          {variant ? (
            <InfoField label="色号/变体" value={variantDisplay} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoField({
  label,
  value,
  isPrimary = false,
  isBatch = false,
}: {
  label: string;
  value: string;
  isPrimary?: boolean;
  isBatch?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-semibold text-slate-400">
        {label}
      </div>
      <div
        className={`font-semibold tracking-tight ${
          isPrimary
            ? 'text-lg text-slate-900'
            : isBatch
              ? 'text-sm text-amber-600'
              : 'text-sm text-slate-700'
        }`}
      >
        {isPrimary ? <CopyableText text={value} /> : value}
      </div>
    </div>
  );
}

function MovementHistoryCard({ groups }: { groups: BatchMovementGroup[] }) {
  const totalCount = groups.reduce(
    (sum, group) => sum + group.movements.length,
    0
  );

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-sm font-semibold text-slate-500">
            <Clock className="mr-2 h-4 w-4 text-emerald-500" />
            批次变动记录
          </CardTitle>
          <Badge className="bg-slate-900 text-[10px] font-semibold text-white">
            {totalCount} 条记录
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-slate-50 p-4">
              <Package className="h-8 w-8 text-slate-200" />
            </div>
            <p className="text-sm font-bold text-slate-400">
              当前批次尚未产生任何变动记录
            </p>
          </div>
        ) : (
          <MovementTable groups={groups} />
        )}
      </CardContent>
    </Card>
  );
}

function MovementTable({ groups }: { groups: BatchMovementGroup[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[860px] [&_th]:whitespace-nowrap">
        <TableHeader className="bg-slate-50/50">
          <TableRow className="border-b border-slate-100">
            <TableHead className="pl-6">
              时间
            </TableHead>
            <TableHead>
              类型
            </TableHead>
            <TableHead>
              单据编号
            </TableHead>
            <TableHead className="text-right">
              变动
            </TableHead>
            <TableHead className="text-right">
              余量
            </TableHead>
            <TableHead className="pr-6 text-right">
              操作人
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.flatMap(group =>
            group.movements.map(entry => (
              <MovementRow
                key={`${entry.type}-${entry.id}-${entry.createdAt}`}
                entry={entry}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MovementRow({ entry }: { entry: InventoryMovementEntry }) {
  const meta = MOVEMENT_META[entry.type];
  const piecesPerUnit =
    entry.batchPiecesPerUnit ?? entry.product?.piecesPerUnit ?? 0;
  const absChange = Math.abs(entry.quantityChange);
  const changePrefix =
    entry.quantityChange > 0 ? '+' : entry.quantityChange < 0 ? '-' : '';
  const changeColor =
    entry.quantityChange > 0
      ? 'text-emerald-600'
      : entry.quantityChange < 0
        ? 'text-rose-600'
        : 'text-slate-900';

  const changeDisplay =
    piecesPerUnit > 0
      ? formatPieceSummary(absChange, piecesPerUnit, { fallbackUnit: '片' })
      : `${formatNumber(absChange)}片`;

  const formatBalance = (value?: number) => {
    if (value === undefined) return '—';
    return piecesPerUnit > 0
      ? formatPieceSummary(value, piecesPerUnit, { fallbackUnit: '片' })
      : `${formatNumber(value)}片`;
  };

  const reasonLabel = resolveMovementReason(entry);

  return (
    <TableRow className="group border-b border-slate-50 transition-colors hover:bg-slate-50/50">
      <TableCell className="pl-6 whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-slate-900">
            {formatDateTimeCN(entry.createdAt).split(' ')[0]}
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            {formatDateTimeCN(entry.createdAt).split(' ')[1]}
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge
          variant={meta.badge}
          className="rounded-full px-2.5 py-0.5 text-[9px] font-semibold"
        >
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell className="min-w-[140px]">
        <div className="flex flex-col gap-1">
          <code className="text-[11px] font-semibold tracking-tight text-blue-600">
            {entry.recordNumber}
          </code>
          {reasonLabel && (
            <span className="max-w-[120px] truncate text-[10px] font-bold text-slate-400">
              {reasonLabel}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell
        className={`text-right text-xs font-semibold whitespace-nowrap tabular-nums ${changeColor}`}
      >
        {changePrefix}
        {changeDisplay}
      </TableCell>
      <TableCell className="text-right text-[11px] font-bold whitespace-nowrap text-slate-600 tabular-nums">
        {formatBalance(entry.balanceAfter)}
      </TableCell>
      <TableCell className="pr-6 text-right text-xs font-bold whitespace-nowrap text-slate-500">
        {entry.operator?.name || '—'}
      </TableCell>
    </TableRow>
  );
}
