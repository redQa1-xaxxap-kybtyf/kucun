/**
 * 库存阈值默认值（Client-safe）
 *
 * 说明：
 * - 客户端代码避免依赖 `@/lib/env`：`lib/env.ts` 依赖 Zod 且包含服务端环境变量校验逻辑
 * - 这里提供轻量默认值，用于前端展示与本地计算的兜底
 *
 * 注意：
 * - 如需严格对齐服务端可配置阈值，应在服务端计算后下发，或在调用处显式传入阈值参数
 */

export const inventoryThresholds = {
  defaultMinQuantity: 10,
  criticalMinQuantity: 5,
  overstockMultiplier: 5,
};
