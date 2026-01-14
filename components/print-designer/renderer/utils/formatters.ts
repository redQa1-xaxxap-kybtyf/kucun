/**
 * 打印设计器 - 格式化工具
 *
 * 提供各种数据格式化函数
 */

import type { PlaceholderFormat } from '@/lib/print-designer/schemas';

/**
 * 格式化值
 *
 * @param value - 原始值
 * @param format - 格式化类型
 * @returns 格式化后的字符串
 */
export function formatValue(value: unknown, format: PlaceholderFormat): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (format) {
    case 'date_cn':
      return formatDateCn(value);
    case 'currency':
      return formatCurrency(value);
    case 'currency_cap':
      return numberToChineseCurrency(value);
    case 'number':
      return formatNumber(value);
    case 'text':
    default:
      return String(value);
  }
}

/**
 * 中文日期格式 (YYYY年MM月DD日)
 */
function formatDateCn(value: unknown): string {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(String(value));

  if (isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}年${month}月${day}日`;
}

/**
 * 货币格式 (¥1,234.56)
 */
function formatCurrency(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return String(value);
  }

  return `¥${num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * 数字格式 (带千分位)
 */
function formatNumber(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return String(value);
  }

  return num.toLocaleString('zh-CN');
}

/**
 * 人民币大写转换
 *
 * @param value - 数值
 * @returns 大写金额字符串
 *
 * @example
 * numberToChineseCurrency(1234.56) // '壹仟贰佰叁拾肆元伍角陆分'
 */
export function numberToChineseCurrency(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return String(value);
  }

  if (num === 0) {
    return '零元整';
  }

  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿', '兆'];
  const decimalUnits = ['角', '分'];

  const absNum = Math.abs(num);
  const [intPart, decPart = '00'] = absNum.toFixed(2).split('.');

  let result = '';

  // 处理整数部分
  if (intPart !== '0') {
    const intStr = intPart.padStart(Math.ceil(intPart.length / 4) * 4, '0');
    const sections = intStr.length / 4;

    for (let i = 0; i < sections; i++) {
      const section = intStr.slice(i * 4, (i + 1) * 4);
      let sectionResult = '';
      let hasNonZero = false;

      for (let j = 0; j < 4; j++) {
        const digit = parseInt(section[j], 10);
        if (digit !== 0) {
          if (!hasNonZero && sectionResult) {
            sectionResult += '零';
          }
          sectionResult += digits[digit] + units[3 - j];
          hasNonZero = true;
        } else if (hasNonZero && j < 3 && parseInt(section[j + 1], 10) !== 0) {
          sectionResult += '零';
          hasNonZero = false;
        }
      }

      if (sectionResult) {
        result += sectionResult + bigUnits[sections - i - 1];
      }
    }

    result = `${result.replace(/零+$/, '')}元`;
  }

  // 处理小数部分
  if (decPart === '00') {
    result += '整';
  } else {
    const jiao = parseInt(decPart[0], 10);
    const fen = parseInt(decPart[1], 10);

    if (jiao !== 0) {
      result += digits[jiao] + decimalUnits[0];
    } else if (fen !== 0 && result) {
      result += '零';
    }

    if (fen !== 0) {
      result += digits[fen] + decimalUnits[1];
    }
  }

  return (num < 0 ? '负' : '') + result;
}
