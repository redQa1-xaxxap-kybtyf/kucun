'use client';

import { Boxes, ChevronDown, ChevronUp, Eye, ImageIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import {
  formatMobileQuantityParts,
  InventoryMobileBatchMeta,
  InventoryMobileMetric,
  MobileBatchBadgeText,
  resolveGroupPiecesPerUnit,
  StockHealthBadge,
} from '@/components/inventory/erp/inventory-mobile-helpers';
import { Button } from '@/components/ui/button';
import type { Inventory } from '@/lib/types/inventory';
import { formatCostPrice } from '@/lib/utils/cost-price';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils/format';
import { shouldBypassImageOptimization } from '@/lib/utils/image';
import {
  groupInventoriesByProductCode,
  type InventoryProductGroup,
} from '@/lib/utils/inventory-product-grouping';
import { ProductDataUtils } from '@/lib/utils/product-data';

export interface InventoryMobileListProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  searchQuery?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  showFinance: boolean;
}

function InventoryBatchHeader({
  item,
  index,
  total,
  reservedQuantity,
}: {
  item: Inventory;
  index: number;
  total: number;
  reservedQuantity: number;
}) {
  const sequenceLabel =
    total > 1
      ? index === 0
        ? '最近批次'
        : `批次 ${index + 1}/${total}`
      : null;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="inline-flex max-w-[180px] items-center truncate rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 font-mono text-[12px] leading-4 text-amber-700">
          <MobileBatchBadgeText batchNumber={item.batchNumber} />
        </span>
        {sequenceLabel ? (
          <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] leading-4 text-[hsl(var(--color-text-secondary))]">
            {sequenceLabel}
          </span>
        ) : null}
      </div>
      <StockHealthBadge
        totalQuantity={item.quantity}
        reservedQuantity={reservedQuantity}
      />
    </div>
  );
}

function InventoryBatchMetrics({
  item,
  packaging,
}: {
  item: Inventory;
  packaging: number;
}) {
  const reservedQuantity = item.reservedQuantity ?? 0;
  const available = Math.max(item.quantity - reservedQuantity, 0);
  const totalParts = formatMobileQuantityParts(item.quantity, packaging);
  const reservedParts = formatMobileQuantityParts(reservedQuantity, packaging);
  const availableParts = formatMobileQuantityParts(available, packaging);
  const reservedTone =
    reservedQuantity > 0
      ? 'text-[hsl(var(--color-warning))]'
      : 'text-[hsl(var(--color-text-tertiary))]';
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-1.5">
      <InventoryMobileMetric
        label="可用"
        primary={availableParts.primary}
        secondary={availableParts.secondary}
        toneClassName="text-[hsl(var(--color-primary))]"
        emphasized
      />
      <InventoryMobileMetric
        label="库存"
        primary={totalParts.primary}
        secondary={totalParts.secondary}
        toneClassName="text-[hsl(var(--color-text-primary))]"
      />
      <InventoryMobileMetric
        label="预留"
        primary={reservedParts.primary}
        secondary={reservedQuantity > 0 ? reservedParts.secondary : undefined}
        toneClassName={reservedTone}
      />
    </div>
  );
}

function InventoryBatchValueRow({ item }: { item: Inventory }) {
  if (item.unitCost === null || item.unitCost === undefined) return null;
  const goodsValue = item.quantity * item.unitCost;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-white px-2.5 py-1.5 text-[11px] leading-4">
      <span className="text-[hsl(var(--color-text-secondary))]">
        成本{' '}
        <span className="text-[hsl(var(--color-text-primary))] tabular-nums">
          {formatCostPrice(item.unitCost)}
        </span>
      </span>
      <span
        className="ml-auto font-semibold text-[hsl(var(--color-text-primary))] tabular-nums"
        title={formatCurrency(goodsValue)}
      >
        货值 {formatCurrencyCompact(goodsValue)}
      </span>
    </div>
  );
}

function InventoryBatchFooter({
  item,
  onAdjust,
}: {
  item: Inventory;
  onAdjust: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] leading-4 text-[hsl(var(--color-text-tertiary))]">
        {item.batchNumber ? '点击查看批次流水' : '常规库存暂无独立流水'}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-9 shrink-0 rounded-md px-3 text-xs font-medium"
        onClick={event => {
          event.stopPropagation();
          if (item.batchNumber) onAdjust(item.id);
        }}
        disabled={!item.batchNumber}
      >
        <Eye className="mr-1 h-3.5 w-3.5" />
        查看流水
      </Button>
    </div>
  );
}

