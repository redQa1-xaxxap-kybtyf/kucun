/**
 * 打印工具函数库
 *
 * 提供打印相关的通用工具函数，避免代码重复
 *
 * 功能模块：
 * - 数字格式化（中文大写、货币）
 * - 日期时间格式化
 * - 重量计算
 * - 页码处理
 *
 * 设计原则：
 * - DRY：消除重复代码
 * - 纯函数：无副作用，易测试
 * - 类型安全：完整的 TypeScript 类型定义
 */

/**
 * 数字转中文大写
 *
 * 将阿拉伯数字转换为中文大写金额
 * 用于发票、订单等财务单据
 *
 * @param num - 要转换的数字
 * @returns 中文大写字符串
 *
 * @example
 * ```ts
 * numberToChinese(123.45)  // '壹佰贰拾叁元肆角伍分'
 * numberToChinese(10000)   // '壹万元整'
 * numberToChinese(0)       // '零元整'
 * ```
 */
export function numberToChinese(num: number): string {
  if (isNaN(num) || num < 0) {
    return '零元整';
  }

  if (num === 0) {
    return '零元整';
  }

  if (num < 0.01) {
    return '零元整';
  }

  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = '';

  // 转换整数部分
  if (integerPart === 0) {
    result = '零';
  } else {
    const numStr = integerPart.toString();
    const len = numStr.length;

    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i]);
      const pos = len - 1 - i;
      const unitIndex = pos % 4;
      const bigUnitIndex = Math.floor(pos / 4);

      if (digit === 0) {
        // 避免连续的零
        if (result.slice(-1) !== '零' && i < len - 1) {
          result += '零';
        }
      } else {
        result += digits[digit] + units[unitIndex];
      }

      // 添加万、亿单位
      if (unitIndex === 0 && bigUnitIndex > 0 && digit !== 0) {
        result += bigUnits[bigUnitIndex];
      }
    }

    // 去掉末尾的零
    result = result.replace(/零+$/, '');
  }

  // 添加"元"
  result += '元';

  // 添加小数部分
  if (decimalPart > 0) {
    const tenthsDigit = Math.floor(decimalPart / 10);
    const hundredthsDigit = decimalPart % 10;

    if (tenthsDigit > 0) {
      result += `${digits[tenthsDigit]}角`;
    }
    if (hundredthsDigit > 0) {
      result += `${digits[hundredthsDigit]}分`;
    }
  } else {
    result += '整';
  }

  return result;
}

/**
 * 格式化货币
 *
 * 将数字格式化为货币字符串
 *
 * @param value - 数值
 * @param currency - 货币符号，默认 '¥'
 * @param decimals - 小数位数，默认 2
 * @returns 格式化后的货币字符串
 *
 * @example
 * ```ts
 * formatCurrency(1234.5)           // '¥1,234.50'
 * formatCurrency(1234.5, '$')      // '$1,234.50'
 * formatCurrency(1234.567, '¥', 3) // '¥1,234.567'
 * ```
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = '¥',
  decimals: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  const formatted = value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${currency}${formatted}`;
}

/**
 * 计算总重量
 *
 * 计算订单明细的总重量（转换为吨）
 *
 * @param items - 订单明细数组
 * @returns 总重量（吨）
 *
 * @example
 * ```ts
 * const items = [
 *   { weight: 100, quantity: 10 },    // 100kg × 10 = 1000kg
 *   { weight: 50, quantity: 5 },      // 50kg × 5 = 250kg
 * ];
 * calculateTotalWeight(items) // 1.25 (吨)
 * ```
 */
export function calculateTotalWeight<
  T extends {
    weight?: number | null;
    manualWeight?: number | null;
    quantity: number;
  },
>(items: T[] | undefined): number {
  if (!items || items.length === 0) {
    return 0;
  }

  const totalWeightKg = items.reduce((sum, item) => {
    const weight = item.manualWeight ?? item.weight ?? 0;
    return sum + weight * item.quantity;
  }, 0);

  // 转换为吨（保留3位小数）
  return Math.round((totalWeightKg / 1000) * 1000) / 1000;
}

