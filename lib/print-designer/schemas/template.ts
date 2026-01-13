/**
 * 打印设计器 - 模板 Schema
 *
 * 定义完整的打印模板结构
 */

import { z } from 'zod';

import { PlaceholderElementSchema } from './placeholder-element';
import { TableElementSchema } from './table-element';
import { TextElementSchema } from './text-element';
import { BarcodeElementSchema, ImageElementSchema } from './visual-elements';

// ============================================================================
// 元素联合类型
// ============================================================================

export const DesignElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  PlaceholderElementSchema,
  TableElementSchema,
  ImageElementSchema,
  BarcodeElementSchema,
]);

export type DesignElement = z.infer<typeof DesignElementSchema>;

// ============================================================================
// 页面设置
// ============================================================================

/** 纸张大小 */
export const PaperSizeSchema = z.enum(['A4', 'A5', 'Letter', 'Custom']);

export type PaperSize = z.infer<typeof PaperSizeSchema>;

/** 页面方向 */
export const OrientationSchema = z.enum(['portrait', 'landscape']);

export type Orientation = z.infer<typeof OrientationSchema>;

/** 页面设置 */
export const PageSettingsSchema = z.object({
  /** 纸张类型 */
  size: PaperSizeSchema.default('A4'),

  /** 宽度 (mm) */
  width: z.number().default(210),

  /** 高度 (mm) */
  height: z.number().default(297),

  /** 页面方向 */
  orientation: OrientationSchema.default('portrait'),

  /** 内边距 [上, 右, 下, 左] (mm) */
  padding: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .default([10, 10, 10, 10]),
});

export type PageSettings = z.infer<typeof PageSettingsSchema>;

// ============================================================================
// 模板类型
// ============================================================================

/** 模板类型 */
export const TemplateTypeSchema = z.enum([
  'sales-order',
  'purchase-order',
  'factory-shipment',
  'delivery-note',
  'inbound-record',
  'return-order',
  'custom',
]);

export type TemplateType = z.infer<typeof TemplateTypeSchema>;

// ============================================================================
// 完整模板
// ============================================================================

export const PrintTemplateSchema = z.object({
  /** 模板 ID */
  id: z.string().uuid(),

  /** 版本号 (用于数据迁移) */
  version: z.number().int().default(1),

  /** 模板名称 */
  name: z.string().min(1).max(100),

  /** 模板描述 */
  description: z.string().max(500).optional(),

  /** 模板类型 */
  type: TemplateTypeSchema,

  /** 页面设置 */
  pageSettings: PageSettingsSchema,

  /** 元素列表 */
  elements: z.array(DesignElementSchema),

  /** 创建时间 */
  createdAt: z.string().datetime().optional(),

  /** 更新时间 */
  updatedAt: z.string().datetime().optional(),
});

export type PrintTemplate = z.infer<typeof PrintTemplateSchema>;

// ============================================================================
// 工具函数
// ============================================================================

/** 获取纸张尺寸 */
export function getPaperDimensions(
  size: PaperSize,
  orientation: Orientation
): { width: number; height: number } {
  const sizes: Record<PaperSize, { width: number; height: number }> = {
    A4: { width: 210, height: 297 },
    A5: { width: 148, height: 210 },
    Letter: { width: 216, height: 279 },
    Custom: { width: 210, height: 297 },
  };

  const base = sizes[size];

  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }

  return base;
}

/** 创建空白模板 */
export function createEmptyTemplate(
  id: string,
  name: string,
  type: TemplateType
): PrintTemplate {
  return {
    id,
    version: 1,
    name,
    type,
    pageSettings: {
      size: 'A4',
      width: 210,
      height: 297,
      orientation: 'portrait',
      padding: [10, 10, 10, 10],
    },
    elements: [],
  };
}
