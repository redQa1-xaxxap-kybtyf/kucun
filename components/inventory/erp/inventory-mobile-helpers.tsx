'use client';

import { RelativeTime } from '@/components/common/relative-time';
import { Badge } from '@/components/ui/badge';
import type { Inventory } from '@/lib/types/inventory';
import { getInventoryStatus } from '@/lib/types/inventory-status';
import { formatInventoryBatchBadgeLabel } from '@/lib/utils/inventory-group-display';
import type { InventoryProductGroup } from '@/lib/utils/inventory-product-grouping';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';

export interface QuantityParts {
  primary: string;
  secondary?: string;
}

/**
 * 移动端数量呈现：以"件 + 片"为主、"共 N 片"为辅，符合中国仓管口径。
 */
export function formatMobileQuantityParts(
  totalPieces: number,
  piecesPerUnit: number
): QuantityParts {
  if (!Number.isFinite(totalPieces) || totalPieces <= 0) {
    return { primary: '0片' };
  }

  if (
    !Number.isInteger(piecesPerUnit) ||
    piecesPerUnit <= 1 ||
    !Number.isInteger(totalPieces)
  ) {
    return { primary: `${totalPieces}片` };
  }

  const breakdown = calculatePieceDisplay(totalPieces, piecesPerUnit);
  if (breakdown.fullUnits === 0) {
    return { primary: `${breakdown.totalPieces}片` };
  }

  return {
    primary: breakdown.displayText,
    secondary: `共 ${breakdown.totalPieces} 片`,
  };
}

export function resolveGroupPiecesPerUnit(
  group: InventoryProductGroup
): number {
  const set = new Set(
    group.items
      .map(item => item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? 0)
      .filter(value => Number.isInteger(value) && value > 1)
  );
  return set.size === 1 ? Array.from(set)[0] : 0;
}

export function MobileBatchBadgeText({
  batchNumber,
}: {
  batchNumber?: string | null;
}) {
  const label = formatInventoryBatchBadgeLabel(batchNumber);
  if (label === '常规') {
    return <span>常规库存</span>;
  }
  if (label.length <= 4) {
    return <span className="font-bold">{label}</span>;
  }
  return (
    <>
      <span>{label.slice(0, label.length - 4)}</span>
      <span className="font-bold">{label.slice(-4)}</span>
    </>
  );
}

export function StockHealthBadge({
  totalQuantity,
  reservedQuantity,
}: {
  totalQuantity: number;
  reservedQuantity: number;
}) {
  const { label, variant } = getInventoryStatus(
    totalQuantity,
    reservedQuantity
  );
  const breathe =
    variant === 'destructive' || variant === 'warning' ? 'animate-breathe' : '';
  return (
    <Badge
      variant={variant}
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold ${breathe}`}
    >
      {label}
    </Badge>
  );
}

export function InventoryMobileMetric({
  label,
  primary,
  secondary,
  toneClassName,
  emphasized,
}: {
  label: string;
  primary: string;
  secondary?: string;
  toneClassName: string;
  emphasized?: boolean;
}) {
  const valueClass = emphasized ? 'text-base leading-5' : 'text-sm leading-5';
  return (
    <div className="rounded-md bg-white px-2.5 py-1.5">
      <div className="text-[11px] leading-4 text-[hsl(var(--color-text-secondary))]">
        {label}
      </div>
      <div
        className={`mt-0.5 font-semibold tabular-nums whitespace-nowrap ${toneClassName} ${valueClass}`}
      >
        {primary}
      </div>
      {secondary ? (
        <div className="text-[11px] leading-3 tabular-nums text-[hsl(var(--color-text-secondary))]">
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

export function InventoryMobileBatchMeta({
  item,
  packaging,
}: {
  item: Inventory;
  packaging: number;
}) {
  const chip =
    'rounded-full bg-[hsl(var(--color-bg-tertiary))] px-2 py-0.5 text-[11px] leading-4 text-[hsl(var(--color-text-secondary))]';
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.location ? <span className={chip}>库位 {item.location}</span> : null}
      {packaging > 0 ? <span className={chip}>{packaging} 片/件</span> : null}
      {item.weight ? (
        <span className={chip}>{item.weight.toFixed(2)} kg</span>
      ) : null}
      <span className={chip}>
        更新 <RelativeTime date={item.updatedAt} />
      </span>
    </div>
  );
}
