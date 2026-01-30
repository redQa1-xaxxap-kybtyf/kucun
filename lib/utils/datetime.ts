/**
 * 统一的时间处理工具函数
 * 解决项目中时间格式不一致的问题
 */

import { format, isValid, parseISO } from 'date-fns';

/**
 * 时间格式常量
 */
export const DATE_FORMATS = {
  // ISO标准格式（API响应统一使用）
  ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ',

  // 显示格式
  DATE: 'yyyy-MM-dd',
  DATETIME: 'yyyy-MM-dd HH:mm:ss', // 默认格式包含秒
  DATETIME_SHORT: 'yyyy-MM-dd HH:mm', // 短格式（特殊场景使用）
  DATETIME_FULL: 'yyyy-MM-dd HH:mm:ss', // 完整格式（与 DATETIME 相同）
  TIME: 'HH:mm:ss', // 默认时间格式包含秒
  TIME_SHORT: 'HH:mm', // 短时间格式（特殊场景使用）

  // 中文显示格式
  DATE_CN: 'yyyy年MM月dd日',
  DATETIME_CN: 'yyyy年MM月dd日 HH:mm:ss', // 中文格式包含秒
  DATETIME_SHORT_CN: 'yyyy年MM月dd日 HH:mm', // 中文短格式（特殊场景使用）
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
  if (!input) {
    return null;
  }

  try {
    if (input instanceof Date) {
      return isValid(input) ? input : null;
    }

    if (typeof input === 'string') {
      // 尝试解析ISO字符串
      const parsed = parseISO(input);
      if (isValid(parsed)) {
        return parsed;
      }

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
 * 解析运输查询中的日期时间字符串
 *
 * 处理格式：
 * - "11-04 05:00" (月-日 时:分，无年份)
 * - "2025-11-04 05:00" (完整日期时间)
 * - "11-04" (仅月-日)
 *
 * 年份推断逻辑：
 * - 如果提供了完整年份，直接使用
 * - 如果只有月-日：
 *   - 如果月份 < 当前月份 → 使用下一年
 *   - 如果月份 = 当前月份 且 日期 < 当前日期 → 使用下一年
 *   - 否则使用当前年份
 *
 * @param dateStr - 日期字符串
 * @returns Date 对象或 null
 *
 * @example
 * // 当前日期：2025-11-01
 * parseShippingDate("11-04 05:00") // → 2025-11-04 05:00 (同年，月份相同但日期在后)
 * parseShippingDate("10-15 08:00") // → 2026-10-15 08:00 (下一年，月份已过)
 * parseShippingDate("11-01 10:00") // → 2026-11-01 10:00 (下一年，同月同日但时间已过)
 * parseShippingDate("12-25 12:00") // → 2025-12-25 12:00 (同年，月份在后)
 */
export function parseShippingDate(
  dateStr: string | null | undefined
): Date | null {
  if (!dateStr) {
    return null;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  try {
    // 如果已经是完整的 ISO 格式或包含年份，直接解析
    if (trimmed.includes('T') || /^\d{4}-/.test(trimmed)) {
      return parseDate(trimmed);
    }

    // 匹配 "MM-DD HH:mm" 或 "MM-DD" 格式
    const monthDayTimeMatch = trimmed.match(
      /^(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/
    );

    if (!monthDayTimeMatch) {
      // 如果不匹配预期格式，尝试直接解析
      return parseDate(trimmed);
    }

    const month = parseInt(monthDayTimeMatch[1], 10);
    const day = parseInt(monthDayTimeMatch[2], 10);
    const hour = monthDayTimeMatch[3] ? parseInt(monthDayTimeMatch[3], 10) : 0;
    const minute = monthDayTimeMatch[4]
      ? parseInt(monthDayTimeMatch[4], 10)
      : 0;

    // 验证月份和日期的有效性
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    // 获取当前日期
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() 返回 0-11
    const currentDay = now.getDate();

    // 推断年份
    let year = currentYear;

    if (month < currentMonth) {
      // 月份已过，使用下一年
      year = currentYear + 1;
    } else if (month === currentMonth) {
      // 同月，比较日期
      if (day < currentDay) {
        // 日期已过，使用下一年
        year = currentYear + 1;
      } else if (day === currentDay) {
        // 同月同日，比较时间
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        if (
          hour < currentHour ||
          (hour === currentHour && minute <= currentMinute)
        ) {
          // 时间已过，使用下一年
          year = currentYear + 1;
        }
      }
    }
    // 如果 month > currentMonth，使用当前年份（已经是默认值）

    // 创建 Date 对象（月份需要 -1，因为 Date 的月份是 0-11）
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);

    // 验证日期是否有效（例如 2月30日会被自动调整）
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 将仅包含日期（yyyy-MM-dd）的字符串解析为本地时区的 Date 对象
 * 解决 new Date('yyyy-MM-dd') 默认按 UTC 解析导致的 8 小时时差问题
 */
export function parseLocalDateString(
  dateString: string | null | undefined
): Date | null {
  if (!dateString) {
    return null;
  }

  const trimmed = dateString.trim();
  if (!trimmed) {
    return null;
  }

  if (DATE_ONLY_REGEX.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    if ([year, month, day].some(value => Number.isNaN(value))) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  return parseDate(trimmed);
}

/**
 * 专用于收款/付款日期显示的格式化函数
 * 统一使用标准的日期时间格式化
 */
export function formatPaymentDateTime(
  input: DateInput,
  fallback?: DateInput
): string {
  if (!input && !fallback) {
    return '';
  }

  const fallbackDate = fallback ? parseDate(fallback) : null;

  if (!input) {
    if (fallbackDate) {
      try {
        return format(fallbackDate, DATE_FORMATS.DATETIME);
      } catch {
        return '';
      }
    }
    return '';
  }

  let trimmed: string | null = null;
  if (typeof input === 'string') {
    trimmed = input.trim();
    if (!trimmed) {
      return fallbackDate
        ? format(fallbackDate, DATE_FORMATS.DATETIME)
        : '';
    }
  }

  const isDateOnly = Boolean(trimmed && DATE_ONLY_REGEX.test(trimmed));
  const isExplicitMidnight = Boolean(trimmed && trimmed.includes('T00:00:00'));

  const date = parseDate(input);
  if (!date) {
    if (fallbackDate) {
      try {
        return format(fallbackDate, DATE_FORMATS.DATETIME);
      } catch {
        return '';
      }
    }
    return '';
  }

  try {
    const formatted = format(date, DATE_FORMATS.DATETIME);

    if (
      (isDateOnly || isExplicitMidnight || formatted.endsWith('00:00')) &&
      fallbackDate
    ) {
      const datePart = format(date, DATE_FORMATS.DATE);
      const timePart = format(fallbackDate, DATE_FORMATS.TIME);
      if (timePart !== '00:00') {
        return `${datePart} ${timePart}`;
      }
    }

    return formatted;
  } catch {
    if (fallbackDate) {
      try {
        return format(fallbackDate, DATE_FORMATS.DATETIME);
      } catch {
        return '';
      }
    }
    return '';
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
export function formatDate(
  input: DateInput,
  formatStr: string = DATE_FORMATS.DATE
): string {
  const date = parseDate(input);
  if (!date) {
    return '';
  }

  try {
    return format(date, formatStr);
  } catch {
    return '';
  }
}

/**
 * 格式化日期时间显示
 */
export function formatDateTime(
  input: DateInput,
  formatStr: string = DATE_FORMATS.DATETIME
): string {
  const date = parseDate(input);
  if (!date) {
    return '';
  }

  try {
    return format(date, formatStr);
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
  return getRelativeTimeText(input);
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
export function compareDates(
  date1: DateInput,
  date2: DateInput
): number | null {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);

  if (!d1 || !d2) {
    return null;
  }

  const time1 = d1.getTime();
  const time2 = d2.getTime();

  if (time1 < time2) {
    return -1;
  }
  if (time1 > time2) {
    return 1;
  }
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

  if (!d || !start || !end) {
    return false;
  }

  const time = d.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/**
 * 获取日期的开始时间（00:00:00）
 */
export function getStartOfDay(input: DateInput): Date | null {
  const date = parseDate(input);
  if (!date) {
    return null;
  }

  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * 获取日期的结束时间（23:59:59.999）
 */
export function getEndOfDay(input: DateInput): Date | null {
  const date = parseDate(input);
  if (!date) {
    return null;
  }

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
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

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
    if (!Array.isArray(array)) {
      return array;
    }

    return array.map(item => this.transformObject(item, timeFields));
  }

  /**
   * 深度转换嵌套对象中的时间字段
   */
  static transformNested<T>(
    obj: T,
    timeFields: string[] = ['createdAt', 'updatedAt']
  ): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

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

/**
 * 获取相对时间文本(中文)
 * 24小时内显示相对时间,超过24小时显示标准日期格式
 *
 * @param input - 日期输入
 * @returns 相对时间文本
 *
 * @example
 * getRelativeTimeText(new Date()) // "刚刚"
 * getRelativeTimeText(Date.now() - 30 * 60 * 1000) // "30分钟前"
 * getRelativeTimeText(Date.now() - 5 * 3600 * 1000) // "5小时前"
 * getRelativeTimeText(Date.now() - 25 * 3600 * 1000) // "2025-01-01 10:00"
 */
export function getRelativeTimeText(input: DateInput): string {
  const date = parseDate(input);
  if (!date) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  // 未来时间,显示标准格式
  if (diffMs < 0) {
    return formatDateTime(date, DATE_FORMATS.DATETIME_SHORT);
  }

  // 小于1分钟
  if (diffMins < 1) {
    return '刚刚';
  }

  // 小于1小时
  if (diffMins < 60) {
    return `${diffMins}分钟前`;
  }

  // 小于24小时
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  // 超过24小时,显示标准日期时间格式(不含秒)
  return formatDateTime(date, DATE_FORMATS.DATETIME_SHORT);
}

/**
 * 判断日期是否在24小时内
 *
 * @param input - 日期输入
 * @returns 是否在24小时内
 */
export function isWithin24Hours(input: DateInput): boolean {
  const date = parseDate(input);
  if (!date) {
    return false;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / 3600000;

  return diffHours >= 0 && diffHours < 24;
}

/**
 * 格式化完整时间戳(用于Tooltip显示)
 *
 * @param input - 日期输入
 * @returns 完整时间戳字符串
 */
export function formatFullTimestamp(input: DateInput): string {
  return formatDateTime(input, DATE_FORMATS.DATETIME);
}
