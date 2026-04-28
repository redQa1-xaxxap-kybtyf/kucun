'use client';

import { Boxes, Eye, ImageIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { memo, useMemo } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { InventoryGroupedTable } from '@/components/inventory/InventoryGroupedTable';
import { Button } from '@/components/ui/button';
import type { Inventory } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import {
  groupInventoriesByProductCode,
  type InventoryProductGroup,
} from '@/lib/utils/inventory-product-grouping';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';
import { ProductDataUtils } from '@/lib/utils/product-data';

const VirtualizedInventoryTable = dynamic(
  () =>
    import('@/components/inventory/VirtualizedInventoryTable').then(
      mod => mod.VirtualizedInventoryTable
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
        加载表格中...
      </div>
    ),
  }
);

interface InventoryTableProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  useVirtualization?: boolean;
  /** ✅ 搜索关键词，用于区分无数据和搜索无结果 */
  searchQuery?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  density: 'compact' | 'comfortable';
}

function DesktopInventoryTable({
  data,
  onAdjust,
  useVirtualization,
  searchQuery,
  hasActiveFilters,
  onClearFilters,
  density,
}: InventoryTableProps) {
  // 虚拟化模式（大数据量时使用，不支持合并单元格）
  if (useVirtualization && data.length > 50) {
    return (
      <VirtualizedInventoryTable
        data={data}
        onAdjust={onAdjust}
        searchQuery={searchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        density={density}
      />
    );
  }

  // 使用支持合并单元格的分组表格
  return (
    <InventoryGroupedTable
      data={data}
      onAdjust={onAdjust}
      searchQuery={searchQuery}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      density={density}
    />
  );
}

function splitMobilePieceSummary(summary: string) {
  const normalized = summary.trim();
  const matched = normalized.match(/^(.*?)\s*\((.*?)\)\s*$/);

  if (!matched) {
    return {
      primary: normalized,
      secondary: null as string | null,
    };
  }

  return {
    primary: matched[1].trim(),
    secondary: matched[2].trim(),
  };
}

function InventoryMobileSummaryValue({
  summary,
  toneClassName,
  secondaryToneClassName,
}: {
  summary: string;
  toneClassName: string;
  secondaryToneClassName?: string;
}) {
  const { primary, secondary } = splitMobilePieceSummary(summary);

  return (
    <div className="mt-1 space-y-0.5">
      <div
        className={`text-sm leading-4 font-semibold whitespace-nowrap ${toneClassName}`}
      >
        {primary}
      </div>
      {secondary ? (
        <div
          className={`text-[10px] leading-3 whitespace-nowrap ${
            secondaryToneClassName ?? `${toneClassName} opacity-80`
          }`}
        >
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

function InventoryMobileBatchMeta({
  item,
  packaging,
}: {
  item: Inventory;
  packaging: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.location ? (
        <span className="rounded-full bg-white px-2 py-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
          库位 {item.location}
        </span>
      ) : null}
      {packaging > 0 ? (
        <span className="rounded-full bg-white px-2 py-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
          包装 {packaging}片/件
        </span>
      ) : null}
      {item.weight ? (
        <span className="rounded-full bg-white px-2 py-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
          重量 {item.weight.toFixed(2)}kg
        </span>
      ) : null}
      <span className="rounded-full bg-white px-2 py-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
        更新 <RelativeTime date={item.updatedAt} />
      </span>
    </div>
  );
}

function InventoryMobileBatchMetrics({
  item,
  packaging,
  unitLabel,
}: {
  item: Inventory;
  packaging: number;
  unitLabel: string;
}) {
  const available = Math.max(item.quantity - (item.reservedQuantity ?? 0), 0);
  const reservedQuantity = item.reservedQuantity ?? 0;

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg bg-white px-2.5 py-2">
        <div className="text-[11px] text-[hsl(var(--color-text-secondary))]">
          库存
        </div>
        <InventoryMobileSummaryValue
          summary={formatPieceSummary(item.quantity, packaging, {
            fallbackUnit: unitLabel,
          })}
          toneClassName="text-[hsl(var(--color-success))]"
        />
      </div>
      <div className="rounded-lg bg-white px-2.5 py-2">
        <div className="text-[11px] text-[hsl(var(--color-text-secondary))]">
          预留
        </div>
        <InventoryMobileSummaryValue
          summary={formatPieceSummary(reservedQuantity, packaging, {
            fallbackUnit: unitLabel,
            zeroDisplay: `0${unitLabel}`,
          })}
          toneClassName="text-[hsl(var(--color-warning))]"
        />
      </div>
      <div className="rounded-lg bg-white px-2.5 py-2">
        <div className="text-[11px] text-[hsl(var(--color-text-secondary))]">
          可用
        </div>
        <InventoryMobileSummaryValue
          summary={formatPieceSummary(available, packaging, {
            fallbackUnit: unitLabel,
            zeroDisplay: `0${unitLabel}`,
          })}
          toneClassName="text-[hsl(var(--color-primary))]"
        />
      </div>
    </div>
  );
}

function InventoryMobileBatchRow({
  item,
  onAdjust,
}: {
  item: Inventory;
  onAdjust: (id: string) => void;
}) {
  const rawUnit = item.product?.unit;
  const unitLabel =
    rawUnit && PRODUCT_UNIT_LABELS[rawUnit]
      ? PRODUCT_UNIT_LABELS[rawUnit]
      : '片';
  const packaging = item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? 0;

  return (
    <div
      data-testid="inventory-mobile-batch-row"
      className="rounded-md bg-[hsl(var(--color-bg-secondary))] p-2.5"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
              批号
            </div>
            <div className="mt-1 font-mono text-[11px] leading-4 break-all text-[hsl(var(--color-text-primary))]">
              {item.batchNumber || '常规库存'}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-1.5 text-[11px] text-[hsl(var(--color-text-secondary))]"
            onClick={() => onAdjust(item.id)}
            disabled={!item.batchNumber}
          >
            <Eye className="mr-1 h-3 w-3" />
            查看流水
          </Button>
        </div>

        <InventoryMobileBatchMeta item={item} packaging={packaging} />

        <InventoryMobileBatchMetrics
          item={item}
          packaging={packaging}
          unitLabel={unitLabel}
        />
      </div>
    </div>
  );
}

function InventoryMobileGroupCard({
  group,
  onAdjust,
}: {
  group: InventoryProductGroup;
  onAdjust: (id: string) => void;
}) {
  return (
    <div
      data-testid="inventory-mobile-group-card"
      className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {group.thumbnailUrl ? (
            <div className="relative h-12 w-12 overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))] bg-white">
              <Image
                src={group.thumbnailUrl}
                alt={group.productName || '产品'}
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
              <ImageIcon className="h-5 w-5 text-[hsl(var(--color-text-tertiary))]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-5 font-semibold text-[hsl(var(--color-text-primary))]">
                {group.productName}
              </div>
              <div className="mt-1 rounded-lg border border-[hsl(var(--color-border-primary))] bg-white px-2 py-1.5">
                <div className="text-[10px] font-medium text-[hsl(var(--color-text-secondary))]">
                  编码
                </div>
                <div className="mt-0.5 font-mono text-[11px] leading-4 font-semibold break-all text-[hsl(var(--color-text-primary))]">
                  {group.productCode}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-[hsl(var(--color-text-secondary))]">
                {ProductDataUtils.formatter.formatSpecification(
                  group.specification
                ) || '-'}
              </div>
            </div>
            <span className="rounded-full bg-[hsl(var(--color-primary-light))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--color-primary))]">
              {group.items.length} 个批号
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[hsl(var(--color-bg-secondary))] px-2.5 py-2">
              <div className="text-[11px] text-[hsl(var(--color-text-secondary))]">
                库存合计
              </div>
              <InventoryMobileSummaryValue
                summary={group.totalQuantityDisplay}
                toneClassName="text-[hsl(var(--color-success))]"
              />
            </div>
            <div className="rounded-lg bg-[hsl(var(--color-bg-secondary))] px-2.5 py-2">
              <div className="text-[11px] text-[hsl(var(--color-text-secondary))]">
                可用库存
              </div>
              <InventoryMobileSummaryValue
                summary={group.totalAvailableDisplay}
                toneClassName="text-[hsl(var(--color-primary))]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        {group.items.map(item => (
          <InventoryMobileBatchRow
            key={item.id}
            item={item}
            onAdjust={onAdjust}
          />
        ))}
      </div>
    </div>
  );
}

function InventoryMobileList({
  data,
  onAdjust,
  searchQuery,
  hasActiveFilters,
  onClearFilters,
}: Pick<
  InventoryTableProps,
  'data' | 'onAdjust' | 'searchQuery' | 'hasActiveFilters' | 'onClearFilters'
>) {
  const isFilteredEmpty = Boolean(searchQuery?.trim() || hasActiveFilters);
  const groups = useMemo(() => groupInventoriesByProductCode(data), [data]);

  if (data.length === 0) {
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

  return (
    <div className="space-y-3" data-testid="inventory-mobile-group-list">
      {groups.map(group => (
        <InventoryMobileGroupCard
          key={group.productCode}
          group={group}
          onAdjust={onAdjust}
        />
      ))}
    </div>
  );
}

function InventoryTableImpl({
  data,
  onAdjust,
  useVirtualization = false,
  searchQuery,
  hasActiveFilters,
  onClearFilters,
  density,
}: InventoryTableProps) {
  return (
    <>
      {/* 桌面端：表格视图 */}
      <div className="hidden lg:block">
        <DesktopInventoryTable
          data={data}
          onAdjust={onAdjust}
          useVirtualization={useVirtualization}
          searchQuery={searchQuery}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          density={density}
        />
      </div>

      {/* 移动端：卡片视图 */}
      <div className="lg:hidden">
        <InventoryMobileList
          data={data}
          onAdjust={onAdjust}
          searchQuery={searchQuery}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
        />
      </div>
    </>
  );
}

// ✅ 性能优化：避免搜索输入变更导致整表重渲染
// 仅当 data 引用、onAdjust 引用、useVirtualization 或 searchQuery 发生变化时才重新渲染
export const InventoryTable = memo(
  InventoryTableImpl,
  (prev, next) =>
    prev.data === next.data &&
    prev.onAdjust === next.onAdjust &&
    prev.useVirtualization === next.useVirtualization &&
    prev.useVirtualization === next.useVirtualization &&
    prev.searchQuery === next.searchQuery &&
    prev.hasActiveFilters === next.hasActiveFilters &&
    prev.density === next.density
);
