/**
 * 打印设计器 - 智能对齐辅助线 Hook
 *
 * 在拖拽元素时计算并显示对齐辅助线
 */

'use client';

import { useMemo } from 'react';

import type { DesignElement } from '@/lib/print-designer/schemas';

export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number; // mm
  snapPosition?: number; // 吸附后的位置
}

interface UseAlignmentGuidesOptions {
  /** 阈值 (mm) */
  threshold?: number;
}

/**
 * 计算对齐辅助线
 */
export function useAlignmentGuides(
  draggingElement: DesignElement | null,
  allElements: DesignElement[],
  pageWidth: number,
  pageHeight: number,
  options: UseAlignmentGuidesOptions = {}
): AlignmentGuide[] {
  const { threshold = 2 } = options;

  return useMemo(() => {
    if (!draggingElement) return [];

    const guides: AlignmentGuide[] = [];

    // 拖拽元素的边界
    const dragLeft = draggingElement.position.x;
    const dragRight = dragLeft + draggingElement.size.width;
    const dragCenterX = dragLeft + draggingElement.size.width / 2;
    const dragTop = draggingElement.position.y;
    const dragBottom = dragTop + draggingElement.size.height;
    const dragCenterY = dragTop + draggingElement.size.height / 2;

    // 检查页面中心对齐
    const pageCenterX = pageWidth / 2;
    const pageCenterY = pageHeight / 2;

    if (Math.abs(dragCenterX - pageCenterX) < threshold) {
      guides.push({ type: 'vertical', position: pageCenterX });
    }
    if (Math.abs(dragCenterY - pageCenterY) < threshold) {
      guides.push({ type: 'horizontal', position: pageCenterY });
    }

    // 检查与其他元素的对齐
    allElements.forEach(el => {
      if (el.id === draggingElement.id) return;

      const elLeft = el.position.x;
      const elRight = elLeft + el.size.width;
      const elCenterX = elLeft + el.size.width / 2;
      const elTop = el.position.y;
      const elBottom = elTop + el.size.height;
      const elCenterY = elTop + el.size.height / 2;

      // X 轴对齐
      // 左 - 左
      if (Math.abs(elLeft - dragLeft) < threshold) {
        guides.push({ type: 'vertical', position: elLeft });
      }
      // 右 - 右
      if (Math.abs(elRight - dragRight) < threshold) {
        guides.push({ type: 'vertical', position: elRight });
      }
      // 中心 - 中心
      if (Math.abs(elCenterX - dragCenterX) < threshold) {
        guides.push({ type: 'vertical', position: elCenterX });
      }
      // 左 - 右
      if (Math.abs(elLeft - dragRight) < threshold) {
        guides.push({ type: 'vertical', position: elLeft });
      }
      // 右 - 左
      if (Math.abs(elRight - dragLeft) < threshold) {
        guides.push({ type: 'vertical', position: elRight });
      }

      // Y 轴对齐
      // 上 - 上
      if (Math.abs(elTop - dragTop) < threshold) {
        guides.push({ type: 'horizontal', position: elTop });
      }
      // 下 - 下
      if (Math.abs(elBottom - dragBottom) < threshold) {
        guides.push({ type: 'horizontal', position: elBottom });
      }
      // 中心 - 中心
      if (Math.abs(elCenterY - dragCenterY) < threshold) {
        guides.push({ type: 'horizontal', position: elCenterY });
      }
      // 上 - 下
      if (Math.abs(elTop - dragBottom) < threshold) {
        guides.push({ type: 'horizontal', position: elTop });
      }
      // 下 - 上
      if (Math.abs(elBottom - dragTop) < threshold) {
        guides.push({ type: 'horizontal', position: elBottom });
      }
    });

    // 去重
    const uniqueGuides: AlignmentGuide[] = [];
    guides.forEach(g => {
      if (
        !uniqueGuides.some(
          ug => ug.type === g.type && Math.abs(ug.position - g.position) < 0.1
        )
      ) {
        uniqueGuides.push(g);
      }
    });

    return uniqueGuides;
  }, [draggingElement, allElements, pageWidth, pageHeight, threshold]);
}

/**
 * 计算吸附后的位置
 */
export function snapToGuides(
  position: { x: number; y: number },
  size: { width: number; height: number },
  guides: AlignmentGuide[],
  threshold = 2
): { x: number; y: number } {
  let { x, y } = position;

  guides.forEach(guide => {
    if (guide.type === 'vertical') {
      // 左边吸附
      if (Math.abs(x - guide.position) < threshold) {
        x = guide.position;
      }
      // 右边吸附
      if (Math.abs(x + size.width - guide.position) < threshold) {
        x = guide.position - size.width;
      }
      // 中心吸附
      if (Math.abs(x + size.width / 2 - guide.position) < threshold) {
        x = guide.position - size.width / 2;
      }
    } else {
      // 上边吸附
      if (Math.abs(y - guide.position) < threshold) {
        y = guide.position;
      }
      // 下边吸附
      if (Math.abs(y + size.height - guide.position) < threshold) {
        y = guide.position - size.height;
      }
      // 中心吸附
      if (Math.abs(y + size.height / 2 - guide.position) < threshold) {
        y = guide.position - size.height / 2;
      }
    }
  });

  return { x, y };
}
