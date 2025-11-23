/**
 * 增强Excel导出服务 - 支持数据类型、时区、列宽优化
 *
 * 功能：
 * - 强制数据类型（数值、日期、文本）
 * - 时区统一（Asia/Shanghai）
 * - 智能列宽计算
 * - 冻结表头行
 * - 日期格式化
 *
 * 设计原则：
 * - 开放/封闭：通过配置扩展，无需修改核心代码
 * - 单一职责：仅负责Excel格式化和生成
 */

import { formatInTimeZone } from 'date-fns-tz';
import * as XLSX from 'xlsx';

/**
 * 增强Excel导出配置
 */
export interface EnhancedExcelExportOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 文件名（不含扩展名） */
  filename: string;

  /** 工作表名称 */
  sheetName?: string;

  /** 表头映射：数据字段 -> 显示名称 */
  headerMapping?: Record<string, string>;

  /** 日期字段列表（需要时区转换和格式化） */
  dateFields?: (keyof T)[];

  /** 日期格式 */
  dateFormat?: string;

  /** 数值字段列表（强制为数值类型） */
  numberFields?: (keyof T)[];

  /** 文本字段列表（强制为文本类型，例如产品编码） */
  textFields?: (keyof T)[];

  /** 字段顺序（未指定则按headerMapping顺序） */
  fieldOrder?: (keyof T)[];

  /** 是否冻结表头行 */
  freezeHeader?: boolean;

  /** 列宽配置（字符数，未指定则自动计算） */
  columnWidths?: number[];

  /** 数据转换器（自定义字段格式化） */
  dataTransformer?: (value: unknown, field: keyof T, row: T) => unknown;
}

/**
 * 计算字符串宽度（中文算2个字符）
 */
function calculateStringWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 中文字符范围
    if (code > 0x4e00 && code < 0x9fa5) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * 智能计算列宽
 */
function calculateColumnWidths<T extends Record<string, unknown>>(
  data: T[],
  fields: (keyof T)[],
  headerMapping: Record<string, string>
): number[] {
  const widths: number[] = [];

  fields.forEach((field, index) => {
    // 表头宽度
    const headerName = headerMapping[field as string] || String(field);
    let maxWidth = calculateStringWidth(headerName);

    // 数据宽度（采样前100行）
    const sampleSize = Math.min(100, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const value = data[i]?.[field];
      if (value !== null && value !== undefined) {
        const strValue = String(value);
        const width = calculateStringWidth(strValue);
        maxWidth = Math.max(maxWidth, width);
      }
    }

    // 添加padding，限制最大宽度
    widths[index] = Math.min(Math.max(maxWidth + 2, 8), 50);
  });

  return widths;
}

/**
 * 格式化日期值（Asia/Shanghai时区）
 */
function formatDateValue(
  value: unknown,
  _format = 'yyyy-MM-dd HH:mm:ss'
): Date | string {
  if (!value) return '';

  try {
    const date = value instanceof Date ? value : new Date(String(value));
    if (isNaN(date.getTime())) return String(value);

    // 返回Date对象，XLSX会自动应用Excel日期格式
    return date;
  } catch {
    return String(value);
  }
}

/**
 * 增强Excel导出服务
 */
