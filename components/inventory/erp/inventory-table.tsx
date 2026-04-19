'use client';

import { Boxes, Eye, ImageIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { memo } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { InventoryGroupedTable } from '@/components/inventory/InventoryGroupedTable';
import { Button } from '@/components/ui/button';
import type { Inventory } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
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
    <div className="space-y-3">
      {data.map(item => {
        const rawUnit = item.product?.unit;
        const unitLabel =
          rawUnit && PRODUCT_UNIT_LABELS[rawUnit]
            ? PRODUCT_UNIT_LABELS[rawUnit]
            : '片';

        const packaging =
          item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? 0;

        const available =
          item.quantity - (item.reservedQuantity ?? 0) > 0
            ? item.quantity - (item.reservedQuantity ?? 0)
            : 0;

        const reservedQuantity = item.reservedQuantity ?? 0;

        return (
          <div
            key={item.id}
            className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4"
          >
            <div className="flex items-start gap-3">
              {/* 产品缩略图 */}
              <div className="shrink-0">
                {item.product?.thumbnailUrl ? (
                  <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-[hsl(var(--color-border-secondary))] bg-white">
                    <Image
                      src={item.product.thumbnailUrl}
                      alt={item.product.name || '产品'}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
                    <ImageIcon className="h-5 w-5 text-[hsl(var(--color-text-tertiary))]" />
                  </div>
                )}
              </div>

              {/* 产品信息 */}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                  {item.product?.code || '未知编码'}
                </div>
                <div className="mt-0.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {item.product?.name || '未知产品'}
                </div>
                <div className="mt-1 line-clamp-1 text-xs text-[hsl(var(--color-text-secondary))]">
                  规格：
                  {ProductDataUtils.formatter.formatSpecification(
                    item.product?.specification
                  ) || '-'}
                </div>
                {(packaging > 0 || item.weight) && (
                  <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                    {packaging > 0 && (
                      <>
                        包装：
                        <span className="font-medium text-[hsl(var(--color-text-primary))]">
                          {packaging}片/件
                        </span>
                      </>
                    )}
                    {packaging > 0 && item.weight && (
                      <span className="mx-1 text-[hsl(var(--color-border-primary))]">
                        |
                      </span>
                    )}
                    {item.weight && (
                      <>
                        重量：
                        <span className="font-medium text-[hsl(var(--color-text-primary))]">
                          {item.weight.toFixed(2)}kg
                        </span>
                      </>
                    )}
                  </div>
                )}
                {item.location && (
                  <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                    库位：{item.location}
                  </div>
                )}
                {item.batchNumber && (
                  <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                    批次：{item.batchNumber}
                  </div>
                )}
              </div>

              {/* 更新时间 */}
              <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                <div>最后更新</div>
                <div className="mt-0.5">
                  <RelativeTime date={item.updatedAt} />
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-[hsl(var(--color-bg-secondary))] p-3">
              <div className="grid grid-cols-2 gap-3 text-xs text-[hsl(var(--color-text-secondary))]">
                <div>
                  <div>可用数量</div>
                  <div className="mt-0.5 font-semibold text-[hsl(var(--color-primary))]">
                    {formatPieceSummary(available, packaging, {
                      fallbackUnit: unitLabel,
                      zeroDisplay: `0${unitLabel}`,
                    })}
                  </div>
                </div>
                <div>
                  <div>库存总量</div>
                  <div className="mt-0.5 font-semibold text-[hsl(var(--color-success))]">
                    {formatPieceSummary(item.quantity, packaging, {
                      fallbackUnit: unitLabel,
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-[hsl(var(--color-border-primary))] pt-3 text-xs">
                <span className="text-[hsl(var(--color-text-secondary))]">
                  预留数量：
                </span>
                <span className="ml-1 font-medium text-[hsl(var(--color-warning))]">
                  {formatPieceSummary(reservedQuantity, packaging, {
                    fallbackUnit: unitLabel,
                    zeroDisplay: `0${unitLabel}`,
                  })}
                </span>
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => onAdjust(item.id)}
              >
                <Eye className="mr-1 h-3 w-3" />
                查看流水
              </Button>
            </div>
          </div>
        );
      })}
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
      <div className="hidden xl:block">
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
      <div className="xl:hidden">
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