function InventoryMobileBatchRow({
  item,
  index,
  total,
  onAdjust,
  showFinance,
}: {
  item: Inventory;
  index: number;
  total: number;
  onAdjust: (id: string) => void;
  showFinance: boolean;
}) {
  const packaging = item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? 0;
  const reservedQuantity = item.reservedQuantity ?? 0;
  const handleClick = () => {
    if (item.batchNumber) onAdjust(item.id);
  };
  const cursorClass = item.batchNumber
    ? 'cursor-pointer active:bg-[hsl(var(--color-bg-tertiary))]'
    : '';
  return (
    <div
      data-testid="inventory-mobile-batch-row"
      role={item.batchNumber ? 'button' : undefined}
      tabIndex={item.batchNumber ? 0 : -1}
      onClick={handleClick}
      onKeyDown={event => {
        if (!item.batchNumber) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAdjust(item.id);
        }
      }}
      className={`space-y-2 rounded-md bg-[hsl(var(--color-bg-secondary))] p-2.5 transition-colors ${cursorClass}`}
    >
      <InventoryBatchHeader
        item={item}
        index={index}
        total={total}
        reservedQuantity={reservedQuantity}
      />
      <InventoryBatchMetrics item={item} packaging={packaging} />
      {showFinance ? <InventoryBatchValueRow item={item} /> : null}
      <InventoryMobileBatchMeta item={item} packaging={packaging} />
      <InventoryBatchFooter item={item} onAdjust={onAdjust} />
    </div>
  );
}

function InventoryGroupThumbnail({ group }: { group: InventoryProductGroup }) {
  if (group.thumbnailUrl) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] bg-white">
        <Image
          src={group.thumbnailUrl}
          alt={group.productName || '产品'}
          fill
          className="object-cover"
          sizes="56px"
          unoptimized={shouldBypassImageOptimization(group.thumbnailUrl)}
        />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
      <ImageIcon className="h-5 w-5 text-[hsl(var(--color-text-tertiary))]" />
    </div>
  );
}

function InventoryGroupIdentity({ group }: { group: InventoryProductGroup }) {
  const totalReserved = group.items.reduce(
    (sum, item) => sum + (item.reservedQuantity ?? 0),
    0
  );
  const specificationText = ProductDataUtils.formatter.formatSpecification(
    group.specification
  );
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div
          className="font-mono text-[13px] leading-5 font-semibold break-all text-[hsl(var(--color-text-primary))]"
          title={group.productCode}
        >
          {group.productCode}
        </div>
        <StockHealthBadge
          totalQuantity={group.totalPieces}
          reservedQuantity={totalReserved}
        />
      </div>
      <div
        className="mt-0.5 line-clamp-2 text-xs leading-4 text-[hsl(var(--color-text-secondary))]"
        title={group.productName}
      >
        {group.productName}
      </div>
      {specificationText ? (
        <div className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-[hsl(var(--color-text-tertiary))]">
          {specificationText}
        </div>
      ) : null}
      {group.items.length > 1 ? (
        <div className="mt-1.5">
          <span className="inline-flex items-center rounded-full bg-[hsl(var(--color-primary-light))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--color-primary))]">
            共 {group.items.length} 批次
          </span>
        </div>
      ) : null}
    </div>
  );
}

