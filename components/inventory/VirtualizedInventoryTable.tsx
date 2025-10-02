/**
 * 虚拟化库存表格组件
 * 使用 @tanstack/react-virtual 优化大数据量渲染性能
 * 遵循 TanStack Virtual 最佳实践
 */

'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Package } from 'lucide-react';
import * as React from 'react';

import { InventoryTableRow } from '@/components/inventory/InventoryTableRow';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Inventory } from '@/lib/types/inventory';

interface VirtualizedInventoryTableProps {
  data: Inventory[];
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onAdjust: (id: string) => void;
  /** 虚拟化配置 */
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
}

/**
 * 表头组件
 */
const TableHeaderComponent = React.memo<{
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
}>(({ isAllSelected, isIndeterminate, onSelectAll }) => (
  <TableHeader className="sticky top-0 z-10 bg-muted/30">
    <TableRow>
      <TableHead className="w-12 text-xs">
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={input => {
            if (input) {input.indeterminate = isIndeterminate;}
          }}
          onChange={onSelectAll}
          className="rounded border border-input"
        />
      </TableHead>
      <TableHead className="text-xs">产品编码</TableHead>
      <TableHead className="text-xs">产品名称</TableHead>
      <TableHead className="text-xs">规格</TableHead>
      <TableHead className="text-xs">批次号</TableHead>
      <TableHead className="text-xs">库存数量</TableHead>
      <TableHead className="text-xs">预留数量</TableHead>
      <TableHead className="text-xs">可用数量</TableHead>
      <TableHead className="text-xs">库存状态</TableHead>
      <TableHead className="text-xs">最后更新</TableHead>
      <TableHead className="w-20 text-xs">操作</TableHead>
    </TableRow>
  </TableHeader>
));

TableHeaderComponent.displayName = 'TableHeaderComponent';

/**
 * 空状态组件
 */
const EmptyState = React.memo(() => (
  <div className="rounded border bg-card">
    <Table>
      <TableHeaderComponent
        isAllSelected={false}
        isIndeterminate={false}
        onSelectAll={() => {}}
      />
      <TableBody>
        <TableRow>
          <TableCell
            colSpan={11}
            className="h-24 text-center text-muted-foreground"
          >
            <div className="flex flex-col items-center gap-2">
              <Package className="h-8 w-8" />
              <div>暂无库存数据</div>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
));

EmptyState.displayName = 'EmptyState';

/**
 * 虚拟化库存表格组件
 * 使用 @tanstack/react-virtual 实现高性能虚拟滚动
 */
export const VirtualizedInventoryTable =
  React.memo<VirtualizedInventoryTableProps>(
    ({
      data,
      selectedIds,
      onSelectAll,
      onSelectRow,
      onAdjust,
      itemHeight = 60,
      containerHeight = 400,
      overscan = 5,
    }) => {
      const parentRef = React.useRef<HTMLDivElement>(null);

      // 虚拟化配置 - 遵循 TanStack Virtual 最佳实践
      const rowVirtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemHeight, // 使用 estimateSize 而不是固定 size
        overscan, // 预渲染行数，提升滚动体验
      });

      // 全选状态
      const isAllSelected = React.useMemo(
        () => data.length > 0 && selectedIds.length === data.length,
        [data.length, selectedIds.length]
      );

      // 部分选中状态
      const isIndeterminate = React.useMemo(
        () => selectedIds.length > 0 && selectedIds.length < data.length,
        [selectedIds.length, data.length]
      );

      // 优化的全选处理
      const handleSelectAll = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          onSelectAll(e.target.checked);
        },
        [onSelectAll]
      );

      // 空状态
      if (data.length === 0) {
        return <EmptyState />;
      }

      return (
        <div className="rounded border bg-card">
          {/* 滚动容器 */}
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: `${containerHeight}px` }}
          >
            {/* 虚拟空间容器 */}
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              <Table>
                {/* 固定表头 */}
                <TableHeaderComponent
                  isAllSelected={isAllSelected}
                  isIndeterminate={isIndeterminate}
                  onSelectAll={handleSelectAll}
                />

                {/* 虚拟化表体 - 只渲染可见行 */}
                <TableBody>
                  {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
                    const item = data[virtualRow.index];

                    return (
                      <InventoryTableRow
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.includes(item.id)}
                        onSelect={onSelectRow}
                        onAdjust={onAdjust}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          // 表格行的 transform 计算：基于行的初始位置
                          // 需要减去 index * virtualRow.size 来正确计算偏移
                          // 参考: https://tanstack.com/virtual/latest/docs/framework/react/examples/table
                          transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
                        }}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      );
    }
  );

VirtualizedInventoryTable.displayName = 'VirtualizedInventoryTable';
