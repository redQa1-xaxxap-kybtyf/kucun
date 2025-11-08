'use client';

import { InboundRecordsFilters } from '@/components/inventory/forms/inbound-records-filters';
import { InboundRecordsTable } from '@/components/inventory/forms/inbound-records-table';
import { useInboundRecordsState } from '@/hooks/use-inbound-records';
import type { InboundQueryParams } from '@/lib/types/inbound';

interface ERPInboundRecordsProps {
  initialParams?: InboundQueryParams;
}

/**
 * ERP风格入库记录组件
 * 符合中国ERP系统的紧凑布局和操作习惯
 *
 * ✅ 架构优化：
 * - PageHeader 已移至父组件（page-client.tsx），与厂家发货页面保持一致
 * - 只负责筛选和表格展示，职责更单一（SRP 原则）
 */
export function ERPInboundRecords({ initialParams }: ERPInboundRecordsProps) {
  // 使用自定义Hook管理状态
  const {
    queryParams,
    inboundRecords,
    isLoading,
    error,
    handleFilter,
    handleResetFilters,
  } = useInboundRecordsState(initialParams);

  if (error) {
    return (
      <div
        className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-error-light))] p-6 text-center"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <div className="text-sm text-[hsl(var(--color-error))]">
          加载入库记录失败，请稍后重试
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 筛选条件 */}
      <InboundRecordsFilters
        queryParams={queryParams}
        onFilter={handleFilter}
        onReset={handleResetFilters}
      />

      {/* 入库记录表格 */}
      <InboundRecordsTable records={inboundRecords} isLoading={isLoading} />
    </>
  );
}
