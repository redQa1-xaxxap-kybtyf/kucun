/**
 * 打印设计器 - 视觉元素 Schema
 *
 * 包含图片和条码元素
 */

import { z } from 'zod';

import { BaseElementSchema } from './base';

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
