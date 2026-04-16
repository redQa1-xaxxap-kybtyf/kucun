import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface InventoryGroupDisplayProductLike {
  piecesPerUnit?: number | null;
}

interface InventoryGroupDisplayItemLike {
  quantity?: number | null;
  reservedQuantity?: number | null;
  batchPiecesPerUnit?: number | null;
  product?: InventoryGroupDisplayProductLike | null;
}

function normalizeInteger(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.floor(numeric);
}

export function getInventoryItemPiecesPerUnit(
  item: InventoryGroupDisplayItemLike
): number | undefined {
  const piecesPerUnit = normalizeInteger(
    item.batchPiecesPerUnit ?? item.product?.piecesPerUnit
  );

  return piecesPerUnit > 0 ? piecesPerUnit : undefined;
}

function resolveUniformPiecesPerUnit(
  items: InventoryGroupDisplayItemLike[]
): number | undefined {
  const uniquePiecesPerUnit = Array.from(
    new Set(
      items
        .map(item => getInventoryItemPiecesPerUnit(item))
        .filter(
          (piecesPerUnit): piecesPerUnit is number =>
            typeof piecesPerUnit === 'number' && piecesPerUnit > 1
        )
    )
  );

  return uniquePiecesPerUnit.length === 1 ? uniquePiecesPerUnit[0] : undefined;
}

export function getInventoryGroupTotalPieces(
  items: InventoryGroupDisplayItemLike[],
  mode: 'quantity' | 'available'
): number {
  return items.reduce((sum, item) => {
    const quantity = normalizeInteger(item.quantity);

    if (mode === 'quantity') {
      return sum + quantity;
    }

    const reserved = normalizeInteger(item.reservedQuantity);
    return sum + Math.max(quantity - reserved, 0);
  }, 0);
}

export function formatInventoryGroupSummary(
  items: InventoryGroupDisplayItemLike[],
  mode: 'quantity' | 'available'
): string {
  const totalPieces = getInventoryGroupTotalPieces(items, mode);
  const piecesPerUnit = resolveUniformPiecesPerUnit(items);

  if (!piecesPerUnit || piecesPerUnit <= 1) {
    return `${totalPieces}片`;
  }

  return formatPieceSummary(totalPieces, piecesPerUnit, {
    fallbackUnit: '片',
    zeroDisplay: '0片',
  });
}
