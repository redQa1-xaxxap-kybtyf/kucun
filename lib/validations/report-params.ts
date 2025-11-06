/**
 * 财务报表查询参数验证规则
 * 使用 Zod 进行参数验证
 */

import { z } from 'zod';

// ==================== 通用验证规则 ====================

/**
 * 年份验证规则
 */
const yearSchema = z
  .number()
  .int()
  .min(2000, '年份不能早于2000年')
  .max(2100, '年份不能晚于2100年');

/**
 * 月份验证规则
 */
const monthSchema = z
  .number()
  .int()
  .min(1, '月份必须在1-12之间')
  .max(12, '月份必须在1-12之间');

/**
 * 日期字符串验证规则 (YYYY-MM-DD)
 */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD')
  .refine(
    dateStr => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    },
    { message: '无效的日期' }
  );

/**
 * 日期范围验证规则
 * 注意: 此schema包含refinement,不能使用.extend(),请使用z.object()重新定义
 */
const _dateRangeSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine(
    data => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// ==================== 月度报表验证规则 ====================

/**
 * 月度报表查询参数验证
 */
export const monthlyReportParamsSchema = z
  .object({
    year: yearSchema,
    month: monthSchema,
    includeComparison: z.boolean().optional().default(true),
  })
  .refine(
    data => {
      // 验证日期不能超过当前日期
      const now = new Date();
      const reportDate = new Date(data.year, data.month - 1);
      return reportDate <= now;
    },
    {
      message: '不能查询未来月份的报表',
      path: ['month'],
    }
  );

/**
 * 月度报表查询参数类型（从 Schema 推导）
 */
export type MonthlyReportParamsInput = z.input<
  typeof monthlyReportParamsSchema
>;
export type MonthlyReportParamsOutput = z.output<
  typeof monthlyReportParamsSchema
>;

// ==================== 年度报表验证规则 ====================

/**
 * 年度报表查询参数验证
 */
export const annualReportParamsSchema = z
  .object({
    year: yearSchema,
    includeYearOverYear: z.boolean().optional().default(true),
  })
  .refine(
    data => {
      // 验证年份不能超过当前年份
      const currentYear = new Date().getFullYear();
      return data.year <= currentYear;
    },
    {
      message: '不能查询未来年份的报表',
      path: ['year'],
    }
  );

/**
 * 年度报表查询参数类型（从 Schema 推导）
 */
export type AnnualReportParamsInput = z.input<typeof annualReportParamsSchema>;
export type AnnualReportParamsOutput = z.output<
  typeof annualReportParamsSchema
>;

// ==================== 盈亏分析验证规则 ====================

/**
 * 盈亏分析查询参数验证
 */
export const profitLossParamsSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
    includeComparison: z.boolean().optional().default(false),
  })
  .refine(
    data => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  )
  .refine(
    data => {
      // 验证日期范围不能超过1年
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays <= 365;
    },
    {
      message: '查询范围不能超过1年',
      path: ['endDate'],
    }
  )
  .refine(
    data => {
      // 验证结束日期不能超过当前日期
      const end = new Date(data.endDate);
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      return end <= now;
    },
    {
      message: '结束日期不能超过当前日期',
      path: ['endDate'],
    }
  );

/**
 * 盈亏分析查询参数类型（从 Schema 推导）
 */
export type ProfitLossParamsInput = z.input<typeof profitLossParamsSchema>;
export type ProfitLossParamsOutput = z.output<typeof profitLossParamsSchema>;

// ==================== URL 查询参数解析 ====================

/**
 * 从 URL SearchParams 解析月度报表参数
 */
export function parseMonthlyReportParams(
  searchParams: URLSearchParams
): MonthlyReportParamsInput {
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const includeComparison = searchParams.get('includeComparison');

  return {
    year: year ? parseInt(year, 10) : new Date().getFullYear(),
    month: month ? parseInt(month, 10) : new Date().getMonth() + 1,
    includeComparison:
      includeComparison !== null ? includeComparison === 'true' : true,
  };
}

/**
 * 从 URL SearchParams 解析年度报表参数
 */
export function parseAnnualReportParams(
  searchParams: URLSearchParams
): AnnualReportParamsInput {
  const year = searchParams.get('year');
  const includeYearOverYear = searchParams.get('includeYearOverYear');

  return {
    year: year ? parseInt(year, 10) : new Date().getFullYear(),
    includeYearOverYear:
      includeYearOverYear !== null ? includeYearOverYear === 'true' : true,
  };
}

/**
 * 从 URL SearchParams 解析盈亏分析参数
 */
export function parseProfitLossParams(
  searchParams: URLSearchParams
): ProfitLossParamsInput {
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const groupBy = searchParams.get('groupBy');
  const includeComparison = searchParams.get('includeComparison');

  // 默认查询当前月份
  const now = new Date();
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const defaultEndDate = now.toISOString().split('T')[0];

  return {
    startDate: startDate || defaultStartDate,
    endDate: endDate || defaultEndDate,
    groupBy: (groupBy as 'day' | 'week' | 'month') || 'day',
    includeComparison:
      includeComparison !== null ? includeComparison === 'true' : false,
  };
}

// ==================== 辅助函数 ====================

/**
 * 验证并解析月度报表参数
 */
export function validateMonthlyReportParams(
  params: unknown
): MonthlyReportParamsOutput {
  return monthlyReportParamsSchema.parse(params);
}

/**
 * 验证并解析年度报表参数
 */
export function validateAnnualReportParams(
  params: unknown
): AnnualReportParamsOutput {
  return annualReportParamsSchema.parse(params);
}

/**
 * 验证并解析盈亏分析参数
 */
export function validateProfitLossParams(
  params: unknown
): ProfitLossParamsOutput {
  return profitLossParamsSchema.parse(params);
}

/**
 * 安全验证月度报表参数（返回 SafeParseResult）
 */
export function safeValidateMonthlyReportParams(params: unknown) {
  return monthlyReportParamsSchema.safeParse(params);
}

/**
 * 安全验证年度报表参数（返回 SafeParseResult）
 */
export function safeValidateAnnualReportParams(params: unknown) {
  return annualReportParamsSchema.safeParse(params);
}

/**
 * 安全验证盈亏分析参数（返回 SafeParseResult）
 */
export function safeValidateProfitLossParams(params: unknown) {
  return profitLossParamsSchema.safeParse(params);
}

// ==================== 日期工具函数 ====================

/**
 * 获取月份的第一天
 */
export function getMonthStartDate(year: number, month: number): string {
  return new Date(year, month - 1, 1).toISOString().split('T')[0];
}

/**
 * 获取月份的最后一天
 */
export function getMonthEndDate(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().split('T')[0];
}

/**
 * 获取年份的第一天
 */
export function getYearStartDate(year: number): string {
  return new Date(year, 0, 1).toISOString().split('T')[0];
}

/**
 * 获取年份的最后一天
 */
export function getYearEndDate(year: number): string {
  return new Date(year, 11, 31).toISOString().split('T')[0];
}

/**
 * 获取上个月的年份和月份
 */
export function getPreviousMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * 获取去年同期的年份
 */
export function getPreviousYear(year: number): number {
  return year - 1;
}
