'use client';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
  PAYABLE_STATUS_LABELS,
  type PayableRecordQuery,
  type PayableSourceType,
  type PayableStatus,
} from '@/lib/types/payable';

interface Props {
  query: PayableRecordQuery;
  searchValue: string;
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
  isSearching?: boolean;
  onClearFilters?: () => void;
}

export function PayablesFilterBar({
  query,
  searchValue,
  onSearch,
  onFilterChange,
  onDateRangeChange,
  isSearching = false,
  onClearFilters,
}: Props) {
  const hasActiveFilters =
    Boolean(searchValue.trim()) ||
    Boolean(query.status) ||
    Boolean(query.sourceType) ||
    Boolean(query.startDate) ||
    Boolean(query.endDate) ||
    (query.sortBy ?? 'createdAt') !== 'createdAt' ||
    (query.sortOrder ?? 'desc') !== 'desc';

  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearch}
      searchPlaceholder="搜索应付单号、供应商名称"
      isSearching={isSearching}
      // 筛选器配置
      filters={[
        {
          key: 'status',
          label: '付款状态',
          options: [
            { label: PAYABLE_STATUS_LABELS.pending, value: 'pending' },
            { label: PAYABLE_STATUS_LABELS.partial, value: 'partial' },
            { label: PAYABLE_STATUS_LABELS.paid, value: 'paid' },
            { label: '已取消', value: 'cancelled' },
          ],
          width: 'w-[140px]',
        },
        {
          key: 'sourceType',
          label: '业务来源',
          options: [
            { label: '采购订单', value: 'purchase_order' },
            { label: '厂家发货', value: 'factory_shipment' },
            { label: '服务费用', value: 'service' },
            { label: '其他', value: 'other' },
          ],
          width: 'w-[140px]',
        },
        {
          key: 'sortBy',
          label: '排序',
          options: [
            { label: '创建时间', value: 'createdAt' },
            { label: '应付金额', value: 'payableAmount' },
            { label: '剩余金额', value: 'remainingAmount' },
          ],
          width: 'w-[140px]',
        },
        {
          key: 'sortOrder',
          label: '排序方向',
          options: [
            { label: '降序', value: 'desc' },
            { label: '升序', value: 'asc' },
          ],
          width: 'w-[100px]',
        },
      ]}
      filterValues={{
        status: (query.status as PayableStatus) || 'all',
        sourceType: (query.sourceType as PayableSourceType) || 'all',
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
      }}
      onFilterChange={onFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '单据日期',
        value: { startDate: query.startDate, endDate: query.endDate },
        onChange: onDateRangeChange,
        placeholder: '选择单据日期',
      }}
      onClearFilters={onClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
    />
  );
}
