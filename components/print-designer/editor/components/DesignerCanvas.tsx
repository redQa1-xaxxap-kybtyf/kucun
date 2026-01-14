/**
 * 打印设计器 - 画布容器
 */

'use client';

import { Minus, Plus } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  createDefaultPlaceholderElement,
  createDefaultTableElement,
  createDefaultTextElement,
  getPaperDimensions,
  type DesignElement,
} from '@/lib/print-designer/schemas';
import {
    createDefaultBarcodeElement,
    createDefaultImageElement,
} from '@/lib/print-designer/schemas/visual-elements';
import { cn } from '@/lib/utils';

import { mmToPx } from '../../renderer/utils';
import { useAlignmentGuides, type AlignmentGuide } from '../hooks';
import { useDesignerStore, useElements, usePageSettings } from '../stores';

import { TableElementPreview } from './TableElementPreview';

// ============================================================================
// 对齐辅助线覆盖层
// ============================================================================

interface AlignmentGuidesOverlayProps {
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  guides?: AlignmentGuide[];
}

function AlignmentGuidesOverlay({
  pageWidth: _pageWidth,
  pageHeight: _pageHeight,
  zoom,
  guides = [],
}: AlignmentGuidesOverlayProps) {
  if (guides.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {guides.map((guide, index) => {
        if (guide.type === 'vertical') {
          return (
            <div
              key={`v-${index}`}
              className="absolute top-0 h-full w-px bg-pink-500"
              style={{
                left: mmToPx(guide.position) * zoom,
              }}
            />
          );
        }
        return (
          <div
            key={`h-${index}`}
            className="absolute left-0 h-px w-full bg-pink-500"
            style={{
              top: mmToPx(guide.position) * zoom,
            }}
          />
        );
      })}
    </div>
  );
}


