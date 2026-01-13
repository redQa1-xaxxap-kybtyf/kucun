/**
 * 打印设计器 - 文本元素 Schema
 *
 * 用于静态文本内容的渲染
 */

import { z } from 'zod';

import {
    BaseElementSchema,
    FontFamilySchema,
    FontStyleSchema,
    FontWeightSchema,
    HexColorSchema,
    TextAlignSchema,
} from './base';

// ============================================================================
// 文本样式
// ============================================================================

export const TextStyleSchema = z.object({
  /** 字体 */
  fontFamily: FontFamilySchema.default('SimSun'),

  /** 字号 (pt) */
  fontSize: z.number().min(6).max(200).default(12),

  /** 字重 */
  fontWeight: FontWeightSchema.default('normal'),

  /** 字体风格 */
  fontStyle: FontStyleSchema.default('normal'),

  /** 文字颜色 */
  color: HexColorSchema.default('#000000'),

  /** 对齐方式 */
  textAlign: TextAlignSchema.default('left'),

  /** 行高 (倍数) */
  lineHeight: z.number().min(1).max(3).default(1.2),

  /** 字间距 (pt) */
  letterSpacing: z.number().min(-2).max(10).default(0),
});

export type TextStyle = z.infer<typeof TextStyleSchema>;

// ============================================================================
// 文本元素
// ============================================================================

export const TextElementSchema = BaseElementSchema.extend({
  /** 元素类型 */
  type: z.literal('text'),

  /** 文本内容 */
  content: z.string().max(5000).default(''),

  /** 文本样式 */
  style: TextStyleSchema,
});

export type TextElement = z.infer<typeof TextElementSchema>;

// ============================================================================
// 工具函数
// ============================================================================

/** 创建默认文本元素 */
export function createDefaultTextElement(
  id: string,
  position = { x: 10, y: 10 }
): TextElement {
  return {
    id,
    type: 'text',
    position,
    size: { width: 50, height: 10 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    content: '文本',
    style: {
      fontFamily: 'SimSun',
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      textAlign: 'left',
      lineHeight: 1.2,
      letterSpacing: 0,
    },
  };
}
