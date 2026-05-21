'use client';

import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { memo, useMemo } from 'react';

import { InventoryMobileList } from '@/components/inventory/erp/inventory-mobile-list';
import { InventoryGroupedTable } from '@/components/inventory/InventoryGroupedTable';
import { can } from '@/lib/auth/permissions';
import type { Inventory } from '@/lib/types/inventory';

const VirtualizedInventoryTable = dynamic(
  () =>
    import('@/components/inventory/VirtualizedInventoryTable').then(
      mod => mod.VirtualizedInventoryTable
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
        加载表格中...
      </div>
    ),
  }
);

interface InventoryTableProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  useVirtualization?: boolean;
  searchQuery?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  density: 'compact' | 'comfortable';
}

function DesktopInventoryTable({
  data,
  onAdjust,
  useVirtualization,
  searchQuery,
  hasActiveFilters,
  onClearFilters,
  density,
}: InventoryTableProps) {
  if (useVirtualization && data.length > 50) {
    return (
      <VirtualizedInventoryTable
        data={data}
        onAdjust={onAdjust}
        searchQuery={searchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        density={density}
      />
    );
  }

  return (
    <InventoryGroupedTable
      data={data}
      onAdjust={onAdjust}
      searchQuery={searchQuery}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      density={density}
    />
  );
}

function InventoryTableImpl({
  data,
  onAdjust,
  useVirtualization = false,
  searchQuery,
  hasActiveFilters,
  onClearFilters,
  density,
}: InventoryTableProps) {
  const { data: session } = useSession();
  const showFinance = useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );

  return (
    <>
      <div className="hidden lg:block">
        <DesktopInventoryTable
          data={data}
          onAdjust={onAdjust}
          useVirtualization={useVirtualization}
          searchQuery={searchQuery}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          density={density}
        />
      </div>

      <div className="lg:hidden">
        <InventoryMobileList
          data={data}
          onAdjust={onAdjust}
          searchQuery={searchQuery}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          showFinance={showFinance}
        />
      </div>
    </>
  );
}

// 性能优化：避免上层 props 抖动导致整表重渲染
export const InventoryTable = memo(
  InventoryTableImpl,
  (prev, next) =>
    prev.data === next.data &&
    prev.onAdjust === next.onAdjust &&
    prev.useVirtualization === next.useVirtualization &&
    prev.searchQuery === next.searchQuery &&
    prev.hasActiveFilters === next.hasActiveFilters &&
    prev.density === next.density &&
    prev.onClearFilters === next.onClearFilters
);
