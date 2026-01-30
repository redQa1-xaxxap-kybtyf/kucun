/**
 * 分页配置（Client-safe）
 *
 * 说明：
 * - 客户端组件不要从 `@/lib/env` 引用分页配置：`lib/env.ts` 依赖 Zod 且包含服务端环境变量校验逻辑
 * - 这里提供轻量常量，避免把 Zod 打进客户端首屏 bundle
 *
 * 注意：
 * - 默认值需与 `lib/env.ts` 中 DEFAULT_PAGE_SIZE / MAX_PAGE_SIZE 的默认值保持一致
 */

export const paginationConfig = {
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

