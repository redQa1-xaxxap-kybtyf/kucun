/**
 * 统一的时间处理工具函数
 * 解决项目中时间格式不一致的问题
 */

import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 时间格式常量
 */
export const DATE_FORMATS = {
  // ISO标准格式（API响应统一使用）
  ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  
  // 显示格式
  DATE: 'yyyy-MM-dd',
  DATETIME: 'yyyy-MM-dd HH:mm',
  DATETIME_FULL: 'yyyy-MM-dd HH:mm:ss',
  TIME: 'HH:mm',
  
  // 中文显示格式
  DATE_CN: 'yyyy年MM月dd日',
  DATETIME_CN: 'yyyy年MM月dd日 HH:mm',
  DATETIME_FULL_CN: 'yyyy年MM月dd日 HH:mm:ss',
} as const;

/**
 * 时间输入类型
 */
export type DateInput = Date | string | number | null | undefined;

/**
 * 安全的日期解析函数
 * 统一处理各种时间输入格式
 */
export function parseDate(input: DateInput): Date | null {
  if (!input) return null;
  
  try {
    if (input instanceof Date) {
      return isValid(input) ? input : null;
    }
    
    if (typeof input === 'string') {
      // 尝试解析ISO字符串
      const parsed = parseISO(input);
      if (isValid(parsed)) return parsed;
      
      // 尝试直接创建Date对象
      const date = new Date(input);
      return isValid(date) ? date : null;
    }
    
    if (typeof input === 'number') {
      const date = new Date(input);
      return isValid(date) ? date : null;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 将任意时间输入转换为ISO字符串
 * API响应统一使用此函数
 */
export function toISOString(input: DateInput): string | null {
  const date = parseDate(input);
  return date ? date.toISOString() : null;
}

/**
 * 格式化日期显示
 */
export function formatDate(input: DateInput, formatStr: string = DATE_FORMATS.DATE): string {
  const date = parseDate(input);
  if (!date) return '';
  
  try {
    return format(date, formatStr, { locale: zhCN });
  } catch {
    return '';
  }
}

/**
 * 格式化日期时间显示
 */
export function formatDateTime(input: DateInput, formatStr: string = DATE_FORMATS.DATETIME): string {
  const date = parseDate(input);
  if (!date) return '';
  
  try {
    return format(date, formatStr, { locale: zhCN });
  } catch {
    return '';
  }
}

/**
 * 格式化中文日期显示
 */
export function formatDateCN(input: DateInput): string {
  return formatDate(input, DATE_FORMATS.DATE_CN);
}

/**
 * 格式化中文日期时间显示
 */
export function formatDateTimeCN(input: DateInput): string {
  return formatDateTime(input, DATE_FORMATS.DATETIME_CN);
}

/**
 * 格式化相对时间（多久之前）
 * 统一替换项目中重复的formatTimeAgo函数
 */
export function formatTimeAgo(input: DateInput): string {
  const date = parseDate(input);
  if (!date) return '';
  
  try {
    return formatDistanceToNow(date, { 
      addSuffix: true, 
      locale: zhCN 
    });
  } catch {
    return '';
  }
}

/**
 * 检查日期是否有效
 */
export function isValidDate(input: DateInput): boolean {
  const date = parseDate(input);
  return date !== null;
}

/**
 * 比较两个日期
 * 返回值：-1(date1 < date2), 0(相等), 1(date1 > date2), null(无效日期)
 */
export function compareDates(date1: DateInput, date2: DateInput): number | null {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  
  if (!d1 || !d2) return null;
  
  const time1 = d1.getTime();
  const time2 = d2.getTime();
  
  if (time1 < time2) return -1;
  if (time1 > time2) return 1;
  return 0;
}

/**
 * 检查日期是否在指定范围内
 */
export function isDateInRange(
  date: DateInput, 
  startDate: DateInput, 
  endDate: DateInput
): boolean {
  const d = parseDate(date);
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  if (!d || !start || !end) return false;
  
  const time = d.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/**
 * 获取日期的开始时间（00:00:00）
 */
export function getStartOfDay(input: DateInput): Date | null {
  const date = parseDate(input);
  if (!date) return null;
  
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * 获取日期的结束时间（23:59:59.999）
 */
export function getEndOfDay(input: DateInput): Date | null {
  const date = parseDate(input);
  if (!date) return null;
  
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * 获取当前时间的ISO字符串
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}

/**
 * 数据库时间字段转换器
 * 用于统一处理Prisma查询结果中的时间字段
 */
export class DateTimeTransformer {
  /**
   * 转换单个对象中的时间字段
   */
  static transformObject<T extends Record<string, unknown>>(
    obj: T,
    timeFields: (keyof T)[] = ['createdAt', 'updatedAt']
  ): T {
    if (!obj || typeof obj !== 'object') return obj;
    
    const transformed = { ...obj };
    
    for (const field of timeFields) {
      if (field in transformed && transformed[field]) {
        const isoString = toISOString(transformed[field] as DateInput);
        if (isoString) {
          (transformed[field] as unknown) = isoString;
        }
      }
    }
    
    return transformed;
  }
  
  /**
   * 转换对象数组中的时间字段
   */
  static transformArray<T extends Record<string, unknown>>(
    array: T[],
    timeFields: (keyof T)[] = ['createdAt', 'updatedAt']
  ): T[] {
    if (!Array.isArray(array)) return array;
    
    return array.map(item => this.transformObject(item, timeFields));
  }
  
  /**
   * 深度转换嵌套对象中的时间字段
   */
  static transformNested<T>(
    obj: T,
    timeFields: string[] = ['createdAt', 'updatedAt']
  ): T {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.transformNested(item, timeFields)) as T;
    }
    
    const transformed = { ...obj } as Record<string, unknown>;
    
    for (const [key, value] of Object.entries(transformed)) {
      if (timeFields.includes(key) && value) {
        const isoString = toISOString(value as DateInput);
        if (isoString) {
          transformed[key] = isoString;
        }
      } else if (value && typeof value === 'object') {
        transformed[key] = this.transformNested(value, timeFields);
      }
    }
    
    return transformed as T;
  }
}
