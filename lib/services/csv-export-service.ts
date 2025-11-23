/**
 * CSV导出服务 - 统一CSV导出功能
 *
 * 功能：
 * - UTF-8 with BOM（防止中文乱码）
 * - 逗号分隔符
 * - 引号转义
 * - 日期格式化（Asia/Shanghai时区）
 * - 数据类型保持
 *
 * 设计原则：
 * - 单一职责：仅负责CSV格式化和下载
 * - 数据驱动：通过配置控制格式化行为
 */

import { formatInTimeZone } from 'date-fns-tz';

/**
 * CSV导出配置
 */
export interface CSVExportOptions<T extends Record<string, unknown>> {
  /** 文件名（不含扩展名） */
  filename: string;

  /** 表头映射：数据字段 -> 显示名称 */
  headerMapping?: Record<string, string>;

  /** 日期字段列表（需要时区转换） */
  dateFields?: (keyof T)[];

  /** 日期格式 */
  dateFormat?: string;

  /** 数值字段列表（保持数值格式） */
  numberFields?: (keyof T)[];

  /** 字段顺序（未指定则按headerMapping顺序） */
  fieldOrder?: (keyof T)[];

  /** 数据转换器（自定义字段格式化） */
  dataTransformer?: (value: unknown, field: keyof T, row: T) => string;
}

/**
 * CSV值转义
 * 处理包含逗号、引号、换行符的值
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let strValue = String(value);

  // 包含逗号、引号、换行符时需要用引号包裹
  if (
    strValue.includes(',') ||
    strValue.includes('"') ||
    strValue.includes('\n') ||
    strValue.includes('\r')
  ) {
    // 引号需要双写转义
    strValue = strValue.replace(/"/g, '""');
    return `"${strValue}"`;
  }

  return strValue;
}

/**
 * 格式化日期值（Asia/Shanghai时区）
 */
function formatDateValue(
  value: unknown,
  format = 'yyyy-MM-dd HH:mm:ss'
): string {
  if (!value) return '';

  try {
    const date = value instanceof Date ? value : new Date(String(value));
    if (isNaN(date.getTime())) return String(value);

    return formatInTimeZone(date, 'Asia/Shanghai', format);
  } catch {
    return String(value);
  }
}

/**
 * 格式化数值（保持数值格式）
 */
function formatNumberValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);

  const num = parseFloat(String(value));
  return isNaN(num) ? String(value) : String(num);
}

/**
 * CSV导出服务
 */
export class CSVExportService {
  /**
   * 导出数据为CSV文件
   *
   * @param data 数据数组
   * @param options 导出配置
   */
  static exportToCSV<T extends Record<string, unknown>>(
    data: T[],
    options: CSVExportOptions<T>
  ): void {
    const {
      filename,
      headerMapping = {},
      dateFields = [],
      dateFormat = 'yyyy-MM-dd HH:mm:ss',
      numberFields = [],
      fieldOrder,
      dataTransformer,
    } = options;

    if (data.length === 0) {
      throw new Error('导出数据为空');
    }

    // 确定字段顺序
    const fields: (keyof T)[] =
      fieldOrder ||
      (Object.keys(headerMapping).length > 0
        ? (Object.keys(headerMapping) as (keyof T)[])
        : (Object.keys(data[0]) as (keyof T)[]));

    // 生成表头行
    const headers = fields
      .map(field => {
        const headerName = headerMapping[field as string] || String(field);
        return escapeCSVValue(headerName);
      })
      .join(',');

    // 生成数据行
    const rows = data.map(row =>
      fields
        .map(field => {
          const value = row[field];

          // 自定义转换器优先
          if (dataTransformer) {
            const transformed = dataTransformer(value, field, row);
            return escapeCSVValue(transformed);
          }

          // 日期字段处理
          if (dateFields.includes(field)) {
            return escapeCSVValue(formatDateValue(value, dateFormat));
          }

          // 数值字段处理
          if (numberFields.includes(field)) {
            return formatNumberValue(value);
          }

          // 默认处理
          return escapeCSVValue(value);
        })
        .join(',')
    );

    // UTF-8 BOM（防止Excel打开时中文乱码）
    const BOM = '\uFEFF';

    // 组装完整CSV内容
    const csvContent = BOM + [headers, ...rows].join('\n');

    // 触发下载
    this.downloadCSV(csvContent, filename);
  }

  /**
   * 触发CSV文件下载
   *
   * @param content CSV内容
   * @param filename 文件名（不含扩展名）
   */
  private static downloadCSV(content: string, filename: string): void {
    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });

    // 创建下载链接
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = `${filename}.csv`;
    link.style.display = 'none';

    // 触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * 生成CSV内容（不触发下载）
   * 用于服务端生成或预览
   *
   * @param data 数据数组
   * @param options 导出配置
   * @returns CSV内容字符串
   */
  static generateCSVContent<T extends Record<string, unknown>>(
    data: T[],
    options: Omit<CSVExportOptions<T>, 'filename'>
  ): string {
    const {
      headerMapping = {},
      dateFields = [],
      dateFormat = 'yyyy-MM-dd HH:mm:ss',
      numberFields = [],
      fieldOrder,
      dataTransformer,
    } = options;

    if (data.length === 0) {
      return '';
    }

    // 确定字段顺序
    const fields: (keyof T)[] =
      fieldOrder ||
      (Object.keys(headerMapping).length > 0
        ? (Object.keys(headerMapping) as (keyof T)[])
        : (Object.keys(data[0]) as (keyof T)[]));

    // 生成表头行
    const headers = fields
      .map(field => {
        const headerName = headerMapping[field as string] || String(field);
        return escapeCSVValue(headerName);
      })
      .join(',');

    // 生成数据行
    const rows = data.map(row =>
      fields
        .map(field => {
          const value = row[field];

          // 自定义转换器优先
          if (dataTransformer) {
            const transformed = dataTransformer(value, field, row);
            return escapeCSVValue(transformed);
          }

          // 日期字段处理
          if (dateFields.includes(field)) {
            return escapeCSVValue(formatDateValue(value, dateFormat));
          }

          // 数值字段处理
          if (numberFields.includes(field)) {
            return formatNumberValue(value);
          }

          // 默认处理
          return escapeCSVValue(value);
        })
        .join(',')
    );

    // UTF-8 BOM
    const BOM = '\uFEFF';

    return BOM + [headers, ...rows].join('\n');
  }
}
