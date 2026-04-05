/**
 * 虚拟化库存表格组件
 * 使用 @tanstack/react-virtual 优化大数据量渲染性能
 * 遵循 TanStack Virtual 最佳实践
 */

'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { InventoryTableRow } from '@/components/inventory/InventoryTableRow';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { can } from '@/lib/auth/permissions';
import type { Inventory } from '@/lib/types/inventory';

interface VirtualizedInventoryTableProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  /** 虚拟化配置 */
  itemHeight?: number;
  containerHeight?: number;
  /** ✅ 搜索关键词，用于区分无数据和搜索无结果 */
  searchQuery?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  overscan?: number;
  density: 'compact' | 'comfortable';
}

type ClearFiltersHandler = () => void;

/**
 * 表头组件
 */
const TableHeaderComponent = React.memo<{ hasFinancePermission: boolean }>(
  ({ hasFinancePermission }) => (
    <TableHeader className="sticky top-0 z-20 bg-[hsl(var(--color-bg-card))] shadow-sm">
      <TableRow>
        <TableHead className="w-12">缩略图</TableHead>
        <TableHead>产品编码</TableHead>
        <TableHead>产品名称</TableHead>
        <TableHead>规格</TableHead>
        <TableHead>包装信息</TableHead>
        <TableHead>批次号</TableHead>
        <TableHead className="text-right">库存数量</TableHead>
        <TableHead className="text-right">预留数量</TableHead>
        <TableHead className="text-right">可用数量</TableHead>
        {hasFinancePermission && (
          <TableHead className="text-right">成本（单价/总价）</TableHead>
        )}
        <TableHead>库存状态</TableHead>
        <TableHead>最后更新</TableHead>
        <TableHead className="w-20 text-right">操作</TableHead>
      </TableRow>
    </TableHeader>
  )
);

TableHeaderComponent.displayName = 'TableHeaderComponent';

/**
 * 空状态组件
 */
const InventoryEmptyState = React.memo<{
  hasActiveFilters?: boolean;
  hasFinancePermission: boolean;
  onClearFilters?: ClearFiltersHandler;
  searchQuery?: string;
}>(
  ({ hasActiveFilters, hasFinancePermission, onClearFilters, searchQuery }) => {
    const isFilteredEmpty = Boolean(searchQuery?.trim() || hasActiveFilters);

    return (
      <div className="bg-card rounded border">
        <Table>
          <TableHeaderComponent hasFinancePermission={hasFinancePermission} />
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={hasFinancePermission ? 13 : 12}
                className="p-8"
              >
                <EmptyState
                  title={
                    isFilteredEmpty ? '未找到匹配的库存记录' : '暂无库存数据'
                  }
                  description={
                    isFilteredEmpty
                      ? '请尝试调整关键词或筛选条件后再试。'
                      : '还没有任何库存记录，您可以先进行产品入库。'
                  }
                  icon={<Package className="text-muted-foreground h-6 w-6" />}
                  action={
                    isFilteredEmpty ? (
                      onClearFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onClearFilters}
                        >
                          清空条件
                        </Button>
                      ) : null
                    ) : (
                      <Button size="sm" asChild>
                        <Link href="/inventory/inbound/create">去入库</Link>
                      </Button>
                    )
                  }
                  compact
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }
);

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
      itemHeight,
      containerHeight = 400,
      searchQuery,
      hasActiveFilters,
      onClearFilters,
      overscan = 5,
      density,
    }) => {
      const parentRef = React.useRef<HTMLDivElement>(null);
      const { data: session } = useSession();

      // Determine row height based on density if not provided
      const rowHeight = itemHeight ?? (density === 'compact' ? 40 : 60);

      // 检查用户是否有财务查看权限
      const hasFinancePermission = React.useMemo(
        () => can(session?.user ?? null, 'finance:view'),
        [session?.user]
      );

      // 虚拟化配置 - 遵循 TanStack Virtual 最佳实践
      const rowVirtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight, // 使用 estimateSize 而不是固定 size
        overscan, // 预渲染行数，提升滚动体验
      });

      // 空状态
      if (data.length === 0) {
        return (
          <InventoryEmptyState
            hasFinancePermission={hasFinancePermission}
            searchQuery={searchQuery}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={onClearFilters}
          />
        );
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
              <Table
                className={
                  density === 'compact'
                    ? '[&_td]:!px-2 [&_td]:!py-2 [&_th]:!px-2 [&_th]:!py-2'
                    : ''
                }
              >
                {/* 固定表头 */}
                <TableHeaderComponent
                  hasFinancePermission={hasFinancePermission}
                />

                {/* 虚拟化表体 - 只渲染可见行 */}
                <TableBody>
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const item = data[virtualRow.index];

                    return (
                      <InventoryTableRow
                        key={item.id}
                        item={item}
                        onAdjust={onAdjust}
                        hasFinancePermission={hasFinancePermission}
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
