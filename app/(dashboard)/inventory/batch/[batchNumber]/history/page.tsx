/* eslint-disable max-lines */
import { ActivitySquare, ArrowLeft, Clock, PackageSearch } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const formatChange = (value: number) =>
  `${value > 0 ? '+' : ''}${formatNumber(value)}`;

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

function BatchHistoryScreen({
  history,
  view,
}: {
  history: BatchHistoryResult;
  view: BatchViewModel;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-6">
        <BatchHeader
          batchNumber={view.effectiveBatchNumber}
          filteredInventoryId={history.filteredBy?.inventoryId}
        />
        <SummaryCards summary={view.summary} />
        <ProductInfoCard
          batchNumber={view.effectiveBatchNumber}
          product={view.product}
          variant={view.variant}
        />
        <MovementHistoryCard groups={history.groups} />
      </div>
    </div>
  );
}

function BatchHeader({
  batchNumber,
  filteredInventoryId,
}: {
  batchNumber: string;
  filteredInventoryId?: string;
}) {
  return (
    <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
              <PackageSearch className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                批次库存变动历史
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                <span className="font-medium">批次号：{batchNumber}</span>
                {filteredInventoryId && (
                  <Badge variant="outline">库存ID：{filteredInventoryId}</Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="lg" asChild className="h-11">
            <Link href="/inventory">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCards({ summary }: { summary: BatchSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="期初库存"
        value={
          summary.openingBalance !== undefined
            ? formatNumber(summary.openingBalance)
            : '—'
        }
        valueClassName="text-[hsl(var(--color-primary))]"
        caption="片"
      />
      <SummaryCard
        title="当前库存"
        value={
          summary.currentQuantity !== undefined
            ? formatNumber(summary.currentQuantity)
            : '—'
        }
        valueClassName="text-green-600"
        containerClassName="border-green-200 bg-green-50/50"
        caption="片"
      />
      <SummaryCard
        title="净变动"
        value={
          summary.netChange !== undefined
            ? formatChange(summary.netChange)
            : '—'
        }
        valueClassName="text-blue-600"
        containerClassName="border-blue-200 bg-blue-50/50"
        caption="片"
      />
      <SummaryCard title="变动汇总">
        <div className="mt-2 space-y-1 text-xs">
          <SummaryRow
            label="入库"
            value={`+${formatNumber(summary.totalInbound)}`}
            valueClassName="text-green-600"
          />
          <SummaryRow
            label="出库"
            value={`-${formatNumber(summary.totalOutbound)}`}
            valueClassName="text-red-600"
          />
          <SummaryRow
            label="调整"
            value={formatChange(summary.totalAdjustment)}
            valueClassName="text-orange-600"
          />
        </div>
      </SummaryCard>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  caption,
  valueClassName,
  containerClassName,
  children,
}: {
  title: string;
  value?: string;
  caption?: string;
  valueClassName?: string;
  containerClassName?: string;
  children?: ReactNode;
}) {
  return (
    <Card
      className={`card-shadow-light border border-[hsl(var(--color-border-primary))] ${containerClassName ?? ''}`}
    >
      <CardContent className="p-4">
        <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
          {title}
        </div>
        {value !== undefined ? (
          <>
            <div
              className={`mt-2 text-2xl font-bold ${valueClassName ?? 'text-[hsl(var(--color-text-primary))]'}`}
            >
              {value}
            </div>
            {caption ? (
              <div className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                {caption}
              </div>
            ) : null}
          </>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[hsl(var(--color-text-secondary))]">{label}</span>
      <span className={`font-semibold ${valueClassName}`}>{value}</span>
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
    <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
          <ActivitySquare className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
          产品信息
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="产品编码" value={product?.code || '—'} />
          <InfoField label="产品名称" value={product?.name || '—'} />
          <InfoField label="批次号" value={batchNumber || '—'} />
          {variant ? (
            <InfoField label="色号/变体" value={variantDisplay} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
        {label}
      </div>
      <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
        {value}
      </div>
    </div>
  );
}

function MovementHistoryCard({ groups }: { groups: BatchMovementGroup[] }) {
  return (
    <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
            <Clock className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
            变动历史
          </CardTitle>
          <div className="text-xs text-[hsl(var(--color-text-secondary))]">
            共{' '}
            <strong className="text-[hsl(var(--color-primary))]">
              {groups.reduce((sum, group) => sum + group.movements.length, 0)}
            </strong>{' '}
            条记录
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
        {groups.length === 0 ? (
          <div className="py-20 text-center text-sm text-[hsl(var(--color-text-secondary))]">
            当前批次尚未产生任何入库、出库或调整记录
          </div>
        ) : (
          <MovementTable groups={groups} />
        )}
      </CardContent>
    </Card>
  );
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

function MovementTable({ groups }: { groups: BatchMovementGroup[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="card-shadow-light border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]">
          <TableRow className="text-xs text-[hsl(var(--color-text-secondary))]">
            <TableHead className="px-4 py-3 text-left font-medium">
              时间
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium">
              类型
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium">
              单据编号
            </TableHead>
            <TableHead className="px-4 py-3 text-right font-medium">
              变动数量
            </TableHead>
            <TableHead className="px-4 py-3 text-right font-medium">
              操作前
            </TableHead>
            <TableHead className="px-4 py-3 text-right font-medium">
              操作后
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium">
              操作人
            </TableHead>
            <TableHead className="px-4 py-3 text-left font-medium">
              原因/备注
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
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
  // 优先使用批次级别的 piecesPerUnit，回退到产品级别，最后默认为 0
  // 批次级别：来自 BatchSpecification 表，更准确反映该批次的实际规格
  // 产品级别：来自 Product 表，作为默认值
  const piecesPerUnit =
    entry.batchPiecesPerUnit ?? entry.product?.piecesPerUnit ?? 0;
  const absChange = Math.abs(entry.quantityChange);
  const changePrefix =
    entry.quantityChange > 0 ? '+' : entry.quantityChange < 0 ? '-' : '';

  const changeDisplay =
    piecesPerUnit > 0
      ? formatPieceSummary(absChange, piecesPerUnit, { fallbackUnit: '片' })
      : `${formatNumber(absChange)}片`;

  const formatBalance = (value?: number) => {
    if (value === undefined) {
      return '—';
    }
    return piecesPerUnit > 0
      ? formatPieceSummary(value, piecesPerUnit, { fallbackUnit: '片' })
      : `${formatNumber(value)}片`;
  };
  const reasonLabel = resolveMovementReason(entry);

  return (
    <TableRow className="transition-colors hover:bg-gray-50/50">
      <TableCell className="px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]">
        {formatDateTimeCN(entry.createdAt)}
      </TableCell>
      <TableCell className="px-4 py-3">
        <Badge variant={meta.badge} className="text-xs">
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-3">
        <code className="font-mono text-sm text-[hsl(var(--color-primary))]">
          {entry.recordNumber}
        </code>
      </TableCell>
      <TableCell className="px-4 py-3 text-right font-semibold text-gray-900">
        {changePrefix}
        {changeDisplay}
      </TableCell>
      <TableCell className="px-4 py-3 text-right text-gray-700">
        {formatBalance(entry.balanceBefore)}
      </TableCell>
      <TableCell className="px-4 py-3 text-right text-gray-700">
        {formatBalance(entry.balanceAfter)}
      </TableCell>
      <TableCell className="px-4 py-3 text-sm text-gray-700">
        {entry.operator?.name || '—'}
      </TableCell>
      <TableCell className="px-4 py-3">
        <div className="max-w-xs">
          <div className="text-sm text-[hsl(var(--color-text-secondary))]">
            {reasonLabel ?? entry.reason ?? '—'}
          </div>
          {entry.referenceNumber ? (
            <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
              关联：{entry.referenceNumber}
            </div>
          ) : null}
          {entry.remarks ? (
            <div className="mt-0.5 text-xs text-[hsl(var(--color-text-tertiary))]">
              {entry.remarks}
            </div>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
