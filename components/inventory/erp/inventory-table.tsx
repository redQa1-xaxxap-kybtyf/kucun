'use client';

import { Package } from 'lucide-react';

import { InventoryTableRow } from '@/components/inventory/InventoryTableRow';
import { VirtualizedInventoryTable } from '@/components/inventory/VirtualizedInventoryTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={10} className="h-32 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Package className="h-8 w-8" />
          <span className="text-sm">暂无库存数据</span>
        </div>
      </TableCell>
    </TableRow>
  );
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
  if (useVirtualization && data.length > 50) {
    return (
      <VirtualizedInventoryTable
        data={data}
        selectedIds={Array.from(selectedIds)}
        onSelectAll={onSelectAll}
        onSelectRow={onSelectRow}
        onAdjust={onAdjust}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="w-12">
            <input
              type="checkbox"
              checked={isAllSelected && canSelectAll}
              onChange={e => onSelectAll(e.target.checked)}
              className="rounded border border-input"
            />
          </TableHead>
          <TableHead>产品编码</TableHead>
          <TableHead>产品名称</TableHead>
          <TableHead>规格</TableHead>
          <TableHead>批次号</TableHead>
          <TableHead>库存数量</TableHead>
          <TableHead>预留数量</TableHead>
          <TableHead>可用数量</TableHead>
          <TableHead>库存状态</TableHead>
          <TableHead>最后更新</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          data.map(inventory => (
            <InventoryTableRow
              key={inventory.id}
              item={inventory}
              isSelected={selectedIds.has(inventory.id)}
              onSelect={(id, checked) => onSelectRow(id, checked)}
              onAdjust={id => onAdjust(id)}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}
