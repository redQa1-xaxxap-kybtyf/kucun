/**
 * 财务数据缓存工具
 * 使用统一缓存系统管理财务数据缓存
 */

import { revalidateFinance } from '@/lib/cache/revalidate';

/**
 * 收款后清除相关缓存
 * 使用统一的缓存失效系统，自动级联失效相关缓存
 */
export async function clearCacheAfterPayment(): Promise<void> {
  // 失效应收款相关缓存（自动级联失效统计、往来账单等）
  await revalidateFinance('receivables');
}

/**
 * 付款后清除相关缓存
 * 使用统一的缓存失效系统，自动级联失效相关缓存
 */
export async function clearCacheAfterPaymentOut(): Promise<void> {
  // 失效应付款相关缓存（自动级联失效统计、往来账单等）
  await revalidateFinance('payables');
}

/**
 * 退款后清除相关缓存
 * 使用统一的缓存失效系统，自动级联失效相关缓存
 */
export async function clearCacheAfterRefund(): Promise<void> {
  // 失效退款相关缓存（自动级联失效统计、往来账单等）
  await revalidateFinance('refunds');
}

/**
 * 清除所有财务缓存
 */
export async function clearAllFinanceCache(): Promise<void> {
  // 失效所有财务相关缓存
  await revalidateFinance();
}
