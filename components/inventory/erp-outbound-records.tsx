'use client';

import { OutboundRecordsFilters } from '@/components/inventory/forms/outbound-records-filters';
import { OutboundRecordsTable } from '@/components/inventory/forms/outbound-records-table';
import { OutboundRecordsToolbar } from '@/components/inventory/forms/outbound-records-toolbar';
import { useOutboundRecords } from '@/hooks/use-outbound-records';
import type { OutboundRecordQueryParams } from '@/lib/types/inventory';

interface ERPOutboundRecordsProps {
  initialParams?: OutboundRecordQueryParams;
}

/**
 * ERP风格的出库记录组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPOutboundRecords({ initialParams }: ERPOutboundRecordsProps) {
  const {
    outboundRecords,
    pagination,
    filters,
    isLoading,
    resetFilters,
    updateFilter,
    onPageChange,
  } = useOutboundRecords(initialParams);

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <OutboundRecordsToolbar />

        {/* 筛选条件 */}
        <OutboundRecordsFilters
          filters={filters}
          onUpdateFilter={updateFilter}
          onReset={resetFilters}
        />

        {/* 出库记录表格 */}
        <OutboundRecordsTable
          records={outboundRecords}
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
