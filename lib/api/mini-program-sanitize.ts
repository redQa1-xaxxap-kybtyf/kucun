export const MINI_PROGRAM_SENSITIVE_KEYS = new Set([
  'quantity',
  'totalQuantity',
  'reservedQuantity',
  'availableQuantity',
  'unitCost',
  'totalCost',
  'stockValue',
  'cost',
  'remainingQty',
  'inventoryQty',
]);

export type StockStatus = 'out_of_stock' | 'low_stock' | 'in_stock';

export function computeStockStatusFromInventoryLike(input: {
  quantity?: unknown;
  totalQuantity?: unknown;
  reservedQuantity?: unknown;
  availableQuantity?: unknown;
}): StockStatus {
  const total =
    typeof input.totalQuantity === 'number'
      ? input.totalQuantity
      : typeof input.quantity === 'number'
        ? input.quantity
        : Number(input.totalQuantity ?? input.quantity ?? 0);

  const reserved =
    typeof input.reservedQuantity === 'number'
      ? input.reservedQuantity
      : Number(input.reservedQuantity ?? 0);

  const available =
    typeof input.availableQuantity === 'number'
      ? input.availableQuantity
      : total - reserved;

  const normalized = Number.isFinite(available) ? available : 0;
  const lowStockThreshold = 10;

  if (normalized <= 0) return 'out_of_stock';
  if (normalized <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

export function stripSensitiveKeysDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => stripSensitiveKeysDeep(item)) as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(obj)) {
    if (MINI_PROGRAM_SENSITIVE_KEYS.has(key)) {
      continue;
    }
    out[key] = stripSensitiveKeysDeep(item);
  }

  return out as T;
}
