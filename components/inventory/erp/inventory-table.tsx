'use client';

import { memo } from 'react';
import { InventoryGroupedTable } from '@/components/inventory/InventoryGroupedTable';
import { VirtualizedInventoryTable } from '@/components/inventory/VirtualizedInventoryTable';
import type { Inventory } from '@/lib/types/inventory';

interface InventoryTableProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  useVirtualization?: boolean;
}

function InventoryTableImpl({
  data,
  onAdjust,
  useVirtualization = false,
}: InventoryTableProps) {
  // 虚拟化模式（大数据量时使用，不支持合并单元格）
  if (useVirtualization && data.length > 50) {
    return <VirtualizedInventoryTable data={data} onAdjust={onAdjust} />;
  }

  // 使用支持合并单元格的分组表格
  return <InventoryGroupedTable data={data} onAdjust={onAdjust} />;
}

// ✅ 性能优化：避免搜索输入变更导致整表重渲染
// 仅当 data 引用、onAdjust 引用或 useVirtualization 发生变化时才重新渲染
export const InventoryTable = memo(
  InventoryTableImpl,
  (prev, next) =>
    prev.data === next.data &&
    prev.onAdjust === next.onAdjust &&
    prev.useVirtualization === next.useVirtualization
);
