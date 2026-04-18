/**
 * 打印设计器 - 画布容器
 */

'use client';

import { Maximize2, Minus, Plus } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  createDefaultPlaceholderElement,
  createDefaultTableElement,
  createDefaultTextElement,
  createDefaultLineElement,
  createDefaultRectElement,
  getPaperDimensions,
  type DesignElement,
} from '@/lib/print-designer/schemas';
import {
  createDefaultBarcodeElement,
  createDefaultImageElement,
} from '@/lib/print-designer/schemas/visual-elements';
import { cn } from '@/lib/utils';

import { mmToPx } from '../../renderer/utils';
import {
  snapToGuides,
  useAlignmentGuides,
  type AlignmentGuide,
} from '../hooks';
import { useDesignerStore, useElements, usePageSettings } from '../stores';

import { ElementContextMenu } from './ElementContextMenu';
import { TableElementPreview } from './TableElementPreview';

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampElementPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
  bounds: { width: number; height: number }
) {
  return {
    x: clampValue(position.x, 0, Math.max(0, bounds.width - size.width)),
    y: clampValue(position.y, 0, Math.max(0, bounds.height - size.height)),
  };
}

// ============================================================================
// 对齐辅助线覆盖层
// ============================================================================

interface AlignmentGuidesOverlayProps {
  zoom: number;
  guides?: AlignmentGuide[];
}

