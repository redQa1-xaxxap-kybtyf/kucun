/**
 * 通用虚拟化表格组件
 * 使用 @tanstack/react-virtual 优化大数据量渲染性能
 * 遵循全局约定规范和唯一真理原则
 */

'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * 表格列定义
 */
export interface VirtualizedTableColumn<T> {
  /** 列标识 */
  key: string;
  /** 列标题 */
  header: string | React.ReactNode;
  /** 列宽度（可选） */
  width?: string | number;
  /** 列对齐方式 */
  align?: 'left' | 'center' | 'right';
  /** 单元格渲染函数 */
  render: (item: T, index: number) => React.ReactNode;
  /** 表头类名 */
  headerClassName?: string;
  /** 单元格类名 */
  cellClassName?: string;
}

/**
 * 虚拟化表格属性
 */
export interface VirtualizedTableProps<T> {
  /** 数据列表 */
  data: T[];
  /** 列定义 */
  columns: VirtualizedTableColumn<T>[];
  /** 行高度（像素） */
  rowHeight?: number;
  /** 容器高度（像素） */
  containerHeight?: number;
  /** 预渲染行数 */
  overscan?: number;
  /** 行键值获取函数 */
  getRowKey: (item: T, index: number) => string;
  /** 行点击事件 */
  onRowClick?: (item: T, index: number) => void;
  /** 行类名 */
  rowClassName?: string | ((item: T, index: number) => string);
  /** 空状态渲染 */
  emptyState?: React.ReactNode;
  /** 加载状态 */
  isLoading?: boolean;
  /** 加载状态渲染 */
  loadingState?: React.ReactNode;
}

/**
 * 通用虚拟化表格组件
 */
export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 60,
  containerHeight = 600,
  overscan = 5,
  getRowKey,
  onRowClick,
  rowClassName,
  emptyState,
  isLoading,
  loadingState,
}: VirtualizedTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  // 虚拟化配置
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  // 加载状态
  if (isLoading) {
    return (
      <div className="rounded border bg-card">
        {loadingState || (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        )}
      </div>
    );
  }

  // 空状态
  if (data.length === 0) {
    return (
      <div className="rounded border bg-card">
        {emptyState || (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            暂无数据
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded border bg-card">
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: `${containerHeight}px` }}
      >
        <Table>
          {/* 表头 */}
          <TableHeader className="sticky top-0 z-10 bg-muted/30">
            <TableRow>
              {columns.map(column => (
                <TableHead
                  key={column.key}
                  className={cn(
                    'h-10 text-xs font-medium',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.headerClassName
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          {/* 虚拟化表体 */}
          <TableBody>
            <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              <td />
            </tr>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const item = data[virtualRow.index];
              const rowKey = getRowKey(item, virtualRow.index);
              const className =
                typeof rowClassName === 'function'
                  ? rowClassName(item, virtualRow.index)
                  : rowClassName;

              return (
                <TableRow
                  key={rowKey}
                  data-index={virtualRow.index}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    className
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onRowClick?.(item, virtualRow.index)}
                >
                  {columns.map(column => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        'h-full text-xs',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.cellClassName
                      )}
                      style={{ width: column.width }}
                    >
                      {column.render(item, virtualRow.index)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * 虚拟化表格的 React.memo 版本
 */
export const MemoizedVirtualizedTable = React.memo(
  VirtualizedTable
) as typeof VirtualizedTable;