export function DesignerCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);

  const pageSettings = usePageSettings();
  const elements = useElements();
  const selectedElementId = useDesignerStore((s) => s.selectedElementId);
  const zoom = useDesignerStore((s) => s.zoom);
  const isDragging = useDesignerStore((s) => s.isDragging);

  const setZoom = useDesignerStore((s) => s.setZoom);
  const addElement = useDesignerStore((s) => s.addElement);
  const selectElement = useDesignerStore((s) => s.selectElement);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const setDragging = useDesignerStore((s) => s.setDragging);

  // 计算对齐辅助线
  const draggingElement = draggingElementId
    ? elements.find((el) => el.id === draggingElementId) ?? null
    : null;
  const pageDimensions =
    pageSettings?.size === 'Custom'
      ? { width: pageSettings.width, height: pageSettings.height }
      : getPaperDimensions(pageSettings?.size ?? 'A4', pageSettings?.orientation ?? 'portrait');
  const alignmentGuides = useAlignmentGuides(
    draggingElement,
    elements,
    pageDimensions.width,
    pageDimensions.height
  );

  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);

      const elementType = e.dataTransfer.getData('elementType');
      if (!elementType || !containerRef.current || !pageSettings) return;

      // 计算放置位置 (相对于画布)
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      // 转换为 mm
      const posX = x / (96 / 25.4);
      const posY = y / (96 / 25.4);

      const id = crypto.randomUUID();
      let newElement: DesignElement;

      switch (elementType) {
        case 'text':
          newElement = createDefaultTextElement(id, { x: posX, y: posY });
          break;
        case 'placeholder': {
          const field = e.dataTransfer.getData('fieldPath') || 'field';
          const label = e.dataTransfer.getData('fieldLabel') || '字段';
          newElement = createDefaultPlaceholderElement(id, field, label, {
            x: posX,
            y: posY,
          });
          break;
        }
        case 'table':
          newElement = createDefaultTableElement(id, { x: posX, y: posY });
          break;
        case 'image':
          newElement = createDefaultImageElement(id, { x: posX, y: posY });
          break;
        case 'barcode':
          newElement = createDefaultBarcodeElement(id, 'order.orderNumber', {
            x: posX,
            y: posY,
          });
          break;
        default:
          return;
      }

      addElement(newElement);
    },
    [zoom, pageSettings, setDragging, addElement]
  );

  // 点击画布取消选中
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        selectElement(null);
      }
    },
    [selectElement]
  );

  if (!pageSettings) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-100">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const pageWidth = mmToPx(pageDimensions.width) * zoom;
  const pageHeight = mmToPx(pageDimensions.height) * zoom;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-100">
      {/* 画布区域 */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-8"
        onClick={handleCanvasClick}
      >
        <div
          ref={containerRef}
          className={cn(
            'relative bg-white shadow-lg',
            isDragging && 'ring-2 ring-primary ring-offset-2'
          )}
          style={{
            width: pageWidth,
            height: pageHeight,
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* 对齐辅助线 */}
          <AlignmentGuidesOverlay
            pageWidth={pageDimensions.width}
            pageHeight={pageDimensions.height}
            zoom={zoom}
            guides={alignmentGuides}
          />

          {/* 渲染元素 */}
          {elements.map((element) => (
            <CanvasElement
              key={element.id}
              element={element}
              zoom={zoom}
              isSelected={element.id === selectedElementId}
              onSelect={() => selectElement(element.id)}
              onUpdate={(updates) => updateElement(element.id, updates)}
              onDragStart={() => setDraggingElementId(element.id)}
              onDragEnd={() => setDraggingElementId(null)}
            />
          ))}
        </div>
      </div>

      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom(zoom - 0.1)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-sm">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom(zoom + 0.1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 画布元素组件
// ============================================================================

interface CanvasElementProps {
  element: DesignElement;
  zoom: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<DesignElement>) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function CanvasElement({
  element,
  zoom,
  isSelected,
  onSelect,
  onUpdate,
  onDragStart,
  onDragEnd,
}: CanvasElementProps) {
  const dragRef = useRef<{ startX: number; startY: number; elemX: number; elemY: number } | null>(null);
  const resizeRef = useRef<{
    handle: 'nw' | 'ne' | 'sw' | 'se';
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const x = mmToPx(element.position.x) * zoom;
  const y = mmToPx(element.position.y) * zoom;
  const width = mmToPx(element.size.width) * zoom;
  const height = mmToPx(element.size.height) * zoom;

  // 开始拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    if (element.locked) return;
    onDragStart?.();

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      elemX: element.position.x,
      elemY: element.position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;

      const deltaX = (moveEvent.clientX - dragRef.current.startX) / zoom;
      const deltaY = (moveEvent.clientY - dragRef.current.startY) / zoom;

      // 转换为 mm
      const newX = dragRef.current.elemX + deltaX / (96 / 25.4);
      const newY = dragRef.current.elemY + deltaY / (96 / 25.4);

      onUpdate({
        position: {
          x: Math.max(0, newX),
          y: Math.max(0, newY),
        },
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      onDragEnd?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (
    handle: 'nw' | 'ne' | 'sw' | 'se',
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    if (element.locked) return;

    resizeRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: element.position.x,
      startY: element.position.y,
      startW: element.size.width,
      startH: element.size.height,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = resizeRef.current;
      if (!state) return;

      const deltaXPx = (moveEvent.clientX - state.startClientX) / zoom;
      const deltaYPx = (moveEvent.clientY - state.startClientY) / zoom;

      const deltaXMm = deltaXPx / (96 / 25.4);
      const deltaYMm = deltaYPx / (96 / 25.4);

      const minSizeMm = 5;
      let nextX = state.startX;
      let nextY = state.startY;
      let nextW = state.startW;
      let nextH = state.startH;

      switch (state.handle) {
        case 'se':
          nextW = state.startW + deltaXMm;
          nextH = state.startH + deltaYMm;
          break;
        case 'sw':
          nextX = state.startX + deltaXMm;
          nextW = state.startW - deltaXMm;
          nextH = state.startH + deltaYMm;
          break;
        case 'ne':
          nextY = state.startY + deltaYMm;
          nextW = state.startW + deltaXMm;
          nextH = state.startH - deltaYMm;
          break;
        case 'nw':
          nextX = state.startX + deltaXMm;
          nextY = state.startY + deltaYMm;
          nextW = state.startW - deltaXMm;
          nextH = state.startH - deltaYMm;
          break;
      }

      // 左/上方向：限制不越出页面 (x/y >= 0) 并同步扩展尺寸
      const rightEdge = state.startX + state.startW;
      const bottomEdge = state.startY + state.startH;
      if ((state.handle === 'sw' || state.handle === 'nw') && nextX < 0) {
        nextX = 0;
        nextW = rightEdge - nextX;
      }
      if ((state.handle === 'ne' || state.handle === 'nw') && nextY < 0) {
        nextY = 0;
        nextH = bottomEdge - nextY;
      }

      // 最小尺寸限制 (并在需要时回推 x/y)
      if (nextW < minSizeMm) {
        if (state.handle === 'sw' || state.handle === 'nw') {
          nextX = state.startX + (state.startW - minSizeMm);
        }
        nextW = minSizeMm;
      }
      if (nextH < minSizeMm) {
        if (state.handle === 'ne' || state.handle === 'nw') {
          nextY = state.startY + (state.startH - minSizeMm);
        }
        nextH = minSizeMm;
      }

      onUpdate({
        position: {
          x: Math.max(0, nextX),
          y: Math.max(0, nextY),
        },
        size: {
          width: nextW,
          height: nextH,
        },
      });
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 渲染元素内容 (简化版，用于编辑器预览)
  const renderContent = () => {
    switch (element.type) {
      case 'text':
        return (
          <div className="h-full w-full overflow-hidden text-sm">
            {element.content || '文本'}
          </div>
        );
      case 'placeholder':
        return (
          <div className="flex h-full w-full items-center rounded bg-blue-50 px-2 text-xs text-blue-700">
            {`{{${element.label}}}`}
          </div>
        );
      case 'table':
        return (
          <TableElementPreview
            element={element}
            zoom={zoom}
            isSelected={isSelected}
            onColumnsChange={(columns) => onUpdate({ columns })}
          />
        );
      case 'image':
        return (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-muted-foreground">
            图片
          </div>
        );
      case 'barcode':
        return (
          <div className="flex h-full w-full items-center justify-center bg-slate-50 font-mono text-xs">
            ||||||||
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'absolute cursor-move select-none',
        isSelected && 'ring-2 ring-primary'
      )}
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex: element.zIndex,
      }}
      onMouseDown={handleMouseDown}
    >
      {renderContent()}

      {/* 选中时显示控制点 */}
      {isSelected && !element.locked && (
        <>
          <div
            className="absolute -left-1 -top-1 h-2 w-2 cursor-nwse-resize rounded-full bg-primary"
            onMouseDown={(e) => handleResizeMouseDown('nw', e)}
          />
          <div
            className="absolute -right-1 -top-1 h-2 w-2 cursor-nesw-resize rounded-full bg-primary"
            onMouseDown={(e) => handleResizeMouseDown('ne', e)}
          />
          <div
            className="absolute -bottom-1 -left-1 h-2 w-2 cursor-nesw-resize rounded-full bg-primary"
            onMouseDown={(e) => handleResizeMouseDown('sw', e)}
          />
          <div
            className="absolute -bottom-1 -right-1 h-2 w-2 cursor-nwse-resize rounded-full bg-primary"
            onMouseDown={(e) => handleResizeMouseDown('se', e)}
          />
        </>
      )}
    </div>
  );
}
