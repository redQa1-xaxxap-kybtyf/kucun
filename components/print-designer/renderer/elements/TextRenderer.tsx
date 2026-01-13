/**
 * 打印设计器 - 文本渲染器
 *
 * 渲染静态文本元素
 */

'use client';

import type { TextElement } from '@/lib/print-designer/schemas';

import { ptToPx } from '../utils';

interface TextRendererProps {
  element: TextElement;
  scale: number;
}

export function TextRenderer({ element, scale }: TextRendererProps) {
  const { content, style } = element;

  const textStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    fontFamily: style.fontFamily,
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

  return <div style={textStyle}>{content}</div>;
}
