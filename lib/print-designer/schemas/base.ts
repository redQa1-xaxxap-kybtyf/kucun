/**
 * 打印设计器 - 基础类型定义
 *
 * 定义所有元素共享的基础类型
 * 遵循 KISS 原则：只定义必要的基础类型
 */

import { z } from 'zod';

// ============================================================================
// 基础值类型
// ============================================================================

/** 位置 (单位: mm) */
export const PositionSchema = z.object({
  x: z.number().describe('水平位置 (mm)'),
  y: z.number().describe('垂直位置 (mm)'),
});

export type Position = z.infer<typeof PositionSchema>;

/** 尺寸 (单位: mm) */
export const SizeSchema = z.object({
  width: z.number().min(1).describe('宽度 (mm)'),
  height: z.number().min(1).describe('高度 (mm)'),
});

export type Size = z.infer<typeof SizeSchema>;

// ============================================================================
// 枚举类型
// ============================================================================

/** 支持的字体 */
export const FontFamilySchema = z.enum([
  'SimSun',
  'SimHei',
  'Microsoft YaHei',
  'Arial',
  'Times New Roman',
]);

export type FontFamily = z.infer<typeof FontFamilySchema>;

/** 字重 */
export const FontWeightSchema = z.enum(['normal', 'bold']);

export type FontWeight = z.infer<typeof FontWeightSchema>;

/** 字体风格 */
export const FontStyleSchema = z.enum(['normal', 'italic']);

export type FontStyle = z.infer<typeof FontStyleSchema>;

/** 对齐方式 */
export const TextAlignSchema = z.enum(['left', 'center', 'right']);

export type TextAlign = z.infer<typeof TextAlignSchema>;

/** 颜色 (HEX 格式) */
export const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}){1,2}$/, '无效的颜色格式，请使用 #RGB 或 #RRGGBB');

// ============================================================================
// 基础元素 Schema
// ============================================================================

/** 元素类型 */
export const ElementTypeSchema = z.enum([
  'text',
  'placeholder',
  'table',
  'image',
  'barcode',
]);

export type ElementType = z.infer<typeof ElementTypeSchema>;

/** 基础元素属性 - 所有元素共享 */
export const BaseElementSchema = z.object({
  /** 元素唯一 ID */
  id: z.string().uuid(),

  /** 元素类型 */
  type: ElementTypeSchema,

  /** 位置 (相对于页面左上角) */
  position: PositionSchema,

  /** 尺寸 */
  size: SizeSchema,

  /** 旋转角度 (度) */
  rotation: z.number().min(0).max(360).default(0),

  /** 层级 (越大越靠前) */
  zIndex: z.number().int().default(0),

  /** 是否锁定 (锁定后不可拖拽/编辑) */
  locked: z.boolean().default(false),

  /** 是否可见 */
  visible: z.boolean().default(true),
});

export type BaseElement = z.infer<typeof BaseElementSchema>;
