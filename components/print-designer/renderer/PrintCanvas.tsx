/**
 * 打印设计器 - 打印画布
 *
 * 纯净渲染组件，根据模板 JSON 和业务数据渲染打印内容
 * 编辑器预览和实际打印都使用此组件
 */

'use client';

import { useMemo } from 'react';

import {
  getPaperDimensions,
  type PrintTemplate,
} from '@/lib/print-designer/schemas';

import { ElementRenderer } from './ElementRenderer';
import { buildPrintLayout } from './paginated-layout';
import { mmToPx } from './utils';

interface PrintCanvasProps {
  /** 模板配置 */
  template: PrintTemplate;

  /** 业务数据 */
  data: Record<string, unknown>;

  /** 缩放比例 (预览时可设置 < 1) */
  scale?: number;

  /** 是否显示页面阴影 (预览模式) */
  showShadow?: boolean;

  /** 自定义类名 */
  className?: string;
}

export function PrintCanvas({
  template,
  data,
  scale = 1,
  showShadow = false,
  className,
}: PrintCanvasProps) {
  const { pageSettings } = template;

  const pageDimensions =
    pageSettings.size === 'Custom'
      ? { width: pageSettings.width, height: pageSettings.height }
      : getPaperDimensions(pageSettings.size, pageSettings.orientation);

  const layout = useMemo(
    () => buildPrintLayout(template, data),
    [data, template]
  );

  // 计算页面尺寸
  const pageStyle = useMemo<React.CSSProperties>(() => {
    const [paddingTop, paddingRight, paddingBottom, paddingLeft] =
      pageSettings.padding;

    return {
      width: mmToPx(pageDimensions.width) * scale,
      height: mmToPx(pageDimensions.height) * scale,
      paddingTop: mmToPx(paddingTop) * scale,
      paddingRight: mmToPx(paddingRight) * scale,
      paddingBottom: mmToPx(paddingBottom) * scale,
      paddingLeft: mmToPx(paddingLeft) * scale,
      backgroundColor: '#ffffff',
      position: 'relative',
      boxSizing: 'border-box',
      overflow: 'hidden',
      // 预览模式阴影
      boxShadow: showShadow ? '0 4px 24px rgba(0,0,0,0.08)' : undefined,
    };
  }, [
    pageDimensions.height,
    pageDimensions.width,
    pageSettings.padding,
    scale,
    showShadow,
  ]);
  const pageGap = showShadow ? 24 * scale : 0;
  const pageLabelStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      right: mmToPx(8) * scale,
      bottom: mmToPx(5) * scale,
      fontSize: 11 * scale,
      lineHeight: 1.2,
      color: '#64748b',
      letterSpacing: '0.02em',
    }),
    [scale]
  );

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: pageGap,
      }}
    >
      {layout.pages.map((page, pageIndex) => {
        const sortedElements = [...page.elements].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const isLastPage = pageIndex === layout.pages.length - 1;

        return (
          <div
            key={`print-page-${pageIndex}`}
            style={{
              ...pageStyle,
              pageBreakAfter: isLastPage ? undefined : 'always',
              breakAfter: isLastPage ? undefined : 'page',
            }}
          >
            {sortedElements.map(element => (
              <ElementRenderer
                key={`${pageIndex}-${element.id}`}
                element={element}
                data={page.data}
                scale={scale}
                tableRenderOverride={page.tableOverrides[element.id]}
              />
            ))}

            {layout.pages.length > 1 && page.pageLabel ? (
              <div style={pageLabelStyle}>{page.pageLabel}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
