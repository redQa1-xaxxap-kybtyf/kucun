/**
 * 财务数据缓存工具
 * 使用统一缓存系统管理财务数据缓存
 *
 * ✅ P0修复: 添加报表缓存失效机制
 * ✅ P1修复: 集成Redis缓存失效
 */

import {
  revalidateFinance,
  revalidateSalesOrders,
} from '@/lib/cache/revalidate';
import { redis } from '@/lib/redis/redis-client';
import {
  invalidateFinanceSummaryCache,
  invalidateStatementsCache,
} from '@/lib/services/finance-statistics-cached';
import { logger } from '@/lib/utils/console-logger';

/**
 * 收款后清除相关缓存
 * 使用统一的缓存失效系统，自动级联失效相关缓存
 * ✅ P1修复: 同时失效Redis财务缓存
 */
export async function clearCacheAfterPayment(): Promise<void> {
  // 失效应收款相关缓存（自动级联失效统计、往来账单等）
  await Promise.all([
    revalidateFinance('receivables'),
    invalidateStatementsCache(),
    invalidateFinanceSummaryCache(),
  ]);
}

/**
 * 付款后清除相关缓存
 * 使用统一的缓存失效系统，自动级联失效相关缓存
 * ✅ P1修复: 同时失效Redis财务缓存
 */
export async function clearCacheAfterPaymentOut(): Promise<void> {
  // 失效应付款相关缓存（自动级联失效统计、往来账单等）
  await Promise.all([
    revalidateFinance('payables'),
    invalidateStatementsCache(),
    invalidateFinanceSummaryCache(),
  ]);
}

/**
 * 退款后清除相关缓存
 * 使用统一的缓存失效系统，自动级联失效相关缓存
 * ✅ P1修复: 同时失效Redis财务缓存
 */
export async function clearCacheAfterRefund(): Promise<void> {
  // 失效退款相关缓存（自动级联失效统计、往来账单等）
  await Promise.all([
    revalidateFinance('refunds'),
    invalidateStatementsCache(),
    invalidateFinanceSummaryCache(),
  ]);
}

/**
 * 清除所有财务缓存
 * ✅ P1修复: 同时失效Redis财务缓存
 */
export async function clearAllFinanceCache(): Promise<void> {
  // 失效所有财务相关缓存
  const { invalidateAllFinanceCache } = await import(
    '@/lib/services/finance-statistics-cached'
  );
  await Promise.all([revalidateFinance(), invalidateAllFinanceCache()]);
}

// ==================== 销售订单缓存失效函数 ====================

/**
 * 销售订单变更后清除相关缓存
 *
 * 使用场景:
 * - 销售订单创建/更新/删除后
 * - 销售订单状态变更后
 * - 任何影响应收款数据的操作后
 *
 * ✅ P0修复: 统一的销售订单和应收款缓存失效机制
 *
 * @param orderId - 可选的订单ID，用于日志记录
 *
 * @example
 * ```typescript
 * // 销售订单更新后
 * await invalidateSalesOrderAndReceivables(orderId);
 * ```
 */
export async function invalidateSalesOrderAndReceivables(
  orderId?: string
): Promise<void> {
  try {
    await Promise.all([
      // 失效销售订单缓存
      revalidateSalesOrders(),
      // 失效应收款缓存（因为应收款数据来源于销售订单）
      revalidateFinance('receivables'),
      // 失效报表缓存（因为报表数据包含销售收入）
      invalidateReportCache(),
    ]);
    logger.info(
      'finance-cache',
      '销售订单和应收款缓存已失效',
      undefined,
      orderId ? { orderId } : undefined
    );
  } catch (error) {
    logger.warn('finance-cache', '销售订单和应收款缓存失效失败', undefined, {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ==================== 报表缓存失效函数 ====================

/**
 * 清除所有报表缓存
 *
 * 使用场景:
 * - 费用记录创建/更新/删除后
 * - 销售订单创建/更新后
 * - 任何影响报表数据的操作后
 *
 * ✅ P0修复: 添加报表缓存失效机制
 */
export async function invalidateReportCache(): Promise<void> {
  try {
    await Promise.all([
      redis.scanDel('finance:reports:monthly*'),
      redis.scanDel('finance:reports:annual*'),
      redis.scanDel('finance:reports:profit-loss*'),
    ]);
    logger.info('finance-cache', '报表缓存已失效');
  } catch (error) {
    logger.warn('finance-cache', '报表缓存失效失败', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 清除特定月份的月度报表缓存
 *
 * @param year - 年份
 * @param month - 月份 (1-12)
 *
 * @example
 * ```typescript
 * // 清除2024年1月的月度报表缓存
 * await invalidateMonthlyReportCache(2024, 1);
 * ```
 */
export async function invalidateMonthlyReportCache(
  year: number,
  month: number
): Promise<void> {
  try {
    await redis.scanDel(`finance:reports:monthly*year=${year}*month=${month}*`);
    logger.info('finance-cache', `月度报表缓存已失效: ${year}年${month}月`);
  } catch (error) {
    logger.warn('finance-cache', '月度报表缓存失效失败', undefined, {
      year,
      month,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 清除特定年度的年度报表缓存
 *
 * @param year - 年份
 *
 * @example
 * ```typescript
 * // 清除2024年的年度报表缓存
 * await invalidateAnnualReportCache(2024);
 * ```
 */
export async function invalidateAnnualReportCache(year: number): Promise<void> {
  try {
    await redis.scanDel(`finance:reports:annual*year=${year}*`);
    logger.info('finance-cache', `年度报表缓存已失效: ${year}年`);
  } catch (error) {
    logger.warn('finance-cache', '年度报表缓存失效失败', undefined, {
      year,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