function AlignmentGuidesOverlay({
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
              className="absolute top-0 h-full w-px bg-rose-500"
              style={{
                left: mmToPx(guide.position) * zoom,
              }}
            />
          );
        }
        return (
          <div
            key={`h-${index}`}
            className="absolute left-0 h-px w-full bg-rose-500"
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(
    null
  );

  const pageSettings = usePageSettings();
  const elements = useElements();
  const selectedElementId = useDesignerStore(s => s.selectedElementId);
  const zoom = useDesignerStore(s => s.zoom);
  const isDragging = useDesignerStore(s => s.isDragging);

  const setZoom = useDesignerStore(s => s.setZoom);
  const addElement = useDesignerStore(s => s.addElement);
  const selectElement = useDesignerStore(s => s.selectElement);
  const updateElement = useDesignerStore(s => s.updateElement);
  const setDragging = useDesignerStore(s => s.setDragging);

  const pageDimensions =
    pageSettings?.size === 'Custom'
      ? { width: pageSettings.width, height: pageSettings.height }
      : getPaperDimensions(
          pageSettings?.size ?? 'A4',
          pageSettings?.orientation ?? 'portrait'
        );

  const [paddingTop, paddingRight, paddingBottom, paddingLeft] =
    pageSettings?.padding ?? [10, 10, 10, 10];

  const contentBounds = useMemo(
    () => ({
      width: Math.max(10, pageDimensions.width - paddingLeft - paddingRight),
      height: Math.max(10, pageDimensions.height - paddingTop - paddingBottom),
    }),
    [
      pageDimensions.height,
      pageDimensions.width,
      paddingBottom,
      paddingLeft,
      paddingRight,
      paddingTop,
    ]
  );

  // 计算对齐辅助线
  const draggingElement = draggingElementId
    ? (elements.find(el => el.id === draggingElementId) ?? null)
    : null;
  const alignmentGuides = useAlignmentGuides(
    draggingElement,
    elements,
    contentBounds.width,
    contentBounds.height
  );

  const handleFitZoom = useCallback(() => {
    if (!viewportRef.current) return;

    const viewport = viewportRef.current.getBoundingClientRect();
    const availableWidth = Math.max(200, viewport.width - 96);
    const availableHeight = Math.max(200, viewport.height - 96);
    const fitZoom = Math.min(
      availableWidth / mmToPx(pageDimensions.width),
      availableHeight / mmToPx(pageDimensions.height)
    );
    setZoom(fitZoom);
  }, [pageDimensions.height, pageDimensions.width, setZoom]);

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
      if (!elementType || !contentRef.current || !pageSettings) return;

      // 计算放置位置 (相对于可打印区)
      const rect = contentRef.current.getBoundingClientRect();
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
          const label = e.dataTransfer.getData('fieldLabel') || '数据项';
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
        case 'line':
          newElement = createDefaultLineElement(id, { x: posX, y: posY });
          break;
        case 'rect':
          newElement = createDefaultRectElement(id, { x: posX, y: posY });
          break;
        default:
          return;
      }

      newElement.position = clampElementPosition(
        newElement.position,
        newElement.size,
        contentBounds
      );

      addElement(newElement);
    },
    [zoom, pageSettings, setDragging, addElement, contentBounds]
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
  const contentWidth = mmToPx(contentBounds.width) * zoom;
  const contentHeight = mmToPx(contentBounds.height) * zoom;
  const contentLeft = mmToPx(paddingLeft) * zoom;
  const contentTop = mmToPx(paddingTop) * zoom;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#ece4d8]">
      <div className="border-b bg-white/80 px-4 py-2 text-xs text-slate-600">
        灰色为纸张，虚线框内为可打印区域。元素会自动限制在可打印区域内，避免实际打印被裁切。
        拖动元素靠近页边、中心线或其他元素时会自动吸附，排版会顺手很多。
      </div>

      {/* 画布区域 */}
      <div
        ref={viewportRef}
        className="flex flex-1 items-center justify-center overflow-auto p-8"
        onClick={handleCanvasClick}
      >
        <div
          className={cn(
            'relative rounded-sm bg-white shadow-[0_24px_60px_rgba(73,55,28,0.18)] transition-all',
            isDragging &&
              'ring-2 ring-amber-500 ring-offset-4 ring-offset-[#ece4d8]'
          )}
          style={{
            width: pageWidth,
            height: pageHeight,
          }}
        >
          <div
            ref={contentRef}
            className="absolute overflow-hidden rounded-[2px] border border-dashed border-amber-400/90 bg-[linear-gradient(180deg,rgba(245,158,11,0.07),rgba(245,158,11,0.02))]"
            style={{
              left: contentLeft,
              top: contentTop,
              width: contentWidth,
              height: contentHeight,
            }}
            onClick={e => {
              if (e.target === e.currentTarget) {
                selectElement(null);
              }
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="pointer-events-none absolute top-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] text-amber-700 shadow-sm">
              可打印区域
            </div>

            {elements.length === 0 ? (
              <div className="pointer-events-none flex h-full items-center justify-center px-6">
                <div className="max-w-sm rounded-2xl border border-stone-200 bg-white/92 px-5 py-4 text-center shadow-sm">
                  <p className="text-sm font-medium text-slate-900">
                    从左侧拖入组件或数据项开始设计
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    常见做法是先放标题、公司信息，再放客户信息和明细表格。
                  </p>
                </div>
              </div>
            ) : null}

            {/* 对齐辅助线 */}
            <AlignmentGuidesOverlay zoom={zoom} guides={alignmentGuides} />

            {/* 渲染元素 */}
            {elements.map(element => (
              <CanvasElement
                key={element.id}
                element={element}
                zoom={zoom}
                isSelected={element.id === selectedElementId}
                bounds={contentBounds}
                alignmentGuides={
                  element.id === draggingElementId ? alignmentGuides : []
                }
                onSelect={() => selectElement(element.id)}
                onUpdate={updates => updateElement(element.id, updates)}
                onDragStart={() => setDraggingElementId(element.id)}
                onDragEnd={() => setDraggingElementId(null)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 缩放控制 */}
      <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-1 shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={handleFitZoom}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          适应
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={() => setZoom(1)}
        >
          100%
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom(zoom - 0.1)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-sm font-medium">
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
  bounds: { width: number; height: number };
  alignmentGuides?: AlignmentGuide[];
  onSelect: () => void;
  onUpdate: (updates: Partial<DesignElement>) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function CanvasElement({
  element,
  zoom,
  isSelected,
  bounds,
  alignmentGuides = [],
  onSelect,
  onUpdate,
  onDragStart,
  onDragEnd,
}: CanvasElementProps) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    elemX: number;
    elemY: number;
  } | null>(null);
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

      const nextPosition = {
        x: dragRef.current.elemX + deltaX / (96 / 25.4),
        y: dragRef.current.elemY + deltaY / (96 / 25.4),
      };
      const snappedPosition =
        alignmentGuides.length > 0
          ? snapToGuides(nextPosition, element.size, alignmentGuides)
          : nextPosition;

      onUpdate({
        position: clampElementPosition(snappedPosition, element.size, bounds),
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

      if (nextX + nextW > bounds.width) {
        if (state.handle === 'sw' || state.handle === 'nw') {
          nextX = Math.max(0, bounds.width - nextW);
        } else {
          nextW = Math.max(minSizeMm, bounds.width - nextX);
        }
      }

      if (nextY + nextH > bounds.height) {
        if (state.handle === 'ne' || state.handle === 'nw') {
          nextY = Math.max(0, bounds.height - nextH);
        } else {
          nextH = Math.max(minSizeMm, bounds.height - nextY);
        }
      }

      onUpdate({
        position: {
          x: clampValue(nextX, 0, Math.max(0, bounds.width - nextW)),
          y: clampValue(nextY, 0, Math.max(0, bounds.height - nextH)),
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
            onColumnsChange={columns => onUpdate({ columns })}
          />
        );
      case 'image':
        return (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center bg-slate-100 text-xs">
            图片
          </div>
        );
      case 'barcode':
        return (
          <div className="flex h-full w-full items-center justify-center bg-slate-50 font-mono text-xs">
            ||||||||
          </div>
        );
      case 'line':
        return (
          <div className="flex h-full w-full items-center">
            <div className="w-full border-t border-dashed border-slate-500" />
          </div>
        );
      case 'rect':
        return (
          <div className="h-full w-full rounded-[2px] border border-dashed border-slate-500 bg-white/40" />
        );
      default:
        return null;
    }
  };

  return (
    <ElementContextMenu elementId={element.id}>
      <div
        className={cn(
          'absolute cursor-move rounded-[2px] select-none',
          isSelected && 'ring-2 ring-amber-500 ring-offset-1 ring-offset-white',
          element.locked && 'cursor-not-allowed',
          !element.visible && 'opacity-40'
        )}
        style={{
          left: x,
          top: y,
          width,
          height,
          zIndex: element.zIndex,
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={() => onSelect()}
      >
        {renderContent()}

        {!element.visible ? (
          <div className="pointer-events-none absolute top-1 right-1 rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] text-white">
            已隐藏
          </div>
        ) : null}

        {isSelected && !element.locked && (
          <>
            <div
              className="absolute -top-1 -left-1 h-2.5 w-2.5 cursor-nwse-resize rounded-full bg-amber-500"
              onMouseDown={e => handleResizeMouseDown('nw', e)}
            />
            <div
              className="absolute -top-1 -right-1 h-2.5 w-2.5 cursor-nesw-resize rounded-full bg-amber-500"
              onMouseDown={e => handleResizeMouseDown('ne', e)}
            />
            <div
              className="absolute -bottom-1 -left-1 h-2.5 w-2.5 cursor-nesw-resize rounded-full bg-amber-500"
              onMouseDown={e => handleResizeMouseDown('sw', e)}
            />
            <div
              className="absolute -right-1 -bottom-1 h-2.5 w-2.5 cursor-nwse-resize rounded-full bg-amber-500"
              onMouseDown={e => handleResizeMouseDown('se', e)}
            />
          </>
        )}
      </div>
    </ElementContextMenu>
  );
}
