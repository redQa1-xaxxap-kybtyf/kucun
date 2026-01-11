/**
 * 费用类型处理工具函数
 * 统一管理费用类型相关的映射、聚合和计算逻辑
 *
 * 设计原则:
 * - DRY: 避免费用类型映射和聚合逻辑重复
 * - SOLID-OCP: 新增费用类型时无需修改此文件的函数逻辑
 * - SOLID-SRP: 每个函数只负责一个职责
 */

import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/lib/types/expense';
import { toNumber } from '@/lib/utils/number';

/**
 * Prisma 分组查询结果类型
 */
export interface PrismaExpenseGroupResult {
  expenseType: string;
  _sum: {
    expenseAmount: unknown | null;
  };
}

/**
 * 费用类型金额映射
 */
export type ExpensesByType = Record<ExpenseType, number>;

/**
 * 从 Prisma 分组结果中提取费用类型金额
 *
 * 功能:
 * - 遍历所有费用类型，确保每个类型都有值（默认为0）
 * - 自动处理 null 值
 * - 类型安全
 *
 * @param groupedData - Prisma groupBy 查询结果
 * @returns 费用类型金额映射对象
 *
 * @example
 * ```typescript
 * const byTypeStats = await prisma.expenseRecord.groupBy({
 *   by: ['expenseType'],
 *   _sum: { expenseAmount: true },
 * });
 *
 * const byType = extractExpensesByType(byTypeStats);
 * // { shipping: 1000, storage: 500, labor: 300, ... }
 * ```
 */
export function extractExpensesByType(
  groupedData: PrismaExpenseGroupResult[]
): ExpensesByType {
  const result = {} as ExpensesByType;

  // 遍历所有费用类型，确保每个类型都有值
  for (const type of Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]) {
    const found = groupedData.find(g => g.expenseType === type);
    result[type] = toNumber(found?._sum.expenseAmount);
  }

  return result;
}

/**
 * 计算费用总额
 *
 * @param byType - 费用类型金额映射
 * @returns 总费用金额
 *
 * @example
 * ```typescript
 * const byType = { shipping: 1000, storage: 500, labor: 300, ... };
 * const total = calculateTotalExpenses(byType);
 * // 1800
 * ```
 */
export function calculateTotalExpenses(byType: ExpensesByType): number {
  return Object.values(byType).reduce((sum, amount) => sum + amount, 0);
}

/**
 * 获取费用类型中文名称
 *
 * @param type - 费用类型
 * @returns 中文名称
 *
 * @example
 * ```typescript
 * getExpenseTypeName('shipping'); // '运费'
 * getExpenseTypeName('storage'); // '仓储费'
 * ```
 */
export function getExpenseTypeName(type: ExpenseType): string {
  return EXPENSE_TYPE_LABELS[type];
}

/**
 * 获取所有费用类型列表
 *
 * @returns 费用类型数组
 *
 * @example
 * ```typescript
 * getAllExpenseTypes();
 * // ['shipping', 'storage', 'labor', 'travel', 'living', 'loading_unloading', 'other']
 * ```
 */
export function getAllExpenseTypes(): ExpenseType[] {
  return Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[];
}

/**
 * 获取费用类型名称映射对象
 *
 * @returns 费用类型名称映射
 *
 * @example
 * ```typescript
 * getExpenseTypeLabels();
 * // { shipping: '运费', storage: '仓储费', ... }
 * ```
 */
export function getExpenseTypeLabels(): Record<ExpenseType, string> {
  return EXPENSE_TYPE_LABELS;
}

/**
 * 创建空的费用类型金额映射（所有类型金额为0）
 *
 * @returns 初始化的费用类型金额映射
 *
 * @example
 * ```typescript
 * const emptyExpenses = createEmptyExpensesByType();
 * // { shipping: 0, storage: 0, labor: 0, ... }
 * ```
 */
export function createEmptyExpensesByType(): ExpensesByType {
  const result = {} as ExpensesByType;

  for (const type of Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]) {
    result[type] = 0;
  }

  return result;
}

/**
 * 验证费用类型是否有效
 *
 * @param type - 待验证的费用类型
 * @returns 是否为有效的费用类型
 *
 * @example
 * ```typescript
 * isValidExpenseType('shipping'); // true
 * isValidExpenseType('invalid'); // false
 * ```
 */
export function isValidExpenseType(type: string): type is ExpenseType {
  return type in EXPENSE_TYPE_LABELS;
}
