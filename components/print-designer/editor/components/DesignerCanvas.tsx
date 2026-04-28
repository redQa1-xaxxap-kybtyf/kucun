/**
 * 打印设计器 - 画布容器
 */

'use client';

import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { PrintCompanyProfile } from '@/lib/print-designer/company-profile';
import type { ElementArrangementMode } from '@/lib/print-designer/element-arrangement';
import { cloneMockPrintData } from '@/lib/print-designer/preview-mock-data';
import {
  createDefaultPlaceholderElement,
  createDefaultTableElement,
  createDefaultTextElement,
  createDefaultLineElement,
  createDefaultRectElement,
  getPaperDimensions,
  type DesignElement,
  type TemplateType,
} from '@/lib/print-designer/schemas';
import {
  createDefaultBarcodeElement,
  createDefaultImageElement,
} from '@/lib/print-designer/schemas/visual-elements';
import { cn } from '@/lib/utils';

import { PlaceholderRenderer, TextRenderer } from '../../renderer/elements';
import { getNestedValue, mmToPx } from '../../renderer/utils';
import {
  snapToGuides,
  useAlignmentGuides,
  type AlignmentGuide,
} from '../hooks';
import { useDesignerStore, useElements, usePageSettings } from '../stores';

import { ElementContextMenu } from './ElementContextMenu';
import { Ruler } from './Ruler';
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

function formatMillimeters(value: number) {
  return `${value.toFixed(1)}mm`;
}

function getElementDisplayName(element: DesignElement) {
  switch (element.type) {
    case 'text':
      return '文本';
    case 'placeholder':
      return `字段·${element.label}`;
    case 'table':
      return '表格';
    case 'image':
      return '图片';
    case 'barcode':
      return '条码';
    case 'line':
      return '线条';
    case 'rect':
      return '矩形';
    default:
      return '元素';
  }
}

function setNestedPreviewValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown
) {
  const keys = path
    .split('.')
    .map(key => key.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    return target;
  }

  let current = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
      return;
    }

    const nextValue = current[key];
    if (
      !nextValue ||
      typeof nextValue !== 'object' ||
      Array.isArray(nextValue)
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  });

  return target;
}

// ============================================================================
// 对齐辅助线覆盖层
// ============================================================================

interface AlignmentGuidesOverlayProps {
  zoom: number;
  guides?: AlignmentGuide[];
}

interface SelectionBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const MULTI_SELECT_ACTIONS: Array<{
  label: string;
  mode: ElementArrangementMode;
}> = [
  { label: '左对齐', mode: 'align-left' },
  { label: '水平居中', mode: 'align-center' },
  { label: '右对齐', mode: 'align-right' },
  { label: '上对齐', mode: 'align-top' },
  { label: '垂直居中', mode: 'align-middle' },
  { label: '下对齐', mode: 'align-bottom' },
  { label: '横向分布', mode: 'distribute-horizontal' },
  { label: '纵向分布', mode: 'distribute-vertical' },
  { label: '等宽', mode: 'match-width' },
  { label: '等高', mode: 'match-height' },
];

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

