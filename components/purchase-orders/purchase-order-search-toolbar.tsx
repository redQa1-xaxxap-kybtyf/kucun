import { Filter, PackageCheck, Truck } from 'lucide-react';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

interface PurchaseOrderSearchToolbarProps {
  searchValue: string;
  statusFilter: PurchaseOrderStatus | 'all';
  supplierId?: string;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  onStatusChange: (value: PurchaseOrderStatus | 'all') => void;
  onSupplierChange: (value: string | undefined) => void;
  onClearFilters: () => void;
}

export function PurchaseOrderSearchToolbar({
  searchValue,
  statusFilter,
  supplierId,
  isSearching,
  onSearch,
  onStatusChange,
  onSupplierChange,
  onClearFilters,
}: PurchaseOrderSearchToolbarProps) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'status') {
        onStatusChange(
          value && value !== 'all' ? (value as PurchaseOrderStatus) : 'all'
        );
      }
    },
    [onStatusChange]
  );

  const handleSupplierChange = React.useCallback(
    (value: string) => {
      onSupplierChange(value || undefined);
    },
    [onSupplierChange]
  );

  const hasActiveFilters = statusFilter !== 'all' || !!supplierId;

  return (
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-light)' }}
    >
      <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <UnifiedSearchBar
            searchValue={searchValue}
            onSearchChange={onSearch}
            searchPlaceholder="搜索采购订单号、集装箱号..."
            compact
            debounceDelay={0}
            isSearching={isSearching}
            toggleButtons={[
              {
                key: 'in_transit',
                label: '运输中',
                icon: <Truck className="h-3.5 w-3.5" />,
                active: statusFilter === 'in_transit',
                onClick: () =>
                  onStatusChange(
                    statusFilter === 'in_transit' ? 'all' : 'in_transit'
                  ),
              },
              {
                key: 'arrived',
                label: '已到港',
                icon: <PackageCheck className="h-3.5 w-3.5" />,
                active: statusFilter === 'arrived',
                onClick: () =>
                  onStatusChange(
                    statusFilter === 'arrived' ? 'all' : 'arrived'
                  ),
              },
            ]}
            filters={[
              {
                key: 'status',
                label: '状态',
                includeAllOption: true,
                options: Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(
                  ([value, label]) => ({
                    label,
                    value,
                  })
                ),
                width: 'w-full sm:w-40',
              },
            ]}
            filterValues={{
              status: statusFilter === 'all' ? 'all' : statusFilter,
            }}
            onFilterChange={handleFilterChange}
          />

          <div className="w-full min-w-[200px] sm:w-56">
            <SupplierSelector
              value={supplierId}
              onValueChange={handleSupplierChange}
              placeholder="筛选供应商"
              className="h-10"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-8 gap-1.5 transition-all hover:border-blue-300 hover:bg-blue-50"
            >
              <Filter className="h-3.5 w-3.5" />
              清空筛选
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