function InventoryGroupSummary({
  group,
  showFinance,
}: {
  group: InventoryProductGroup;
  showFinance: boolean;
}) {
  if (group.items.length <= 1) return null;
  const piecesPerUnit = resolveGroupPiecesPerUnit(group);
  const totalParts = formatMobileQuantityParts(
    group.totalPieces,
    piecesPerUnit
  );
  const availableParts = formatMobileQuantityParts(
    group.totalAvailablePieces,
    piecesPerUnit
  );
  const goodsValue =
    showFinance &&
    group.items.some(
      item => item.unitCost !== null && item.unitCost !== undefined
    )
      ? group.items.reduce(
          (sum, item) =>
            sum +
            (item.unitCost !== null && item.unitCost !== undefined
              ? item.unitCost * item.quantity
              : 0),
          0
        )
      : null;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <InventoryMobileMetric
        label="可用合计"
        primary={availableParts.primary}
        secondary={availableParts.secondary}
        toneClassName="text-[hsl(var(--color-primary))]"
        emphasized
      />
      <InventoryMobileMetric
        label="库存合计"
        primary={totalParts.primary}
        secondary={totalParts.secondary}
        toneClassName="text-[hsl(var(--color-success))]"
        emphasized
      />
      {goodsValue !== null ? (
        <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-white px-2.5 py-1.5 text-[11px] leading-4">
          <span className="text-[hsl(var(--color-text-secondary))]">
            批次合计货值
          </span>
          <span
            className="ml-auto font-semibold text-[hsl(var(--color-text-primary))] tabular-nums"
            title={formatCurrency(goodsValue)}
          >
            {formatCurrencyCompact(goodsValue)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function InventoryGroupExpandToggle({
  total,
  expanded,
  onToggle,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (total <= 1) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[hsl(var(--color-border-primary))] py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] transition-colors active:bg-[hsl(var(--color-bg-secondary))]"
    >
      {expanded ? (
        <>
          <ChevronUp className="h-3.5 w-3.5" />
          收起其余 {total - 1} 批
        </>
      ) : (
        <>
          <ChevronDown className="h-3.5 w-3.5" />
          展开全部 {total} 批
        </>
      )}
    </button>
  );
}

function InventoryMobileGroupCard({
  group,
  onAdjust,
  showFinance,
}: {
  group: InventoryProductGroup;
  onAdjust: (id: string) => void;
  showFinance: boolean;
}) {
  const isMultiBatch = group.items.length > 1;
  const [expanded, setExpanded] = useState(!isMultiBatch);
  const visibleItems = expanded ? group.items : group.items.slice(0, 1);
  return (
    <div
      data-testid="inventory-mobile-group-card"
      className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <InventoryGroupThumbnail group={group} />
        <InventoryGroupIdentity group={group} />
      </div>
      {isMultiBatch ? (
        <div className="mt-2.5">
          <InventoryGroupSummary group={group} showFinance={showFinance} />
        </div>
      ) : null}
      <div className="mt-2.5 space-y-2">
        {visibleItems.map((item, index) => (
          <InventoryMobileBatchRow
            key={item.id}
            item={item}
            index={index}
            total={group.items.length}
            onAdjust={onAdjust}
            showFinance={showFinance}
          />
        ))}
      </div>
      <InventoryGroupExpandToggle
        total={group.items.length}
        expanded={expanded}
        onToggle={() => setExpanded(prev => !prev)}
      />
    </div>
  );
}

function InventoryMobileEmpty({
  isFilteredEmpty,
  onClearFilters,
}: {
  isFilteredEmpty: boolean;
  onClearFilters?: () => void;
}) {
  return (
    <EmptyState
      title={isFilteredEmpty ? '未找到匹配的库存记录' : '暂无库存数据'}
      description={
        isFilteredEmpty
          ? '请调整关键词或筛选条件后再试。'
          : '还没有任何库存记录，您可以先进行产品入库。'
      }
      icon={<Boxes className="text-muted-foreground h-6 w-6" />}
      action={
        isFilteredEmpty ? (
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              清空条件
            </Button>
          ) : null
        ) : (
          <Button size="sm" asChild>
            <Link href="/inventory/inbound/create">去入库</Link>
          </Button>
        )
      }
      compact
    />
  );
}

export function InventoryMobileList({
  data,
  onAdjust,
  searchQuery,
  hasActiveFilters,
  onClearFilters,
  showFinance,
}: InventoryMobileListProps) {
  if (data.length === 0) {
    return (
      <InventoryMobileEmpty
        isFilteredEmpty={Boolean(searchQuery?.trim() || hasActiveFilters)}
        onClearFilters={onClearFilters}
      />
    );
  }
  const groups = groupInventoriesByProductCode(data);
  return (
    <div className="space-y-3" data-testid="inventory-mobile-group-list">
      {groups.map(group => (
        <InventoryMobileGroupCard
          key={group.productCode}
          group={group}
          onAdjust={onAdjust}
          showFinance={showFinance}
        />
      ))}
    </div>
  );
}
