'use client';

import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import type {
  PayableRecordQuery,
  PayableStatus,
  PayableSourceType,
} from '@/lib/types/payable';

interface Props {
  query: PayableRecordQuery;
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
}

export function PayablesFilterBar({
  query,
  onSearch,
  onFilterChange,
  onDateRangeChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-[280px] flex-1">
        <UnifiedSearchBar
          searchValue={query.search || ''}
          onSearchChange={onSearch}
          searchPlaceholder="搜索应付款单号或供应商名称..."
          debounceDelay={400}
          filters={[
            {
              key: 'status',
              label: '状态',
              options: [
                { label: '待付款', value: 'pending' },
                { label: '部分付款', value: 'partial' },
                { label: '已付款', value: 'paid' },
                { label: '已取消', value: 'cancelled' },
              ],
              width: 'w-[140px]',
            },
            {
              key: 'sourceType',
              label: '来源类型',
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
            sortOrder: query.sortOrder,
          }}
          onFilterChange={onFilterChange}
        />
      </div>
      <DateRangePicker
        value={{ startDate: query.startDate, endDate: query.endDate }}
        onChange={onDateRangeChange}
        label=""
        placeholder="选择单据日期范围"
        showPresets
        className="min-w-[220px]"
      />
    </div>
  );
}
