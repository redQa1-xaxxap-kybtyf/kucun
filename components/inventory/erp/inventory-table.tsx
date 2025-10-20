'use client';

import { InventoryGroupedTable } from '@/components/inventory/InventoryGroupedTable';
import { VirtualizedInventoryTable } from '@/components/inventory/VirtualizedInventoryTable';
import type { Inventory } from '@/lib/types/inventory';

interface InventoryTableProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  useVirtualization?: boolean;
}

export function InventoryTable({
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
