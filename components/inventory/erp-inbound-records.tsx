'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

import { InboundRecordsFilters } from '@/components/inventory/forms/inbound-records-filters';
import { InboundRecordsTable } from '@/components/inventory/forms/inbound-records-table';
import { InboundRecordsToolbar } from '@/components/inventory/forms/inbound-records-toolbar';
import { useInboundRecordsState } from '@/hooks/use-inbound-records';

interface ERPInboundRecordsProps {
  onCreateNew?: () => void;
}

/**
 * ERP风格入库记录组件
 * 符合中国ERP系统的紧凑布局和操作习惯
 */
export function ERPInboundRecords({ onCreateNew }: ERPInboundRecordsProps) {
  const router = useRouter();

  // 使用自定义Hook管理状态
  const {
    queryParams,
    inboundRecords,
    isLoading,
    error,
    handleFilter,
    handleResetFilters,
  } = useInboundRecordsState();

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/inventory/inbound/create');
    }
  };

  if (error) {
    return (
      <div className="rounded border bg-card">
        <InboundRecordsToolbar onCreateNew={handleCreateNew} />
        <div className="p-6 text-center">
          <div className="text-sm text-destructive">
            加载入库记录失败，请稍后重试
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <InboundRecordsToolbar onCreateNew={handleCreateNew} />
      </div>

      {/* 筛选条件 */}
      <InboundRecordsFilters
        queryParams={queryParams}
        onFilter={handleFilter}
        onReset={handleResetFilters}
      />

      {/* 入库记录表格 */}
      <InboundRecordsTable records={inboundRecords} isLoading={isLoading} />
    </div>
  );
}
