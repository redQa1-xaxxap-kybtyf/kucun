/**
 * 打印设计器 - 画布内表格预览
 *
 * 目标：
 * - 在画布上所见即所得展示表格列宽/行高
 * - 支持在表头拖拽分割线调整列宽（避免必须去右侧面板调数字）
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TableColumn, TableElement } from '@/lib/print-designer/schemas';

import { TableRenderer, mmToPx, pxToMm } from '../../renderer';

type HeaderCellMetrics = { left: number; width: number };
type ResizeIndicator = {
  boundaryIndex: number;
  leftLabel: string;
  rightLabel: string;
  leftWidth: string;
  rightWidth: string;
  x: number;
};

interface TableElementPreviewProps {
  element: TableElement;
  zoom: number;
  isSelected: boolean;
  onColumnsChange: (columns: TableColumn[]) => void;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatColumnWidth(
  column: TableColumn,
  widthPx: number,
  tableWidthPx: number,
  zoom: number
): string {
  if (column.widthUnit === 'mm') {
    return `${roundTo(pxToMm(widthPx) / zoom, 1).toFixed(1)}mm`;
  }

  return `${roundTo((widthPx / tableWidthPx) * 100, 1).toFixed(1)}%`;
}

function buildNestedData(
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path
    .split('.')
    .map(k => k.trim())
    .filter(Boolean);

  if (keys.length === 0) return {};

  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (i === keys.length - 1) {
      current[key] = value;
      return root;
    }
    const next: Record<string, unknown> = {};
    current[key] = next;
    current = next;
  }
  return root;
}

function getMinColumnWidthPx(
  column: TableColumn,
  tableWidthPx: number,
  zoom: number
): number {
  if (column.widthUnit === '%') {
    return (tableWidthPx * 5) / 100;
  }
  return mmToPx(5) * zoom;
}

export function TableElementPreview({
  element,
  zoom,
  isSelected,
  onColumnsChange,
}: TableElementPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{
    boundaryIndex: number;
    startClientX: number;
    tableWidthPx: number;
    startWidthsPx: number[];
  } | null>(null);

  const [headerCells, setHeaderCells] = useState<HeaderCellMetrics[]>([]);
  const [hoveredBoundaryIndex, setHoveredBoundaryIndex] = useState<number | null>(
    null
  );
  const [resizeIndicator, setResizeIndicator] = useState<ResizeIndicator | null>(
    null
  );

  const previewData = useMemo(() => {
    const rows = Math.max(element.minRows ?? 0, 3);
    const value = Array.from({ length: rows }, () => ({}));
    return buildNestedData(element.dataSource, value);
  }, [element.dataSource, element.minRows]);

  const measureHeaderCells = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setHeaderCells([]);
      return;
    }

    const thList =
      container.querySelectorAll<HTMLTableCellElement>('table thead th');
    if (thList.length === 0) {
      setHeaderCells([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const cells: HeaderCellMetrics[] = Array.from(thList).map(th => {
      const rect = th.getBoundingClientRect();
      return {
        left: rect.left - containerRect.left,
        width: rect.width,
      };
    });

    setHeaderCells(cells);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => measureHeaderCells());
    return () => cancelAnimationFrame(id);
  }, [
    measureHeaderCells,
    zoom,
    element.size.width,
    element.size.height,
    element.columns,
    element.style,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => measureHeaderCells());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measureHeaderCells]);

  const applyColumnResizeByPx = useCallback(
    (
      boundaryIndex: number,
      leftWidthPx: number,
      rightWidthPx: number,
      tableWidthPx: number
    ) => {
      const leftColumn = element.columns[boundaryIndex];
      const rightColumn = element.columns[boundaryIndex + 1];

      if (!leftColumn || !rightColumn) return;

      const nextColumns = element.columns.map((col, idx) => {
        if (idx !== boundaryIndex && idx !== boundaryIndex + 1) return col;

        const widthPx = idx === boundaryIndex ? leftWidthPx : rightWidthPx;
        if (col.widthUnit === 'mm') {
          const mm = pxToMm(widthPx) / zoom;
          return { ...col, width: Math.max(5, roundTo(mm, 1)) };
        }

        const percent = (widthPx / tableWidthPx) * 100;
        return { ...col, width: Math.max(5, roundTo(percent, 1)) };
      });

      onColumnsChange(nextColumns);
    },
    [element.columns, onColumnsChange, zoom]
  );

  const handleResizeMouseDown = useCallback(
    (boundaryIndex: number, e: React.MouseEvent) => {
      if (!isSelected) return;
      if (!containerRef.current) return;
      if (headerCells.length !== element.columns.length) return;

      e.preventDefault();
      e.stopPropagation();

      const tableWidthPx = containerRef.current.getBoundingClientRect().width;
      const startWidthsPx = headerCells.map(c => c.width);
      resizeStateRef.current = {
        boundaryIndex,
        startClientX: e.clientX,
        tableWidthPx,
        startWidthsPx,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const state = resizeStateRef.current;
        if (!state) return;

        const leftIndex = state.boundaryIndex;
        const rightIndex = leftIndex + 1;
        const startLeftPx = state.startWidthsPx[leftIndex] ?? 0;
        const startRightPx = state.startWidthsPx[rightIndex] ?? 0;
        const totalPx = startLeftPx + startRightPx;
        if (totalPx <= 0) return;

        const deltaPx = moveEvent.clientX - state.startClientX;

        const leftColumn = element.columns[leftIndex];
        const rightColumn = element.columns[rightIndex];
        if (!leftColumn || !rightColumn) return;

        const minLeftPx = getMinColumnWidthPx(
          leftColumn,
          state.tableWidthPx,
          zoom
        );
        const minRightPx = getMinColumnWidthPx(
          rightColumn,
          state.tableWidthPx,
          zoom
        );

        const nextLeftPx = Math.max(
          minLeftPx,
          Math.min(totalPx - minRightPx, startLeftPx + deltaPx)
        );
        const nextRightPx = Math.max(minRightPx, totalPx - nextLeftPx);
        const boundaryX =
          (headerCells[leftIndex]?.left ?? 0) + nextLeftPx;

        applyColumnResizeByPx(
          leftIndex,
          nextLeftPx,
          nextRightPx,
          state.tableWidthPx
        );

        setResizeIndicator({
          boundaryIndex: leftIndex,
          leftLabel: leftColumn.label.replace(/\n/g, ' '),
          rightLabel: rightColumn.label.replace(/\n/g, ' '),
          leftWidth: formatColumnWidth(
            leftColumn,
            nextLeftPx,
            state.tableWidthPx,
            zoom
          ),
          rightWidth: formatColumnWidth(
            rightColumn,
            nextRightPx,
            state.tableWidthPx,
            zoom
          ),
          x: boundaryX,
        });
      };

      const handleMouseUp = () => {
        resizeStateRef.current = null;
        setResizeIndicator(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [applyColumnResizeByPx, element.columns, headerCells, isSelected, zoom]
  );

  const boundaries = useMemo(() => {
    if (headerCells.length !== element.columns.length) return [];
    if (element.columns.length < 2) return [];
    return headerCells.slice(0, -1).map(cell => cell.left + cell.width);
  }, [element.columns.length, headerCells]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none h-full w-full">
        <TableRenderer element={element} data={previewData} scale={zoom} />
      </div>

      {isSelected ? (
        <div className="pointer-events-none absolute top-1 left-1 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] text-white shadow-sm">
          拖拽表头分隔线可直接调列宽
        </div>
      ) : null}

      {resizeIndicator ? (
        <div
          className="pointer-events-none absolute top-8 z-10 -translate-x-1/2 rounded-2xl bg-slate-950/90 px-3 py-2 text-[10px] text-white shadow-lg"
          style={{ left: resizeIndicator.x }}
          data-testid="table-resize-indicator"
        >
          <div className="font-medium text-white">
            {resizeIndicator.leftLabel} {resizeIndicator.leftWidth}
          </div>
          <div className="mt-1 text-slate-200">
            {resizeIndicator.rightLabel} {resizeIndicator.rightWidth}
          </div>
        </div>
      ) : null}

      {isSelected &&
        boundaries.map((x, index) => (
          <div
            key={`col-resize-${index}`}
            className="absolute top-0 h-full cursor-col-resize"
            style={{ left: x - 3, width: 6 }}
            data-testid={`table-resize-handle-${index}`}
            onMouseDown={e => handleResizeMouseDown(index, e)}
            onMouseEnter={() => setHoveredBoundaryIndex(index)}
            onMouseLeave={() => setHoveredBoundaryIndex(current =>
              current === index ? null : current
            )}
          >
            <div
              className={`mx-auto h-full transition-all ${
                resizeIndicator?.boundaryIndex === index ||
                hoveredBoundaryIndex === index
                  ? 'w-[2px] bg-amber-500'
                  : 'w-px bg-primary/40'
              }`}
            />
            <div
              className={`absolute top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border bg-white shadow-sm transition-all ${
                resizeIndicator?.boundaryIndex === index ||
                hoveredBoundaryIndex === index
                  ? 'border-amber-400'
                  : 'border-slate-300'
              }`}
            />
          </div>
        ))}
    </div>
  );
}