/**
 * 格式化打印日期
 *
 * @param date - 日期对象或字符串
 * @param format - 格式类型
 * @returns 格式化的日期字符串
 *
 * @example
 * ```ts
 * formatPrintDate(new Date('2025-01-15'))           // '2025年01月15日'
 * formatPrintDate('2025-01-15', 'short')            // '2025-01-15'
 * formatPrintDate(new Date('2025-01-15'), 'time')   // '2025-01-15 14:30:00'
 * ```
 */
export function formatPrintDate(
  date: Date | string | null | undefined,
  format: 'long' | 'short' | 'time' = 'long'
): string {
  if (!date) {
    return '-';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '-';
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  switch (format) {
    case 'long':
      return `${year}年${month}月${day}日`;

    case 'short':
      return `${year}-${month}-${day}`;

    case 'time': {
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    default:
      return `${year}年${month}月${day}日`;
  }
}

/**
 * 格式化当前日期时间
 *
 * 用于页脚打印时间戳
 *
 * @returns 格式化的当前时间字符串
 *
 * @example
 * ```ts
 * formatCurrentDateTime() // '2025年01月15日 14:30:00'
 * ```
 */
export function formatCurrentDateTime(): string {
  const now = new Date();
  return formatPrintDate(now, 'time');
}

/**
 * 格式化页码
 *
 * 替换页码模板变量
 *
 * @param template - 页码模板字符串
 * @param pageNumber - 当前页码
 * @param totalPages - 总页数
 * @returns 格式化后的页码字符串
 *
 * @example
 * ```ts
 * formatPageNumber('第 {pageNumber} 页，共 {totalPages} 页', 1, 5)
 * // '第 1 页，共 5 页'
 *
 * formatPageNumber('Page {pageNumber} of {totalPages}', 2, 10)
 * // 'Page 2 of 10'
 * ```
 */
export function formatPageNumber(
  template: string,
  pageNumber: number,
  totalPages: number
): string {
  return template
    .replace('{pageNumber}', String(pageNumber))
    .replace('{totalPages}', String(totalPages));
}

/**
 * 格式化页脚内容
 *
 * 替换所有模板变量（页码、日期、时间）
 *
 * @param template - 页脚模板字符串
 * @param pageNumber - 当前页码
 * @param totalPages - 总页数
 * @returns 格式化后的页脚字符串
 *
 * @example
 * ```ts
 * const template = '第 {pageNumber} 页，共 {totalPages} 页 | 打印日期：{date} {time}';
 * formatFooterContent(template, 1, 1)
 * // '第 1 页，共 1 页 | 打印日期：2025年01月15日 14:30:00'
 * ```
 */
export function formatFooterContent(
  template: string,
  pageNumber: number = 1,
  totalPages: number = 1
): string {
  const now = new Date();
  const date = formatPrintDate(now, 'long');
  const time = now.toLocaleTimeString('zh-CN', { hour12: false });

  return template
    .replace('{pageNumber}', String(pageNumber))
    .replace('{totalPages}', String(totalPages))
    .replace('{date}', date)
    .replace('{time}', time);
}

/**
 * 格式化重量
 *
 * @param weight - 重量值（kg）
 * @param unit - 单位类型
 * @param decimals - 小数位数
 * @returns 格式化的重量字符串
 *
 * @example
 * ```ts
 * formatWeight(1234)           // '1.234吨'
 * formatWeight(1234, 'kg')     // '1234.00kg'
 * formatWeight(1234, 'ton', 1) // '1.2吨'
 * ```
 */
export function formatWeight(
  weight: number | null | undefined,
  unit: 'kg' | 'ton' = 'ton',
  decimals: number = 3
): string {
  if (weight === null || weight === undefined || isNaN(weight)) {
    return '-';
  }

  if (unit === 'ton') {
    const tons = weight / 1000;
    return `${tons.toFixed(decimals)}吨`;
  }

  return `${weight.toFixed(decimals)}kg`;
}

/**
 * 格式化数量
 *
 * @param quantity - 数量值
 * @param unit - 单位
 * @returns 格式化的数量字符串
 *
 * @example
 * ```ts
 * formatQuantity(100, '件')  // '100件'
 * formatQuantity(1.5, '吨')  // '1.50吨'
 * ```
 */
export function formatQuantity(
  quantity: number | null | undefined,
  unit: string = ''
): string {
  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return '-';
  }

  // 整数不显示小数
  if (Number.isInteger(quantity)) {
    return `${quantity}${unit}`;
  }

  // 小数保留2位
  return `${quantity.toFixed(2)}${unit}`;
}

/**
 * 安全获取嵌套对象属性
 *
 * 用于安全访问可能为 undefined 的嵌套属性
 *
 * @param obj - 对象
 * @param path - 属性路径
 * @param defaultValue - 默认值
 * @returns 属性值或默认值
 *
 * @example
 * ```ts
 * const order = { customer: { name: '张三' } };
 * safeGet(order, 'customer.name', '-')    // '张三'
 * safeGet(order, 'customer.phone', '-')   // '-'
 * safeGet(order, 'supplier.name', '未知')  // '未知'
 * ```
 */
export function safeGet<T = unknown>(
  obj: unknown,
  path: string,
  defaultValue: T = '-' as T
): T {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }

  const keys = path.split('.');
  let result: unknown = obj;

  for (const key of keys) {
    if (
      result &&
      typeof result === 'object' &&
      key in result &&
      result[key as keyof typeof result] !== undefined
    ) {
      result = result[key as keyof typeof result];
    } else {
      return defaultValue;
    }
  }

  return (result ?? defaultValue) as T;
}

