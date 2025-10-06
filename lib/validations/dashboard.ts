/**
 * 仪表盘验证规则
 * 遵循全栈开发执行手册：使用Zod进行表单验证
 *
 * 这是仪表盘验证规则的唯一真理源
 */

import { z } from 'zod';

/**
 * 仪表盘概览查询参数验证
 */
export const dashboardOverviewQuerySchema = z.object({
  timeRange: z.enum(['1d', '7d', '30d', '90d', '1y']).default('30d'),
});

/**
 * 仪表盘主数据查询参数验证
 */
export const dashboardQuerySchema = z.object({
  timeRange: z.enum(['1d', '7d', '30d', '90d', '1y']).default('30d'),
  productCategory: z.string().optional(),
  customerType: z.string().optional(),
  salesChannel: z.string().optional(),
  region: z.string().optional(),
});

// 导出类型推断
export type DashboardOverviewQueryParams = z.infer<
  typeof dashboardOverviewQuerySchema
>;
export type DashboardQueryParams = z.infer<typeof dashboardQuerySchema>;

// 时间范围枚举类型
export type TimeRange = z.infer<
  typeof dashboardOverviewQuerySchema
>['timeRange'];
