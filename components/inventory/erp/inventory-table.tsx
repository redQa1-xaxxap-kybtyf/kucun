'use client';

import { InventoryGroupedTable } from '@/components/inventory/InventoryGroupedTable';
import { VirtualizedInventoryTable } from '@/components/inventory/VirtualizedInventoryTable';
import type { Inventory } from '@/lib/types/inventory';

interface InventoryTableProps {
  data: Inventory[];
  selectedIds: Set<string>;
  isAllSelected: boolean;
  canSelectAll: boolean;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onAdjust: (id: string) => void;
  useVirtualization?: boolean;
}

export function InventoryTable({
  data,
  selectedIds,
  isAllSelected,
  canSelectAll,
  onSelectAll,
  onSelectRow,
  onAdjust,
  useVirtualization = false,
}: InventoryTableProps) {
  // 虚拟化模式（大数据量时使用，不支持合并单元格）
  if (useVirtualization && data.length > 50) {
    return (
      <VirtualizedInventoryTable
        data={data}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        onSelectRow={onSelectRow}
        onAdjust={onAdjust}
      />
    );
  }

  // 使用支持合并单元格的分组表格
  return (
    <InventoryGroupedTable
      data={data}
      selectedIds={selectedIds}
      isAllSelected={isAllSelected}
      canSelectAll={canSelectAll}
      onSelectAll={onSelectAll}
      onSelectRow={onSelectRow}
      onAdjust={onAdjust}
    />
  );
}
