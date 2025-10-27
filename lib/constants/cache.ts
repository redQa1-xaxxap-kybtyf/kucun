/**
 * Shared cache timing configuration across client and server layers.
 * Values follow TanStack Query and Redis guidance to keep UI freshness
 * aligned with server-side expirations.
 */
export const INVENTORY_ACTIVITY_STALE_TIME_MS = 30_000;
export const INVENTORY_ACTIVITY_GC_TIME_MS =
  INVENTORY_ACTIVITY_STALE_TIME_MS * 5;

export const FINANCE_RECEIVABLES_STALE_TIME_MS = 120_000;
export const FINANCE_CACHE_TTL_SECONDS = 180;