/**
 * 格式化电话号码
 *
 * @param phone - 电话号码
 * @returns 格式化的电话号码
 *
 * @example
 * ```ts
 * formatPhone('13812345678')  // '138-1234-5678'
 * formatPhone('010-12345678') // '010-12345678'
 * formatPhone(null)           // '-'
 * ```
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) {
    return '-';
  }

  // 移动电话：138-1234-5678
  if (/^1[3-9]\d{9}$/.test(phone)) {
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  // 其他情况直接返回
  return phone;
}

/**
 * 格式化订单状态
 *
 * @param status - 订单状态代码
 * @param statusMap - 状态映射表
 * @returns 状态中文名称
 *
 * @example
 * ```ts
 * const map = { pending: '待处理', confirmed: '已确认' };
 * formatOrderStatus('pending', map)  // '待处理'
 * formatOrderStatus('unknown', map)  // 'unknown'
 * ```
 */
export function formatOrderStatus(
  status: string | null | undefined,
  statusMap: Record<string, string> = {}
): string {
  if (!status) {
    return '-';
  }

  return statusMap[status] || status;
}

/**
 * 默认订单状态映射表
 */
export const DEFAULT_ORDER_STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

/**
 * 计算订单明细总数量
 *
 * @param items - 订单明细数组
 * @returns 总数量
 */
export function calculateTotalQuantity<T extends { quantity: number }>(
  items: T[] | undefined
): number {
  if (!items || items.length === 0) {
    return 0;
  }

  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/**
 * 计算订单明细总金额
 *
 * @param items - 订单明细数组
 * @returns 总金额
 */
export function calculateTotalAmount<
  T extends { subtotal?: number; quantity?: number; unitPrice?: number },
>(items: T[] | undefined): number {
  if (!items || items.length === 0) {
    return 0;
  }

  return items.reduce((sum, item) => {
    // 优先使用行小计，避免四舍五入误差
    if (typeof item.subtotal === 'number') {
      return sum + item.subtotal;
    }

    // 备选：quantity × unitPrice
    if (
      typeof item.quantity === 'number' &&
      typeof item.unitPrice === 'number'
    ) {
      return sum + item.quantity * item.unitPrice;
    }

    return sum;
  }, 0);
}
