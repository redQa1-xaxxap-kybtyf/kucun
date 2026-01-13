/**
 * 打印设计器 - 占位符元素 Schema
 *
 * 用于数据绑定，运行时替换为实际业务数据
 */

import { z } from 'zod';

import { BaseElementSchema } from './base';
import { TextStyleSchema } from './text-element';

// ============================================================================
// 格式化类型
// ============================================================================

export const PlaceholderFormatSchema = z.enum([
  /** 原样输出 */
  'text',
  /** 中文日期 (YYYY年MM月DD日) */
  'date_cn',
  /** 货币格式 (¥1,234.56) */
  'currency',
  /** 大写金额 (壹仟贰佰叁拾肆元伍角陆分) */
  'currency_cap',
  /** 数字格式 (保留小数) */
  'number',
]);

export type PlaceholderFormat = z.infer<typeof PlaceholderFormatSchema>;

// ============================================================================
// 占位符元素
// ============================================================================

export const PlaceholderElementSchema = BaseElementSchema.extend({
  /** 元素类型 */
  type: z.literal('placeholder'),

  /** 数据路径 (如 'order.customer.name') */
  field: z.string().min(1),

  /** 显示标签 (编辑时显示) */
  label: z.string().min(1),

  /** 格式化类型 */
  format: PlaceholderFormatSchema.default('text'),

  /** 空值时的默认显示 */
  fallback: z.string().default('-'),

  /** 文本样式 */
  style: TextStyleSchema,
});

export type PlaceholderElement = z.infer<typeof PlaceholderElementSchema>;

// ============================================================================
// 工具函数
// ============================================================================

/** 创建默认占位符元素 */
export function createDefaultPlaceholderElement(
  id: string,
  field: string,
  label: string,
  position = { x: 10, y: 10 }
): PlaceholderElement {
  return {
    id,
    type: 'placeholder',
    position,
    size: { width: 50, height: 8 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    field,
    label,
    format: 'text',
    fallback: '-',
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