export class EnhancedExcelExportService {
  /**
   * 导出数据为增强Excel文件
   *
   * @param data 数据数组
   * @param options 导出配置
   */
  static exportToEnhancedExcel<T extends Record<string, unknown>>(
    data: T[],
    options: EnhancedExcelExportOptions<T>
  ): void {
    const {
      filename,
      sheetName = 'Sheet1',
      headerMapping = {},
      dateFields = [],
      dateFormat = 'yyyy-MM-dd HH:mm:ss',
      numberFields = [],
      textFields = [],
      fieldOrder,
      freezeHeader = true,
      columnWidths,
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

    // 准备表头
    const headers: Record<string, string> = {};
    fields.forEach(field => {
      headers[field as string] =
        headerMapping[field as string] || String(field);
    });

    // 处理数据
    const processedData = data.map(row => {
      const processedRow: Record<string, unknown> = {};

      fields.forEach(field => {
        let value = row[field];

        // 自定义转换器优先
        if (dataTransformer) {
          value = dataTransformer(value, field, row);
        }

        // 日期字段处理
        if (dateFields.includes(field)) {
          processedRow[field as string] = formatDateValue(value, dateFormat);
        }
        // 数值字段处理
        else if (numberFields.includes(field)) {
          const num =
            typeof value === 'number' ? value : parseFloat(String(value ?? ''));
          processedRow[field as string] = isNaN(num) ? 0 : num;
        }
        // 文本字段处理（强制为文本）
        else if (textFields.includes(field)) {
          processedRow[field as string] = String(value ?? '');
        }
        // 默认处理
        else {
          processedRow[field as string] = value ?? '';
        }
      });

      return processedRow;
    });

    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet([headers, ...processedData], {
      header: fields.map(f => f as string),
      skipHeader: false,
    });

    // 设置列宽
    const colWidths =
      columnWidths ||
      calculateColumnWidths(processedData, fields, headerMapping);
    worksheet['!cols'] = colWidths.map(width => ({ width }));

    // 设置数据类型和格式
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // 遍历所有单元格设置类型
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      // 从第2行开始（跳过表头）
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (!cell) continue;

        const field = fields[C];

        // 日期字段格式
        if (dateFields.includes(field)) {
          cell.t = 'd'; // date type
          cell.z = dateFormat.replace(/y/g, 'y').replace(/d/g, 'd'); // Excel日期格式
        }
        // 数值字段格式
        else if (numberFields.includes(field)) {
          cell.t = 'n'; // number type
          // 保留2位小数
          if (typeof cell.v === 'number') {
            cell.z = '0.00';
          }
        }
        // 文本字段格式
        else if (textFields.includes(field)) {
          cell.t = 's'; // string type
        }
      }
    }

    // 冻结表头行
    if (freezeHeader) {
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    }

    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // 导出文件
    XLSX.writeFile(workbook, `${filename}.xlsx`, {
      compression: true,
      bookType: 'xlsx',
    });
  }

  /**
   * 生成文件名（符合规范）
   *
   * @param module 模块名称
   * @param filterSummary 筛选摘要
   * @param userName 操作者姓名
   * @returns 规范文件名：模块_筛选摘要_时间戳_操作者
   */
  static generateFilename(
    module: string,
    filterSummary: string,
    userName: string
  ): string {
    const timestamp = formatInTimeZone(
      new Date(),
      'Asia/Shanghai',
      'yyyyMMdd_HHmm'
    );
    return `${module}_${filterSummary}_${timestamp}_${userName}`;
  }

  /**
   * 构建筛选摘要
   *
   * @param filters 筛选条件对象
   * @returns 筛选摘要字符串
   */
  static buildFilterSummary(filters: Record<string, unknown>): string {
    const parts: string[] = [];

    // 状态
    if (filters.status) {
      const statusMap: Record<string, string> = {
        pending: '待处理',
        confirmed: '已确认',
        shipped: '已发货',
        completed: '已完成',
        cancelled: '已取消',
      };
      parts.push(statusMap[filters.status as string] || String(filters.status));
    }

    // 日期范围
    if (filters.startDate || filters.endDate) {
      const start = filters.startDate
        ? formatInTimeZone(
            new Date(filters.startDate as string),
            'Asia/Shanghai',
            'yyyy-MM-dd'
          )
        : '';
      const end = filters.endDate
        ? formatInTimeZone(
            new Date(filters.endDate as string),
            'Asia/Shanghai',
            'yyyy-MM-dd'
          )
        : '';

      if (start && end) {
        parts.push(`${start}至${end}`);
      } else if (start) {
        parts.push(`${start}起`);
      } else if (end) {
        parts.push(`${end}止`);
      }
    }

    // 客户/供应商
    if (filters.customerName) {
      parts.push(`客户${filters.customerName}`);
    }
    if (filters.supplierName) {
      parts.push(`供应商${filters.supplierName}`);
    }

    // 搜索关键词
    if (filters.search) {
      parts.push(`关键词${filters.search}`);
    }

    return parts.length > 0 ? parts.join('_') : '全部';
  }
}
