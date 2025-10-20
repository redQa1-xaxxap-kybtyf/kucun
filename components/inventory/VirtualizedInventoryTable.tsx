/**
 * 虚拟化库存表格组件
 * 使用 @tanstack/react-virtual 优化大数据量渲染性能
 * 遵循 TanStack Virtual 最佳实践
 */

'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Package } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
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
  onAdjust: (id: string) => void;
  /** 虚拟化配置 */
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
}

/**
 * 表头组件
 */
const TableHeaderComponent = React.memo(() => (
  <TableHeader className="bg-muted/30 sticky top-0 z-10">
    <TableRow>
      <TableHead className="text-xs">产品编码</TableHead>
      <TableHead className="text-xs">产品名称</TableHead>
      <TableHead className="text-xs">规格</TableHead>
      <TableHead className="text-xs">包装信息</TableHead>
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
const InventoryEmptyState = React.memo(() => (
  <div className="bg-card rounded border">
    <Table>
      <TableHeaderComponent />
      <TableBody>
        <TableRow>
          <TableCell colSpan={11} className="p-8">
            <EmptyState
              title="暂无库存数据"
              icon={<Package className="text-muted-foreground h-6 w-6" />}
              compact
            />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
));

InventoryEmptyState.displayName = 'InventoryEmptyState';

/**
 * 虚拟化库存表格组件
 * 使用 @tanstack/react-virtual 实现高性能虚拟滚动
 */
export const VirtualizedInventoryTable =
  React.memo<VirtualizedInventoryTableProps>(
    ({
      data,
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

      // 空状态
      if (data.length === 0) {
        return <InventoryEmptyState />;
      }

      return (
        <div className="bg-card rounded border">
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
                <TableHeaderComponent />

                {/* 虚拟化表体 - 只渲染可见行 */}
                <TableBody>
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const item = data[virtualRow.index];

                    return (
                      <InventoryTableRow
                        key={item.id}
                        item={item}
                        onAdjust={onAdjust}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          // 遵循 TanStack Virtual 最佳实践：直接使用 virtualRow.start
                          transform: `translateY(${virtualRow.start}px)`,
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
