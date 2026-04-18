/**
 * 打印设计器 - 视觉元素 Schema
 *
 * 包含图片和条码元素
 */

import { z } from 'zod';

import { BaseElementSchema, HexColorSchema } from './base';

// ============================================================================
// 图片元素
// ============================================================================

/** 图片适应方式 */
export const ImageFitSchema = z.enum(['contain', 'cover', 'fill']);

export type ImageFit = z.infer<typeof ImageFitSchema>;

export const ImageElementSchema = BaseElementSchema.extend({
  /** 元素类型 */
  type: z.literal('image'),

  /** 图片源 (URL 或数据路径如 'company.logo') */
  src: z.string(),

  /** 是否为动态数据绑定 */
  isDynamic: z.boolean().default(false),

  /** 图片适应方式 */
  fit: ImageFitSchema.default('contain'),
});

export type ImageElement = z.infer<typeof ImageElementSchema>;

// ============================================================================
// 条码元素
// ============================================================================

/** 条码格式 */
export const BarcodeFormatSchema = z.enum(['CODE128', 'CODE39', 'QR']);

export type BarcodeFormat = z.infer<typeof BarcodeFormatSchema>;

export const BarcodeElementSchema = BaseElementSchema.extend({
  /** 元素类型 */
  type: z.literal('barcode'),

  /** 数据路径 (如 'order.orderNumber') */
  field: z.string().min(1),

  /** 条码格式 */
  format: BarcodeFormatSchema.default('CODE128'),

  /** 是否显示条码下方文字 */
  showText: z.boolean().default(true),
});

export type BarcodeElement = z.infer<typeof BarcodeElementSchema>;

// ============================================================================
// 线条 / 边框元素
// ============================================================================

/** 线条样式 */
export const DashStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

export type DashStyle = z.infer<typeof DashStyleSchema>;

export const LineStyleSchema = z.object({
  color: HexColorSchema.default('#64748b'),
  strokeWidth: z.number().min(0.2).max(6).default(0.6),
  dashStyle: DashStyleSchema.default('solid'),
});

export type LineStyle = z.infer<typeof LineStyleSchema>;

export const RectStyleSchema = z.object({
  borderColor: HexColorSchema.default('#94a3b8'),
  borderWidth: z.number().min(0.2).max(6).default(0.6),
  dashStyle: DashStyleSchema.default('solid'),
  fillColor: HexColorSchema.default('#ffffff'),
  fillOpacity: z.number().min(0).max(1).default(0),
  radius: z.number().min(0).max(20).default(0),
});

export type RectStyle = z.infer<typeof RectStyleSchema>;

export const LineElementSchema = BaseElementSchema.extend({
  type: z.literal('line'),
  style: LineStyleSchema,
});

export type LineElement = z.infer<typeof LineElementSchema>;

export const RectElementSchema = BaseElementSchema.extend({
  type: z.literal('rect'),
  style: RectStyleSchema,
});

export type RectElement = z.infer<typeof RectElementSchema>;

// ============================================================================
// 工具函数
// ============================================================================

/** 创建默认图片元素 */
export function createDefaultImageElement(
  id: string,
  position = { x: 10, y: 10 }
): ImageElement {
  return {
    id,
    type: 'image',
    position,
    size: { width: 30, height: 20 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    src: '',
    isDynamic: false,
    fit: 'contain',
  };
}

/** 创建默认条码元素 */
export function createDefaultBarcodeElement(
  id: string,
  field: string,
  position = { x: 10, y: 10 }
): BarcodeElement {
  return {
    id,
    type: 'barcode',
    position,
    size: { width: 60, height: 15 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    field,
    format: 'CODE128',
    showText: true,
  };
}

/** 创建默认横线元素 */
export function createDefaultLineElement(
  id: string,
  position = { x: 10, y: 10 }
): LineElement {
  return {
    id,
    type: 'line',
    position,
    size: { width: 60, height: 2 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    style: {
      color: '#64748b',
      strokeWidth: 0.6,
      dashStyle: 'solid',
    },
  };
}

/** 创建默认边框框元素 */
export function createDefaultRectElement(
  id: string,
  position = { x: 10, y: 10 }
): RectElement {
  return {
    id,
    type: 'rect',
    position,
    size: { width: 40, height: 20 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    style: {
      borderColor: '#94a3b8',
      borderWidth: 0.6,
      dashStyle: 'solid',
      fillColor: '#ffffff',
      fillOpacity: 0,
      radius: 0,
    },
  };
}
