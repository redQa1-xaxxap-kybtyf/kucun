import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  formatCurrency as internalFormatCurrency,
  formatDate as internalFormatDate,
} from './utils/format';
import { formatDateTime as internalFormatDateTime } from './utils/datetime';

/**
 * 合并 Tailwind CSS 类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化货币
 * @param amount 金额
 * @param currency 货币符号，默认为 ¥
 * @param precision 小数位数，默认为 2
 */
export function formatCurrency(
  amount: number,
  currency: string = '¥',
  precision: number = 2
): string {
  return internalFormatCurrency(amount, currency, precision);
}

/**
 * 格式化日期
 * @param date 日期
 * @param format 格式类型（date | datetime | time）
 */
export function formatDate(
  date: Date | string,
  format: 'date' | 'datetime' | 'time' = 'date'
): string {
  return internalFormatDate(date, format);
}

/**
 * 格式化日期时间
 * @deprecated 请使用 formatDate(date, 'datetime')
 */
export function formatDateTime(date: Date | string): string {
  return internalFormatDateTime(date);
}

/**
 * 生成随机 ID
 */
export function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
