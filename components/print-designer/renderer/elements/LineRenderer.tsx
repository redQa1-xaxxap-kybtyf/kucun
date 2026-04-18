/**
 * 打印设计器 - 横线渲染器
 */

'use client';

import type { LineElement } from '@/lib/print-designer/schemas';

interface LineRendererProps {
  element: LineElement;
}

export function LineRenderer({ element }: LineRendererProps) {
  const dashMap: Record<LineElement['style']['dashStyle'], string> = {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          borderTop: `${element.style.strokeWidth}px ${dashMap[element.style.dashStyle]} ${element.style.color}`,
        }}
      />
    </div>
  );
}
