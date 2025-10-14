/**
 * 财务数据缓存工具
 * 使用统一缓存系统管理财务数据缓存
 *
 * ✅ P1修复: 集成Redis缓存失效
 */

import { revalidateFinance } from '@/lib/cache/revalidate';
import {
  invalidateStatementsCache,
  invalidateFinanceSummaryCache,
} from '@/lib/services/finance-statistics-cached';

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
