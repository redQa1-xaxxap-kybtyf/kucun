/**
 * 仪表盘缓存配置（Client-safe）
 *
 * 说明：
 * - 客户端代码不要从 `@/lib/env` 引用：`lib/env.ts` 依赖 Zod 且包含服务端环境变量校验逻辑
 * - 这里提供轻量默认值，避免把 Zod 打进客户端首屏 bundle
 *
 * 注意：
 * - 默认值需与 `lib/env.ts` 中 DASHBOARD_STALE_TIME / DASHBOARD_REFETCH_INTERVAL 的默认值保持一致
 */

export const dashboardConfig = {
  staleTime: 300_000,
  refetchInterval: 60_000,
} as const;

