/**
 * 打印设计器 - 边框框渲染器
 */

'use client';

import type { RectElement } from '@/lib/print-designer/schemas';

function hexToRgba(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const safeHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map(char => `${char}${char}`)
          .join('')
      : normalized;

  const red = Number.parseInt(safeHex.slice(0, 2), 16);
  const green = Number.parseInt(safeHex.slice(2, 4), 16);
  const blue = Number.parseInt(safeHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

interface RectRendererProps {
  element: RectElement;
}

export function RectRenderer({ element }: RectRendererProps) {
  const dashMap: Record<RectElement['style']['dashStyle'], string> = {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
  };
  const backgroundColor =
    element.style.fillOpacity > 0
      ? hexToRgba(element.style.fillColor, element.style.fillOpacity)
      : 'transparent';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        border: `${element.style.borderWidth}px ${dashMap[element.style.dashStyle]} ${element.style.borderColor}`,
        borderRadius: `${element.style.radius}px`,
        backgroundColor,
      }}
    />
  );
}
