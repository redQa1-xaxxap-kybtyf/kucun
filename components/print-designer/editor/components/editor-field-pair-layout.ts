/**
 * 打印设计器 - 字段项成组插入布局
 *
 * 为中文表单设计提供“标签 + 值”成对字段的自动排版位置。
 */

import type { DesignElement, PageSettings } from '@/lib/print-designer/schemas';

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  gap = 1.5
) {
  return startA < endB + gap && endA > startB - gap;
}

function boxesOverlap(
  leftA: number,
  topA: number,
  widthA: number,
  heightA: number,
  leftB: number,
  topB: number,
  widthB: number,
  heightB: number
) {
  return (
    rangesOverlap(leftA, leftA + widthA, leftB, leftB + widthB) &&
    rangesOverlap(topA, topA + heightA, topB, topB + heightB)
  );
}

export interface FieldPairPlacement {
  x: number;
  y: number;
  width: number;
  labelWidth: number;
}

export function findNextFieldPairPlacement(
  elements: DesignElement[],
  pageSettings: PageSettings
): FieldPairPlacement {
  const [paddingTop, paddingRight, paddingBottom, paddingLeft] =
    pageSettings.padding;
  const contentWidth = Math.max(
    60,
    pageSettings.width - paddingLeft - paddingRight
  );
  const contentHeight = Math.max(
    40,
    pageSettings.height - paddingTop - paddingBottom
  );
  const rowHeight = 6;
  const rowGap = 2;
  const columnGap = 6;
  const labelWidth = contentWidth >= 160 ? 20 : 18;
  const useTwoColumns = contentWidth >= 150;
  const pairWidth = useTwoColumns
    ? (contentWidth - columnGap) / 2
    : contentWidth;
  const columnPositions = useTwoColumns ? [0, pairWidth + columnGap] : [0];
  const startY = 28;
  const maxRows = Math.max(
    1,
    Math.floor((contentHeight - startY - rowHeight) / (rowHeight + rowGap)) + 1
  );

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const y = startY + rowIndex * (rowHeight + rowGap);

    for (const x of columnPositions) {
      const overlaps = elements.some(element =>
        boxesOverlap(
          x,
          y,
          pairWidth,
          rowHeight,
          element.position.x,
          element.position.y,
          element.size.width,
          element.size.height
        )
      );

      if (!overlaps) {
        return { x, y, width: pairWidth, labelWidth };
      }
    }
  }

  const fallbackY = Math.min(
    contentHeight - rowHeight,
    Math.max(
      startY,
      elements.reduce(
        (maxBottom, element) =>
          Math.max(maxBottom, element.position.y + element.size.height),
        0
      ) + rowGap
    )
  );

  return {
    x: 0,
    y: fallbackY,
    width: pairWidth,
    labelWidth,
  };
}
