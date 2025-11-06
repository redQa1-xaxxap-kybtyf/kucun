/**
 * Shared cache timing configuration across client and server layers.
 * Values follow TanStack Query and Redis guidance to keep UI freshness
 * aligned with server-side expirations.
 */
export const INVENTORY_ACTIVITY_STALE_TIME_MS = 30_000;
export const INVENTORY_ACTIVITY_GC_TIME_MS =
  INVENTORY_ACTIVITY_STALE_TIME_MS * 5;

// 应收账款属于高频动态数据，需要在页面切换或窗口聚焦时立即获取最新状态
export const FINANCE_RECEIVABLES_STALE_TIME_MS = 0;
export const FINANCE_CACHE_TTL_SECONDS = 180;
