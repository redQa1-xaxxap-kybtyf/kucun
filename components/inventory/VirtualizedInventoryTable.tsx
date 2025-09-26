/**
 * 虚拟化库存表格组件
 * 使用虚拟滚动技术优化大数据量渲染性能
 */

'use client';

import * as React from 'react';
import { Package } from 'lucide-react';

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
 * 虚拟滚动Hook
 * 计算可视区域内需要渲染的项目
 */
function useVirtualization({
  itemCount,
  itemHeight = 60,
  containerHeight = 400,
  overscan = 5,
}: {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan: number;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  // 计算可视区域
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // 可见项目数量
  const visibleCount = endIndex - startIndex + 1;

  // 总高度
  const totalHeight = itemCount * itemHeight;

  // 偏移量
  const offsetY = startIndex * itemHeight;

  return {
    startIndex,
    endIndex,
    visibleCount,
    totalHeight,
    offsetY,
    setScrollTop,
  };
}

/**
 * 虚拟化库存表格组件
 * 只渲染可视区域内的行，大幅提升大数据量时的性能
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
      const scrollElementRef = React.useRef<HTMLDivElement>(null);

      // 虚拟化计算
      const { startIndex, endIndex, totalHeight, offsetY, setScrollTop } =
        useVirtualization({
          itemCount: data.length,
          itemHeight,
          containerHeight,
          overscan,
        });

      // 滚动事件处理
      const handleScroll = React.useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
          setScrollTop(e.currentTarget.scrollTop);
        },
        [setScrollTop]
      );

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

      // 可见项目
      const visibleItems = React.useMemo(
        () => data.slice(startIndex, endIndex + 1),
        [data, startIndex, endIndex]
      );

      // 如果没有数据
      if (data.length === 0) {
        return (
          <div className="rounded border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 text-xs">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={handleSelectAll}
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
        );
      }

      return (
        <div className="rounded border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12 text-xs">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={input => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
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
          </Table>

          {/* 虚拟滚动容器 */}
          <div
            ref={scrollElementRef}
            className="overflow-auto"
            style={{ height: containerHeight }}
            onScroll={handleScroll}
          >
            {/* 虚拟空间 */}
            <div style={{ height: totalHeight, position: 'relative' }}>
              {/* 可见项目容器 */}
              <div
                style={{
                  transform: `translateY(${offsetY}px)`,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <Table>
                  <TableBody>
                    {visibleItems.map((item, index) => (
                      <InventoryTableRow
                        key={`${startIndex + index}-${item.id}`}
                        item={item}
                        isSelected={selectedIds.includes(item.id)}
                        onSelect={onSelectRow}
                        onAdjust={onAdjust}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      );
    }
  );

VirtualizedInventoryTable.displayName = 'VirtualizedInventoryTable';
