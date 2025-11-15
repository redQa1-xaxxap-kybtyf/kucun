/**
 * 精度处理工具
 *
 * 提供统一的数值精度处理方法，避免浮点数计算误差
 */

/**
 * 四舍五入到两位小数
 *
 * @param value - 原始值
 * @returns 保留两位小数的值
 *
 * @example
 * ```ts
 * roundToTwoDecimals(1.234) // 1.23
 * roundToTwoDecimals(1.235) // 1.24
 * roundToTwoDecimals(1.999) // 2.00
 * ```
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 四舍五入到指定小数位数
 *
 * @param value - 原始值
 * @param decimals - 小数位数（默认 2）
 * @returns 保留指定小数位数的值
 *
 * @example
 * ```ts
 * roundToDecimals(1.2345, 2) // 1.23
 * roundToDecimals(1.2345, 3) // 1.235
 * roundToDecimals(1.2345, 4) // 1.2345
 * ```
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * 安全的加法运算（避免浮点数精度问题）
 *
 * @param a - 加数
 * @param b - 加数
 * @returns 和
 *
 * @example
 * ```ts
 * safeAdd(0.1, 0.2) // 0.3 (而不是 0.30000000000000004)
 * ```
 */
export function safeAdd(a: number, b: number): number {
  return roundToTwoDecimals(a + b);
}

/**
 * 安全的减法运算（避免浮点数精度问题）
 *
 * @param a - 被减数
 * @param b - 减数
 * @returns 差
 *
 * @example
 * ```ts
 * safeSubtract(0.3, 0.1) // 0.2 (而不是 0.19999999999999998)
 * ```
 */
export function safeSubtract(a: number, b: number): number {
  return roundToTwoDecimals(a - b);
}

/**
 * 安全的乘法运算（避免浮点数精度问题）
 *
 * @param a - 乘数
 * @param b - 乘数
 * @returns 积
 *
 * @example
 * ```ts
 * safeMultiply(0.1, 0.2) // 0.02 (而不是 0.020000000000000004)
 * ```
 */
export function safeMultiply(a: number, b: number): number {
  return roundToTwoDecimals(a * b);
}

/**
 * 安全的除法运算（避免浮点数精度问题）
 *
 * @param a - 被除数
 * @param b - 除数
 * @returns 商
 *
 * @example
 * ```ts
 * safeDivide(0.3, 0.1) // 3.00 (而不是 2.9999999999999996)
 * safeDivide(1, 0) // 0 (除数为 0 时返回 0)
 * ```
 */
export function safeDivide(a: number, b: number): number {
  if (b === 0) {
    return 0;
  }
  return roundToTwoDecimals(a / b);
}

/**
 * 格式化为货币字符串
 *
 * @param value - 数值
 * @param currency - 货币符号（默认 '¥'）
 * @returns 格式化后的货币字符串
 *
 * @example
 * ```ts
 * formatCurrency(1234.56) // '¥1,234.56'
 * formatCurrency(1234.56, '$') // '$1,234.56'
 * ```
 */
export function formatCurrency(
  value: number,
  currency: string = '¥'
): string {
  return `${currency}${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * 格式化为百分比字符串
 *
 * @param value - 数值（0-100）
 * @param decimals - 小数位数（默认 2）
 * @returns 格式化后的百分比字符串
 *
 * @example
 * ```ts
 * formatPercentage(12.34) // '12.34%'
 * formatPercentage(12.345, 1) // '12.3%'
 * ```
 */
export function formatPercentage(
  value: number,
  decimals: number = 2
): string {
  return `${roundToDecimals(value, decimals).toFixed(decimals)}%`;
}

/**
 * 将数值转换为安全的数字（处理 null、undefined、NaN）
 *
 * @param value - 原始值
 * @param defaultValue - 默认值（默认 0）
 * @returns 安全的数字
 *
 * @example
 * ```ts
 * toSafeNumber(null) // 0
 * toSafeNumber(undefined) // 0
 * toSafeNumber(NaN) // 0
 * toSafeNumber('123') // 123
 * toSafeNumber('abc', 10) // 10
 * ```
 */
export function toSafeNumber(
  value: unknown,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  const num = Number(value);

  if (isNaN(num)) {
    return defaultValue;
  }

  return num;
}

/**
 * 计算数组的总和
 *
 * @param values - 数值数组
 * @returns 总和
 *
 * @example
 * ```ts
 * sum([1.1, 2.2, 3.3]) // 6.6
 * sum([]) // 0
 * ```
 */
export function sum(values: number[]): number {
  return roundToTwoDecimals(values.reduce((acc, val) => acc + val, 0));
}

/**
 * 计算数组的平均值
 *
 * @param values - 数值数组
 * @returns 平均值
 *
 * @example
 * ```ts
 * average([1, 2, 3]) // 2.00
 * average([]) // 0
 * ```
 */
export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return safeDivide(sum(values), values.length);
}

