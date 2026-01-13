/**
 * 打印设计器 - 表格元素 Schema
 *
 * 用于渲染订单明细等列表数据
 */

import { z } from 'zod';

import { BaseElementSchema, HexColorSchema, TextAlignSchema } from './base';

// ============================================================================
// 表格列定义
// ============================================================================

/** 列格式化类型 */
export const ColumnFormatSchema = z.enum([
  'text',
  'number',
  'currency',
  'date_cn',
]);

export type ColumnFormat = z.infer<typeof ColumnFormatSchema>;

/** 列宽单位 */
export const WidthUnitSchema = z.enum(['mm', '%']);

export type WidthUnit = z.infer<typeof WidthUnitSchema>;

/** 表格列定义 */
export const TableColumnSchema = z.object({
  /** 数据字段名 (对应 item 中的 key) */
  key: z.string().min(1),

  /** 列标题 */
  label: z.string().min(1),

  /** 列宽 */
  width: z.number().min(5),

  /** 列宽单位 */
  widthUnit: WidthUnitSchema.default('%'),

  /** 对齐方式 */
  align: TextAlignSchema.default('left'),

  /** 格式化类型 */
  format: ColumnFormatSchema.default('text'),
});

export type TableColumn = z.infer<typeof TableColumnSchema>;

// ============================================================================
// 表格样式
// ============================================================================

export const TableStyleSchema = z.object({
  /** 表头背景色 */
  headerBgColor: HexColorSchema.default('#f5f5f5'),

  /** 表头文字颜色 */
  headerTextColor: HexColorSchema.default('#333333'),

  /** 表头字号 (pt) */
  headerFontSize: z.number().min(6).max(24).default(10),

  /** 表体字号 (pt) */
  bodyFontSize: z.number().min(6).max(24).default(9),

  /** 边框颜色 */
  borderColor: HexColorSchema.default('#cccccc'),

  /** 边框宽度 (px) */
  borderWidth: z.number().min(0).max(3).default(0.5),

  /** 行高 (mm) */
  rowHeight: z.number().min(3).max(20).default(6),

  /** 是否显示斑马纹 */
  stripedRows: z.boolean().default(false),

  /** 斑马纹颜色 */
  stripedColor: HexColorSchema.default('#fafafa'),
});

export type TableStyle = z.infer<typeof TableStyleSchema>;

// ============================================================================
// 表格元素
// ============================================================================

export const TableElementSchema = BaseElementSchema.extend({
  /** 元素类型 */
  type: z.literal('table'),

  /** 数据源路径 (通常为 'items') */
  dataSource: z.string().default('items'),

  /** 列定义 */
  columns: z.array(TableColumnSchema).min(1),

  /** 表格样式 */
  style: TableStyleSchema,

  /** 是否显示合计行 */
  showSummary: z.boolean().default(false),

  /** 合计列 (哪些列需要求和) */
  summaryColumns: z.array(z.string()).optional(),

  /** 最小行数 (用于套打时填充空行) */
  minRows: z.number().min(0).optional(),
});

export type TableElement = z.infer<typeof TableElementSchema>;

// ============================================================================
// 工具函数
// ============================================================================

/** 创建默认表格元素 */
export function createDefaultTableElement(
  id: string,
  position = { x: 10, y: 50 }
): TableElement {
  return {
    id,
    type: 'table',
    position,
    size: { width: 190, height: 80 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    dataSource: 'items',
    columns: [
      { key: 'name', label: '名称', width: 30, widthUnit: '%', align: 'left', format: 'text' },
      { key: 'quantity', label: '数量', width: 15, widthUnit: '%', align: 'right', format: 'number' },
      { key: 'unitPrice', label: '单价', width: 20, widthUnit: '%', align: 'right', format: 'currency' },
      { key: 'subtotal', label: '金额', width: 20, widthUnit: '%', align: 'right', format: 'currency' },
    ],
    style: {
      headerBgColor: '#f5f5f5',
      headerTextColor: '#333333',
      headerFontSize: 10,
      bodyFontSize: 9,
      borderColor: '#cccccc',
      borderWidth: 0.5,
      rowHeight: 6,
      stripedRows: false,
      stripedColor: '#fafafa',
    },
    showSummary: false,
  };
}
