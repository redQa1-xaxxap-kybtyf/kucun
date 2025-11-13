import { PackageCheck, Truck } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { SupplierSelector } from '@/components/suppliers/supplier-selector';
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
    <div className="space-y-3">
      <SearchFilterCard
        searchValue={searchValue}
        onSearchChange={onSearch}
        searchPlaceholder="搜索采购订单号、集装箱号..."
        isSearching={isSearching}
        // Toggle 按钮
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
              onStatusChange(statusFilter === 'arrived' ? 'all' : 'arrived'),
          },
        ]}
        // 筛选器配置
        filters={[
          {
            key: 'status',
            label: '状态',
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
        // 清空筛选
        onClearFilters={onClearFilters}
        hasActiveFilters={hasActiveFilters}
        variant="elevated"
      />

      {/* 供应商选择器 - 单独一行 */}
      <div className="w-full min-w-[200px] sm:w-56">
        <SupplierSelector
          value={supplierId}
          onValueChange={handleSupplierChange}
          placeholder="筛选供应商"
          className="h-10"
        />
      </div>
    </div>
  );
}
