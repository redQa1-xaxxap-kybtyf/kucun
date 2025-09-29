// 格式化工具函数
// 遵循全局约定规范，提供统一的数据格式化功能

/**
 * 格式化货币金额
 * @param amount 金额数值
 * @param currency 货币符号，默认为 ¥
 * @param precision 小数位数，默认为 2
 * @returns 格式化后的货币字符串
 */
export function formatCurrency(
  amount: number,
  currency: string = '¥',
  precision: number = 2
): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `${currency}0.00`;
  }

  return `${currency}${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

/**
 * 格式化数字
 * @param value 数值
 * @param precision 小数位数，默认为 0
 * @returns 格式化后的数字字符串
 */
export function formatNumber(value: number, precision: number = 0): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }

  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/**
 * 格式化百分比
 * @param value 数值（0-1 之间）
 * @param precision 小数位数，默认为 1
 * @returns 格式化后的百分比字符串
 */
export function formatPercentage(value: number, precision: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  return `${(value * 100).toFixed(precision)}%`;
}

/**
 * 格式化日期
 * @param date 日期对象或日期字符串
 * @param format 格式类型
 * @returns 格式化后的日期字符串
 */
export function formatDate(
  date: Date | string,
  format: 'date' | 'datetime' | 'time' = 'date'
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Shanghai',
  };

  switch (format) {
    case 'date':
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
      break;
    case 'datetime':
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
  }

  return dateObj.toLocaleDateString('zh-CN', options);
}

/**
 * 格式化相对时间
 * @param date 日期对象或日期字符串
 * @returns 相对时间字符串
 */
export function formatRelativeTime(date: Date | string): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return formatDate(dateObj);
  }
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param precision 小数位数，默认为 1
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number, precision: number = 1): string {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

/**
 * 格式化手机号
 * @param phone 手机号字符串
 * @returns 格式化后的手机号
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';

  // 移除所有非数字字符
  const cleaned = phone.replace(/\D/g, '');

  // 中国手机号格式化
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
  }

  return phone;
}

/**
 * 格式化身份证号
 * @param idCard 身份证号字符串
 * @returns 格式化后的身份证号（部分隐藏）
 */
export function formatIdCard(idCard: string): string {
  if (!idCard) return '';

  if (idCard.length === 18) {
    return `${idCard.slice(0, 6)}********${idCard.slice(-4)}`;
  } else if (idCard.length === 15) {
    return `${idCard.slice(0, 6)}*****${idCard.slice(-4)}`;
  }

  return idCard;
}

/**
 * 格式化银行卡号
 * @param cardNumber 银行卡号字符串
 * @returns 格式化后的银行卡号（部分隐藏）
 */
export function formatBankCard(cardNumber: string): string {
  if (!cardNumber) return '';

  const cleaned = cardNumber.replace(/\s/g, '');

  if (cleaned.length >= 16) {
    return `${cleaned.slice(0, 4)} **** **** ${cleaned.slice(-4)}`;
  }

  return cardNumber;
}

/**
 * 截断文本
 * @param text 文本字符串
 * @param maxLength 最大长度
 * @param suffix 后缀，默认为 '...'
 * @returns 截断后的文本
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!text) return '';

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 格式化地址
 * @param address 地址对象或字符串
 * @returns 格式化后的地址字符串
 */
export function formatAddress(
  address:
    | string
    | { province?: string; city?: string; district?: string; detail?: string }
): string {
  if (!address) return '';

  if (typeof address === 'string') {
    return address;
  }

  const parts = [
    address.province,
    address.city,
    address.district,
    address.detail,
  ].filter(Boolean);

  return parts.join('');
}

/**
 * 格式化状态标签
 * @param status 状态值
 * @param statusLabels 状态标签映射
 * @returns 格式化后的状态标签
 */
export function formatStatus<T extends string>(
  status: T,
  statusLabels: Record<T, string>
): string {
  return statusLabels[status] || status;
}

/**
 * 格式化枚举值
 * @param value 枚举值
 * @param enumLabels 枚举标签映射
 * @returns 格式化后的枚举标签
 */
export function formatEnum<T extends string>(
  value: T,
  enumLabels: Record<T, string>
): string {
  return enumLabels[value] || value;
}
