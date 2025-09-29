'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

import { OutboundRecordsFilters } from '@/components/inventory/forms/outbound-records-filters';
import { OutboundRecordsTable } from '@/components/inventory/forms/outbound-records-table';
import { OutboundRecordsToolbar } from '@/components/inventory/forms/outbound-records-toolbar';
import { useOutboundRecords } from '@/hooks/use-outbound-records';

interface ERPOutboundRecordsProps {
  onCreateNew?: () => void;
}

/**
 * ERP风格的出库记录组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPOutboundRecords({ onCreateNew }: ERPOutboundRecordsProps) {
  const router = useRouter();

  const { outboundRecords, filters, isLoading, resetFilters, updateFilter } =
    useOutboundRecords();

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/inventory/outbound/create');
    }
  };

  return (
    <div className="space-y-4">
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <OutboundRecordsToolbar onCreateNew={handleCreateNew} />
      </div>

      {/* 筛选条件 */}
      <OutboundRecordsFilters
        filters={filters}
        onUpdateFilter={updateFilter}
        onReset={resetFilters}
      />

      {/* 出库记录表格 */}
      <OutboundRecordsTable records={outboundRecords} isLoading={isLoading} />
    </div>
  );
}
