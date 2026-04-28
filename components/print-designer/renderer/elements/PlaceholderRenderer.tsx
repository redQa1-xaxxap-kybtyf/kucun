/**
 * 打印设计器 - 占位符渲染器
 *
 * 渲染数据绑定元素，运行时替换为实际业务数据
 */

'use client';

import type { PlaceholderElement } from '@/lib/print-designer/schemas';

import {
  formatValue,
  getNestedValue,
  ptToPx,
  resolveFontFamilyStack,
} from '../utils';

interface PlaceholderRendererProps {
  element: PlaceholderElement;
  data: Record<string, unknown>;
  scale: number;
}

export function PlaceholderRenderer({
  element,
  data,
  scale,
}: PlaceholderRendererProps) {
  const { field, format, fallback, style } = element;

  // 从数据中获取值
  const rawValue = getNestedValue(data, field);

  // 格式化显示
  const displayValue =
    rawValue !== null && rawValue !== undefined
      ? formatValue(rawValue, format)
      : fallback;

  const textStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    fontFamily: resolveFontFamilyStack(style.fontFamily),
    fontSize: ptToPx(style.fontSize) * scale,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    color: style.color,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing * scale,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    margin: 0,
    padding: 0,
  };

  return <div style={textStyle}>{displayValue}</div>;
}