function normalizeSelectionBox(selectionBox: SelectionBoxState) {
  const left = Math.min(selectionBox.startX, selectionBox.currentX);
  const top = Math.min(selectionBox.startY, selectionBox.currentY);
  const width = Math.abs(selectionBox.currentX - selectionBox.startX);
  const height = Math.abs(selectionBox.currentY - selectionBox.startY);

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function getSelectionBoxStyle(selectionBox: SelectionBoxState) {
  const normalizedSelectionBox = normalizeSelectionBox(selectionBox);

  return {
    left: normalizedSelectionBox.left,
    top: normalizedSelectionBox.top,
    width: normalizedSelectionBox.width,
    height: normalizedSelectionBox.height,
  };
}

function selectionBoxIntersectsElement(
  selectionBox: SelectionBoxState,
  element: DesignElement,
  zoom: number
) {
  const box = normalizeSelectionBox(selectionBox);
  const left = mmToPx(element.position.x) * zoom;
  const top = mmToPx(element.position.y) * zoom;
  const right = left + mmToPx(element.size.width) * zoom;
  const bottom = top + mmToPx(element.size.height) * zoom;

  return !(
    right < box.left ||
    left > box.right ||
    bottom < box.top ||
    top > box.bottom
  );
}

interface DesignerCanvasProps {
  companyProfile?: PrintCompanyProfile | null;
}

export function DesignerCanvas({ companyProfile }: DesignerCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ignoreNextCanvasClickRef = useRef(false);
  const isSelectionDraggingRef = useRef(false);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(
    null
  );
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(
    null
  );

  const pageSettings = usePageSettings();
  const elements = useElements();
  const templateType = useDesignerStore(s => s.template?.type ?? 'sales-order');
  const selectedElementId = useDesignerStore(s => s.selectedElementId);
  const selectedElementIds = useDesignerStore(s => s.selectedElementIds);
  const zoom = useDesignerStore(s => s.zoom);
  const isDragging = useDesignerStore(s => s.isDragging);

  const setZoom = useDesignerStore(s => s.setZoom);
  const addElement = useDesignerStore(s => s.addElement);
  const selectElement = useDesignerStore(s => s.selectElement);
  const selectElements = useDesignerStore(s => s.selectElements);
  const arrangeSelectedElements = useDesignerStore(
    s => s.arrangeSelectedElements
  );
  const duplicateSelectedElements = useDesignerStore(
    s => s.duplicateSelectedElements
  );
  const moveElements = useDesignerStore(s => s.moveElements);
  const removeSelectedElements = useDesignerStore(
    s => s.removeSelectedElements
  );
  const updateElement = useDesignerStore(s => s.updateElement);
  const updateElements = useDesignerStore(s => s.updateElements);
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
  const selectedElement = useMemo(
    () =>
      selectedElementId
        ? (elements.find(element => element.id === selectedElementId) ?? null)
        : null,
    [elements, selectedElementId]
  );
  const selectedElements = useMemo(() => {
    if (selectedElementIds.length === 0) {
      return [];
    }

    const selectedIdSet = new Set(selectedElementIds);
    return elements.filter(element => selectedIdSet.has(element.id));
  }, [elements, selectedElementIds]);
  const lockedSelectedCount = selectedElements.filter(
    element => element.locked
  ).length;
  const allSelectedLocked =
    selectedElements.length > 0 &&
    selectedElements.every(element => element.locked);
  const hasHiddenSelected = selectedElements.some(element => !element.visible);

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
      if (ignoreNextCanvasClickRef.current) {
        ignoreNextCanvasClickRef.current = false;
        return;
      }

      if (e.target === e.currentTarget) {
        selectElement(null);
      }
    },
    [selectElement]
  );

  const handleContentMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (e.target !== e.currentTarget) return;
      if (!contentRef.current) return;

      const contentRect = contentRef.current.getBoundingClientRect();
      const startX = e.clientX - contentRect.left;
      const startY = e.clientY - contentRect.top;
      const additiveSelection = e.ctrlKey || e.metaKey || e.shiftKey;
      const selectionBaseIds = additiveSelection ? selectedElementIds : [];
      let currentSelectionBox: SelectionBoxState = {
        startX,
        startY,
        currentX: startX,
        currentY: startY,
      };

      isSelectionDraggingRef.current = false;
      setSelectionBox(currentSelectionBox);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const nextX = moveEvent.clientX - contentRect.left;
        const nextY = moveEvent.clientY - contentRect.top;

        if (Math.abs(nextX - startX) > 3 || Math.abs(nextY - startY) > 3) {
          isSelectionDraggingRef.current = true;
        }

        currentSelectionBox = {
          startX,
          startY,
          currentX: nextX,
          currentY: nextY,
        };
        setSelectionBox(currentSelectionBox);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        setSelectionBox(null);

        if (!isSelectionDraggingRef.current) {
          return;
        }

        const nextSelectedIds = elements
          .filter(element =>
            selectionBoxIntersectsElement(currentSelectionBox, element, zoom)
          )
          .map(element => element.id);
        const mergedSelectedIds = additiveSelection
          ? Array.from(new Set([...selectionBaseIds, ...nextSelectedIds]))
          : nextSelectedIds;

        selectElements(
          mergedSelectedIds,
          nextSelectedIds[nextSelectedIds.length - 1] ??
            mergedSelectedIds[mergedSelectedIds.length - 1] ??
            null
        );
        ignoreNextCanvasClickRef.current = true;
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [elements, selectElements, selectedElementIds, zoom]
  );

  const handleSetSelectedLocked = useCallback(
    (locked: boolean) => {
      if (selectedElements.length === 0) {
        return;
      }

      updateElements(
        selectedElements.map(element => ({
          id: element.id,
          updates: { locked },
        }))
      );
    },
    [selectedElements, updateElements]
  );

  const handleSetSelectedVisible = useCallback(
    (visible: boolean) => {
      if (selectedElements.length === 0) {
        return;
      }

      updateElements(
        selectedElements.map(element => ({
          id: element.id,
          updates: { visible },
        }))
      );
    },
    [selectedElements, updateElements]
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
  const rulerThickness = 20;
  const minorGridSize = mmToPx(5) * zoom;
  const majorGridSize = mmToPx(10) * zoom;
  const showMinorGrid = minorGridSize >= 8;
  const pageLabel =
    pageSettings.size === 'Custom'
      ? `自定义 ${formatMillimeters(pageDimensions.width)} × ${formatMillimeters(
          pageDimensions.height
        )}`
      : `${pageSettings.size} ${
          pageSettings.orientation === 'portrait' ? '纵向' : '横向'
        }`;
  const gridBackgroundImage = showMinorGrid
    ? [
        'linear-gradient(to right, rgba(148, 163, 184, 0.22) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(148, 163, 184, 0.22) 1px, transparent 1px)',
        'linear-gradient(to right, rgba(100, 116, 139, 0.3) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(100, 116, 139, 0.3) 1px, transparent 1px)',
      ].join(', ')
    : [
        'linear-gradient(to right, rgba(100, 116, 139, 0.3) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(100, 116, 139, 0.3) 1px, transparent 1px)',
      ].join(', ');
  const gridBackgroundSize = showMinorGrid
    ? [
        `${minorGridSize}px ${minorGridSize}px`,
        `${minorGridSize}px ${minorGridSize}px`,
        `${majorGridSize}px ${majorGridSize}px`,
        `${majorGridSize}px ${majorGridSize}px`,
      ].join(', ')
    : [
        `${majorGridSize}px ${majorGridSize}px`,
        `${majorGridSize}px ${majorGridSize}px`,
      ].join(', ');

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#ece4d8]">
      <div
        className="border-b bg-white/85 px-4 py-3 text-xs text-slate-600"
        data-testid="canvas-status-bar"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-slate-700">
            纸张 {pageLabel}
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-slate-600">
            可打印区 {formatMillimeters(contentBounds.width)} ×{' '}
            {formatMillimeters(contentBounds.height)}
          </span>
          {selectedElements.length > 1 ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800">
              已选 {selectedElements.length} 项
            </span>
          ) : null}
          {lockedSelectedCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              已锁定 {lockedSelectedCount} 项
            </span>
          ) : null}
        </div>
      </div>

      {/* 画布区域 */}
      <div
        ref={viewportRef}
        className="flex flex-1 items-start justify-center overflow-auto p-8"
        onClick={handleCanvasClick}
      >
        <div
          className="relative"
          style={{
            width: pageWidth + rulerThickness,
            height: pageHeight + rulerThickness,
          }}
        >
          <div
            className="absolute top-0 left-0 flex items-center justify-center rounded-tl-md border border-stone-300 bg-white/95 text-[10px] font-medium text-slate-500 shadow-sm"
            style={{ width: rulerThickness, height: rulerThickness }}
          >
            mm
          </div>
          <div
            className="absolute top-0 left-5 overflow-hidden rounded-tr-md border border-l-0 border-stone-300 bg-white/95 shadow-sm"
            data-testid="canvas-rulers"
          >
            <Ruler
              direction="horizontal"
              length={pageDimensions.width}
              zoom={zoom}
            />
          </div>
          <div className="absolute top-5 left-0 overflow-hidden rounded-bl-md border border-t-0 border-stone-300 bg-white/95 shadow-sm">
            <Ruler
              direction="vertical"
              length={pageDimensions.height}
              zoom={zoom}
            />
          </div>
          <div
            className={cn(
              'absolute top-5 left-5 rounded-sm bg-white shadow-[0_24px_60px_rgba(73,55,28,0.18)] transition-all',
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
              data-testid="canvas-content"
              style={{
                left: contentLeft,
                top: contentTop,
                width: contentWidth,
                height: contentHeight,
              }}
              onMouseDown={handleContentMouseDown}
              onClick={e => {
                if (ignoreNextCanvasClickRef.current) {
                  ignoreNextCanvasClickRef.current = false;
                  return;
                }

                if (e.target === e.currentTarget) {
                  selectElement(null);
                }
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: gridBackgroundImage,
                  backgroundSize: gridBackgroundSize,
                }}
              />
              <div className="pointer-events-none absolute top-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] text-amber-700 shadow-sm">
                可打印区域
              </div>
              {selectionBox ? (
                <div
                  className="pointer-events-none absolute rounded-md border border-sky-500 bg-sky-200/20 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.2)]"
                  data-testid="marquee-selection"
                  style={getSelectionBoxStyle(selectionBox)}
                />
              ) : null}
              <div
                className="pointer-events-none absolute top-2 right-2 rounded-full bg-white/92 px-2 py-1 text-[10px] text-slate-600 shadow-sm"
                data-testid="canvas-grid-badge"
              >
                {showMinorGrid ? '5mm/10mm 对齐网格' : '10mm 对齐网格'}
              </div>
              {selectedElements.length > 1 ? (
                <div
                  className="absolute top-10 right-2 z-10 max-w-[22rem] rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-xl"
                  data-testid="multi-select-actions"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-900">
                        已选 {selectedElements.length} 项
                      </p>
                      {lockedSelectedCount > 0 ? (
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          已锁定 {lockedSelectedCount} 项
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MULTI_SELECT_ACTIONS.map(action => (
                      <Button
                        key={action.mode}
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full px-3 text-[11px]"
                        onClick={() => arrangeSelectedElements(action.mode)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-200 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3 text-[11px]"
                      onClick={() =>
                        handleSetSelectedLocked(!allSelectedLocked)
                      }
                    >
                      {allSelectedLocked ? (
                        <LockOpen className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Lock className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {allSelectedLocked ? '解锁选中' : '锁定选中'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3 text-[11px]"
                      onClick={() =>
                        handleSetSelectedVisible(hasHiddenSelected)
                      }
                    >
                      {hasHiddenSelected ? (
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {hasHiddenSelected ? '显示选中' : '隐藏选中'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3 text-[11px]"
                      onClick={duplicateSelectedElements}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      复制选中
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-3 text-[11px] text-rose-700"
                      onClick={removeSelectedElements}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      删除选中
                    </Button>
                  </div>
                </div>
              ) : null}
              {selectedElement && selectedElements.length === 1 ? (
                <div
                  className="pointer-events-none absolute top-10 right-2 rounded-2xl bg-slate-950/90 px-3 py-2 text-[11px] text-white shadow-lg"
                  data-testid="selected-element-hud"
                >
                  {getElementDisplayName(selectedElement)} · X{' '}
                  {formatMillimeters(selectedElement.position.x)} · Y{' '}
                  {formatMillimeters(selectedElement.position.y)} · 宽{' '}
                  {formatMillimeters(selectedElement.size.width)} · 高{' '}
                  {formatMillimeters(selectedElement.size.height)}
                </div>
              ) : null}

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
                  isSelected={selectedElementIds.includes(element.id)}
                  isPrimarySelected={element.id === selectedElementId}
                  selectedCount={selectedElements.length}
                  selectedElementsForDrag={selectedElements}
                  bounds={contentBounds}
                  templateType={templateType}
                  companyProfile={companyProfile}
                  alignmentGuides={
                    element.id === draggingElementId ? alignmentGuides : []
                  }
                  onSelect={options => selectElement(element.id, options)}
                  onFocusWithinSelection={() =>
                    selectElements(selectedElementIds, element.id)
                  }
                  onMoveSelection={(startPositions, delta) =>
                    moveElements({
                      ids: selectedElementIds,
                      startPositions,
                      delta,
                      bounds: contentBounds,
                    })
                  }
                  onUpdate={updates => updateElement(element.id, updates)}
                  onDragStart={() => setDraggingElementId(element.id)}
                  onDragEnd={() => setDraggingElementId(null)}
                />
              ))}
            </div>
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
  isPrimarySelected: boolean;
  selectedCount: number;
  selectedElementsForDrag: DesignElement[];
  bounds: { width: number; height: number };
  templateType: TemplateType;
  companyProfile?: PrintCompanyProfile | null;
  alignmentGuides?: AlignmentGuide[];
  onSelect: (options?: { additive?: boolean }) => void;
  onFocusWithinSelection: () => void;
  onMoveSelection: (
    startPositions: Record<string, { x: number; y: number }>,
    delta: { dx: number; dy: number }
  ) => void;
  onUpdate: (updates: Partial<DesignElement>) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function CanvasElement({
  element,
  zoom,
  isSelected,
  isPrimarySelected,
  selectedCount,
  selectedElementsForDrag,
  bounds,
  templateType,
  companyProfile,
  alignmentGuides = [],
  onSelect,
  onFocusWithinSelection,
  onMoveSelection,
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
  const placeholderPreviewData = useMemo(() => {
    if (element.type !== 'placeholder') {
      return null;
    }

    const previewData = cloneMockPrintData(templateType, companyProfile);
    const currentValue = getNestedValue(previewData, element.field);

    if (
      currentValue === undefined ||
      currentValue === null ||
      currentValue === ''
    ) {
      const previewValue =
        element.fallback.trim() || `示例${element.label || '字段内容'}`;
      setNestedPreviewValue(previewData, element.field, previewValue);
    }

    return previewData;
  }, [companyProfile, element, templateType]);

  // 开始拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const additiveSelection = e.ctrlKey || e.metaKey || e.shiftKey;
    const shouldDragSelection = isSelected && selectedCount > 1;

    onSelect({ additive: additiveSelection });

    if (additiveSelection) {
      return;
    }

    if (shouldDragSelection) {
      onFocusWithinSelection();

      if (element.locked) return;
      onDragStart?.();

      const startPositions = Object.fromEntries(
        selectedElementsForDrag.map(selectedElement => [
          selectedElement.id,
          {
            x: selectedElement.position.x,
            y: selectedElement.position.y,
          },
        ])
      );
      const startClientX = e.clientX;
      const startClientY = e.clientY;

      const handleGroupMouseMove = (moveEvent: MouseEvent) => {
        const deltaXPx = (moveEvent.clientX - startClientX) / zoom;
        const deltaYPx = (moveEvent.clientY - startClientY) / zoom;

        onMoveSelection(startPositions, {
          dx: deltaXPx / (96 / 25.4),
          dy: deltaYPx / (96 / 25.4),
        });
      };

      const handleGroupMouseUp = () => {
        onDragEnd?.();
        document.removeEventListener('mousemove', handleGroupMouseMove);
        document.removeEventListener('mouseup', handleGroupMouseUp);
      };

      document.addEventListener('mousemove', handleGroupMouseMove);
      document.addEventListener('mouseup', handleGroupMouseUp);
      return;
    }

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
          <div className="h-full w-full overflow-hidden">
            <TextRenderer
              element={{
                ...element,
                content: element.content || '文本',
              }}
              scale={zoom}
            />
          </div>
        );
      case 'placeholder':
        return (
          <div className="relative h-full w-full overflow-hidden rounded-sm bg-sky-50/25 ring-1 ring-sky-200/70 ring-inset">
            <PlaceholderRenderer
              element={element}
              data={placeholderPreviewData ?? {}}
              scale={zoom}
            />
            <div className="pointer-events-none absolute top-1 right-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] leading-none text-sky-700 shadow-sm">
              {element.label}
            </div>
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
          isPrimarySelected &&
            'ring-2 ring-amber-500 ring-offset-1 ring-offset-white',
          isSelected &&
            !isPrimarySelected &&
            'ring-2 ring-sky-500 ring-offset-1 ring-offset-white',
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
        data-testid={`canvas-element-${element.id}`}
        onMouseDown={handleMouseDown}
        onContextMenu={() => {
          if (isSelected && selectedCount > 1) {
            onFocusWithinSelection();
            return;
          }

          onSelect();
        }}
      >
        {renderContent()}

        {element.locked ? (
          <div className="pointer-events-none absolute top-1 left-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] text-white">
            已锁定
          </div>
        ) : null}

        {!element.visible ? (
          <div className="pointer-events-none absolute top-1 right-1 rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] text-white">
            已隐藏
          </div>
        ) : null}

        {isPrimarySelected && !element.locked && (
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
