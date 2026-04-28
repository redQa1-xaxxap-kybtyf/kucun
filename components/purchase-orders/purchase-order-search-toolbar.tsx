import { PackageCheck, Truck } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

interface PurchaseOrderSearchToolbarProps {
  searchValue: string;
  statusFilter: PurchaseOrderStatus | 'all';
  supplierId?: string;
  dateRange?: { startDate?: string; endDate?: string };
  isSearching?: boolean;
  onSearch: (value: string) => void;
  onStatusChange: (value: PurchaseOrderStatus | 'all') => void;
  onSupplierChange: (value: string | undefined) => void;
  onDateRangeChange?: (range: { startDate?: string; endDate?: string }) => void;
  onClearFilters: () => void;
}

export function PurchaseOrderSearchToolbar({
  searchValue,
  statusFilter,
  supplierId,
  dateRange,
  isSearching,
  onSearch,
  onStatusChange,
  onSupplierChange,
  onDateRangeChange,
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

  const hasActiveFilters =
    !!searchValue.trim() ||
    statusFilter !== 'all' ||
    !!supplierId ||
    !!dateRange?.startDate ||
    !!dateRange?.endDate;

  // 将供应商选择器整合到 SearchFilterCard 的自定义子节点中
  const supplierFilterNode = (
    <div className="flex flex-col gap-1.5">
      <label className="text-muted-foreground text-xs font-medium">
        供应商
      </label>
      <SupplierSelector
        value={supplierId}
        onValueChange={handleSupplierChange}
        placeholder="筛选供应商"
        className="h-9 min-w-[200px]"
      />
    </div>
  );

  return (
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
          label: '采购状态',
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
      // 日期范围筛选
      dateRangeFilter={
        onDateRangeChange
          ? {
              key: 'dateRange',
              label: '订单日期',
              value: {
                startDate: dateRange?.startDate,
                endDate: dateRange?.endDate,
              },
              onChange: (range: DateRangeValue) => {
                onDateRangeChange({
                  startDate: range.startDate,
                  endDate: range.endDate,
                });
              },
              placeholder: '选择订单日期范围',
            }
          : undefined
      }
      // 清空筛选
      onClearFilters={onClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
      // ✅ 添加供应商选择器作为自定义筛选器
      customFilters={supplierFilterNode}
    />
  );
}
