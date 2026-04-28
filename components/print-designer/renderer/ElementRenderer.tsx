/**
 * 打印设计器 - 元素分发渲染器
 *
 * 根据元素类型分发到对应的渲染器
 */

'use client';

import type { DesignElement } from '@/lib/print-designer/schemas';

import {
  BarcodeRenderer,
  ImageRenderer,
  LineRenderer,
  PlaceholderRenderer,
  RectRenderer,
  TableRenderer,
  TextRenderer,
} from './elements';
import type { TableRenderOverride } from './paginated-layout';
import { mmToPx } from './utils';

interface ElementRendererProps {
  element: DesignElement;
  data: Record<string, unknown>;
  scale: number;
  tableRenderOverride?: TableRenderOverride;
}

export function ElementRenderer({
  element,
  data,
  scale,
  tableRenderOverride,
}: ElementRendererProps) {
  // 计算元素包装器样式
  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: mmToPx(element.position.x) * scale,
    top: mmToPx(element.position.y) * scale,
    width: mmToPx(element.size.width) * scale,
    height: mmToPx(element.size.height) * scale,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: 'center center',
    overflow: 'hidden',
  };

  // 根据元素类型渲染对应组件
  const renderElement = (): React.ReactNode => {
    switch (element.type) {
      case 'text':
        return <TextRenderer element={element} scale={scale} />;

      case 'placeholder':
        return (
          <PlaceholderRenderer element={element} data={data} scale={scale} />
        );

      case 'table':
        return (
          <TableRenderer
            element={element}
            data={data}
            scale={scale}
            rowNumberOffset={tableRenderOverride?.rowNumberOffset}
            summaryItems={tableRenderOverride?.summaryItems}
          />
        );

      case 'image':
        return <ImageRenderer element={element} data={data} scale={scale} />;

      case 'barcode':
        return <BarcodeRenderer element={element} data={data} scale={scale} />;

      case 'line':
        return <LineRenderer element={element} />;

      case 'rect':
        return <RectRenderer element={element} />;

      default:
        // TypeScript 穷尽检查
        const _exhaustive: never = element;
        return null;
    }
  };

  return <div style={wrapperStyle}>{renderElement()}</div>;
}
